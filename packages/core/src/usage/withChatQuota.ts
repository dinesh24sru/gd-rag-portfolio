import type { ChatUsageSnapshot } from "@gd-rag/shared";
import type { AuthContext } from "../auth/context";
import type { LLMTokenUsage } from "../llm/ports";
import { assertChatQuota, recordChatTokens, type ChatUsageDeps } from "./chatUsage";

export type ChatQuotaRunResult<T> = {
  result: T;
  usage: ChatUsageSnapshot;
};

/**
 * Hard-gate chat quota, run LLM work, then atomically record reported tokens.
 * Use from the ask handler once RAG generation is wired.
 */
export async function withChatQuota<T extends { usage?: LLMTokenUsage }>(
  auth: AuthContext,
  deps: ChatUsageDeps,
  run: () => Promise<T>,
  estimatedTokens = 1,
): Promise<ChatQuotaRunResult<T>> {
  await assertChatQuota(auth, deps, estimatedTokens);
  const result = await run();
  const delta = Math.max(1, result.usage?.totalTokens ?? estimatedTokens);
  const usage = await recordChatTokens(auth, delta, deps);
  return { result, usage };
}
