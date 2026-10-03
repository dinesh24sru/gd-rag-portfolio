/**
 * Deterministic S3 object key for an original upload.
 * tenant/{tenantId}/documents/{documentId}/{version}/original
 */
export function buildDocumentObjectKey(params: {
  tenantId: string;
  documentId: string;
  version: number;
}): string {
  return `tenant/${params.tenantId}/documents/${params.documentId}/${params.version}/original`;
}
