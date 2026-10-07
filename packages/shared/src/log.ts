/**
 * Structured Lambda / CloudWatch ops logging.
 * Pass IDs, sizes, statuses — never document text or secrets.
 */
export function logInfo(event: string, fields: Record<string, unknown> = {}): void {
  console.info(event, fields);
}

export function logWarn(event: string, fields: Record<string, unknown> = {}): void {
  console.warn(event, fields);
}

export function logError(event: string, fields: Record<string, unknown> = {}): void {
  console.error(event, fields);
}
