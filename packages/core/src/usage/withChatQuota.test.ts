import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QuotaExceededError, type ChatUsageSnapshot } from "@gd-rag/shared";
import type { UsageRepository } from "./ports";
import { withChatQuota } from "./withChatQuota";

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
        throw new QuotaExceededError("quota", {
          period: params.period,
          usedTokens: prev?.usedTokens ?? 0,
          quotaTokens: params.quotaTokens,
          remainingTokens: Math.max(0, params.quotaTokens - (prev?.usedTokens ?? 0)),
        });
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

describe("withChatQuota", () => {
  it("gates then records LLM usage", async () => {
    const usage = memoryUsage();
    const auth = { tenantId: "t1", sub: "t1" };
    const now = () => new Date("2026-10-07T00:00:00.000Z");
    const { result, usage: snap } = await withChatQuota(
      auth,
      { usage, quotaTokens: 1000, now },
      async () => ({
        text: "ok",
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      }),
    );
    assert.equal(result.text, "ok");
    assert.equal(snap.usedTokens, 15);
    assert.equal(snap.remainingTokens, 985);
  });
});
