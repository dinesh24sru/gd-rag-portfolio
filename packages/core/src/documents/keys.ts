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

export type ParsedDocumentObjectKey = {
  tenantId: string;
  documentId: string;
  version: number;
};

const KEY_RE =
  /^tenant\/([^/]+)\/documents\/([^/]+)\/(\d+)\/original$/;

/** Parse and validate a document object key from an S3 event. */
export function parseDocumentObjectKey(key: string): ParsedDocumentObjectKey {
  const decoded = decodeURIComponent(key.replace(/\+/g, " "));
  const match = KEY_RE.exec(decoded);
  if (!match) {
    throw new Error(`Unrecognized document object key: ${decoded}`);
  }
  return {
    tenantId: match[1]!,
    documentId: match[2]!,
    version: Number(match[3]),
  };
}
