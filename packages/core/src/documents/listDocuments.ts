import type { DocumentRecord } from "@gd-rag/shared";
import type { AuthContext } from "../auth/context";
import { LIST_DOCUMENTS_LIMIT } from "./limits";
import type { DocumentRepository } from "./ports";

function isDocumentRow(item: DocumentRecord): boolean {
  return !item.documentId.startsWith("USAGE#");
}

export async function listDocuments(
  auth: AuthContext,
  documents: DocumentRepository,
  limit = LIST_DOCUMENTS_LIMIT,
): Promise<DocumentRecord[]> {
  const capped = Math.min(Math.max(1, limit), LIST_DOCUMENTS_LIMIT);
  // Over-fetch slightly so USAGE# rows in the same table do not crowd out documents.
  const rows = await documents.listByTenant(auth.tenantId, capped + 10);
  return rows.filter(isDocumentRow).slice(0, capped);
}
