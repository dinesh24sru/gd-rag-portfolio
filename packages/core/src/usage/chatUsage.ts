import {
  QuotaExceededError,
  logInfo,
  logWarn,
  type ChatUsageSnapshot,
} from "@gd-rag/shared";
import type { AuthContext } from "../auth/context";
import {
  DEFAULT_CHAT_TOKEN_QUOTA_MONTHLY,
  resolveChatTokenQuotaMonthly,
  utcMonthPeriod,
} from "./period";
import type { UsageRepository } from "./ports";

export type ChatUsageDeps = {
  usage: UsageRepository;
  quotaTokens?: number;
  now?: () => Date;
};

function snapshot(
  period: string,
  usedTokens: number,
  quotaTokens: number,
): ChatUsageSnapshot {
  const used = Math.max(0, usedTokens);
  const quota = Math.max(1, quotaTokens);
  return {
    period,
    usedTokens: used,
    quotaTokens: quota,
    remainingTokens: Math.max(0, quota - used),
  };
}

function quotaOf(deps: ChatUsageDeps): number {
  return deps.quotaTokens ?? resolveChatTokenQuotaMonthly();
}

/** Current tenant chat usage for the UTC month (zeros if no row yet). */
export async function getChatUsage(
  auth: AuthContext,
  deps: ChatUsageDeps,
): Promise<ChatUsageSnapshot> {
  const period = utcMonthPeriod((deps.now ?? (() => new Date()))());
  const quotaTokens = quotaOf(deps);
  const existing = await deps.usage.getChatUsage(auth.tenantId, period);
  const result = snapshot(period, existing?.usedTokens ?? 0, existing?.quotaTokens ?? quotaTokens);
  logInfo("usage.check", {
    tenantId: auth.tenantId,
    period: result.period,
    used: result.usedTokens,
    quota: result.quotaTokens,
    remaining: result.remainingTokens,
  });
  return result;
}

/**
 * Hard gate before calling the LLM. Rejects when remainingTokens <= 0.
 * Optional `estimatedTokens` rejects when remaining would not cover the estimate.
 */
export async function assertChatQuota(
  auth: AuthContext,
  deps: ChatUsageDeps,
  estimatedTokens = 1,
): Promise<ChatUsageSnapshot> {
  const usage = await getChatUsage(auth, deps);
  const need = Math.max(1, estimatedTokens);
  if (usage.remainingTokens < need) {
    logWarn("usage.rejected", {
      tenantId: auth.tenantId,
      period: usage.period,
      used: usage.usedTokens,
      quota: usage.quotaTokens,
      remaining: usage.remainingTokens,
      estimatedTokens: need,
    });
    throw new QuotaExceededError(
      `Monthly chat token quota exceeded (${usage.usedTokens}/${usage.quotaTokens} used for ${usage.period}).`,
      usage,
    );
  }
  return usage;
}

/** Persist actual LLM tokens after a successful generate. */
export async function recordChatTokens(
  auth: AuthContext,
  deltaTokens: number,
  deps: ChatUsageDeps,
): Promise<ChatUsageSnapshot> {
  const period = utcMonthPeriod((deps.now ?? (() => new Date()))());
  const quotaTokens = quotaOf(deps);
  const delta = Math.max(0, Math.floor(deltaTokens));
  if (delta === 0) {
    return getChatUsage(auth, deps);
  }

  try {
    const updated = await deps.usage.tryConsumeChatTokens({
      tenantId: auth.tenantId,
      period,
      deltaTokens: delta,
      quotaTokens,
      updatedAt: (deps.now ?? (() => new Date()))().toISOString(),
    });
    logInfo("usage.incremented", {
      tenantId: auth.tenantId,
      period: updated.period,
      used: updated.usedTokens,
      quota: updated.quotaTokens,
      delta,
    });
    return updated;
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      throw err;
    }
    // Race: condition failed → reload and surface as quota exceeded.
    const usage = await getChatUsage(auth, deps);
    if (usage.remainingTokens < delta) {
      throw new QuotaExceededError(
        `Monthly chat token quota exceeded (${usage.usedTokens}/${usage.quotaTokens} used for ${usage.period}).`,
        usage,
      );
    }
    throw err;
  }
}

export { DEFAULT_CHAT_TOKEN_QUOTA_MONTHLY, resolveChatTokenQuotaMonthly, utcMonthPeriod };
