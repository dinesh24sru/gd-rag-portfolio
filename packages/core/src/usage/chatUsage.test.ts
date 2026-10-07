import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QuotaExceededError, type ChatUsageSnapshot } from "@gd-rag/shared";
import {
  assertChatQuota,
  getChatUsage,
  recordChatTokens,
} from "./chatUsage";
import type { UsageRepository } from "./ports";

function memoryUsage(): UsageRepository & { rows: Map<string, ChatUsageSnapshot> } {
  const rows = new Map<string, ChatUsageSnapshot>();
  const key = (tenantId: string, period: string) => `${tenantId}:${period}`;
  return {
    rows,
    async getChatUsage(tenantId, period) {
      return rows.get(key(tenantId, period)) ?? null;
    },
    async tryConsumeChatTokens(params) {
      const k = key(params.tenantId, params.period);
      const prev = rows.get(k);
      const used = (prev?.usedTokens ?? 0) + params.deltaTokens;
      if (used > params.quotaTokens) {
        const usage = {
          period: params.period,
          usedTokens: prev?.usedTokens ?? 0,
          quotaTokens: params.quotaTokens,
          remainingTokens: Math.max(0, params.quotaTokens - (prev?.usedTokens ?? 0)),
        };
        throw new QuotaExceededError("quota", usage);
      }
      const next = {
        period: params.period,
        usedTokens: used,
        quotaTokens: params.quotaTokens,
        remainingTokens: Math.max(0, params.quotaTokens - used),
      };
      rows.set(k, next);
      return next;
    },
  };
}

describe("chatUsage", () => {
  const auth = { tenantId: "t1", sub: "t1" };
  const now = () => new Date("2026-10-07T12:00:00.000Z");

  it("returns zero usage when no row exists", async () => {
    const usage = memoryUsage();
    const snap = await getChatUsage(auth, { usage, quotaTokens: 1000, now });
    assert.deepEqual(snap, {
      period: "2026-10",
      usedTokens: 0,
      quotaTokens: 1000,
      remainingTokens: 1000,
    });
  });

  it("rejects when remaining is zero", async () => {
    const usage = memoryUsage();
    usage.rows.set("t1:2026-10", {
      period: "2026-10",
      usedTokens: 100,
      quotaTokens: 100,
      remainingTokens: 0,
    });
    await assert.rejects(
      () => assertChatQuota(auth, { usage, quotaTokens: 100, now }),
      (err: unknown) => err instanceof QuotaExceededError,
    );
  });

  it("records tokens after success", async () => {
    const usage = memoryUsage();
    const snap = await recordChatTokens(auth, 40, { usage, quotaTokens: 100, now });
    assert.equal(snap.usedTokens, 40);
    assert.equal(snap.remainingTokens, 60);
  });

  it("rejects consume that would exceed quota", async () => {
    const usage = memoryUsage();
    await recordChatTokens(auth, 90, { usage, quotaTokens: 100, now });
    await assert.rejects(
      () => recordChatTokens(auth, 20, { usage, quotaTokens: 100, now }),
      (err: unknown) => err instanceof QuotaExceededError,
    );
  });
});
