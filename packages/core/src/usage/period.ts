/** UTC calendar month key, e.g. `2026-10`. */
export function utcMonthPeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** DynamoDB sort key for monthly chat usage (Documents table reuse). */
export function chatUsageDocumentId(period: string): string {
  return `USAGE#CHAT#${period}`;
}

export const DEFAULT_CHAT_TOKEN_QUOTA_MONTHLY = 50_000;

export function resolveChatTokenQuotaMonthly(
  raw: string | undefined = process.env.CHAT_TOKEN_QUOTA_MONTHLY,
): number {
  const n = Number(raw ?? DEFAULT_CHAT_TOKEN_QUOTA_MONTHLY);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    return DEFAULT_CHAT_TOKEN_QUOTA_MONTHLY;
  }
  return n;
}
