/** Portfolio-sized defaults — keep S3/Bedrock costs bounded. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MiB
export const PRESIGN_EXPIRES_SECONDS = 300; // 5 minutes
export const LIST_DOCUMENTS_LIMIT = 50;

export const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export function isAllowedContentType(value: string): value is AllowedContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}
