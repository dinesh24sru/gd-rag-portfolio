import type { ChatUsageSnapshot } from "@gd-rag/shared";

export type UsageRepository = {
  getChatUsage(tenantId: string, period: string): Promise<ChatUsageSnapshot | null>;
  /**
   * Atomically add tokens for the period. Fails (throws) if used + delta would exceed quota.
   * Creates the monthly item when missing.
   */
  tryConsumeChatTokens(params: {
    tenantId: string;
    period: string;
    deltaTokens: number;
    quotaTokens: number;
    updatedAt: string;
  }): Promise<ChatUsageSnapshot>;
};
