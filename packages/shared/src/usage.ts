/** Monthly chat LLM token usage for a tenant (UTC calendar month). */
export type ChatUsageSnapshot = {
  period: string;
  usedTokens: number;
  quotaTokens: number;
  remainingTokens: number;
};

export type GetUsageResponse = ChatUsageSnapshot;
