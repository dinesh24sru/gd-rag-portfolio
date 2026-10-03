import type { DocumentRecord } from "@gd-rag/shared";
import type { AuthContext } from "../auth/context";
import { LIST_DOCUMENTS_LIMIT } from "./limits";
import type { DocumentRepository } from "./ports";

export async function listDocuments(
  auth: AuthContext,
  documents: DocumentRepository,
  limit = LIST_DOCUMENTS_LIMIT,
): Promise<DocumentRecord[]> {
  const capped = Math.min(Math.max(1, limit), LIST_DOCUMENTS_LIMIT);
  return documents.listByTenant(auth.tenantId, capped);
}
