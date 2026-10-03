import { NotFoundError, type DocumentRecord } from "@gd-rag/shared";
import { assertSameTenant, type AuthContext } from "../auth/context";
import type { DocumentRepository } from "./ports";

export async function getDocument(
  auth: AuthContext,
  documentId: string,
  documents: DocumentRepository,
): Promise<DocumentRecord> {
  const id = documentId?.trim();
  if (!id) {
    throw new NotFoundError("Document not found");
  }

  const document = await documents.get(auth.tenantId, id);
  if (!document) {
    throw new NotFoundError("Document not found");
  }

  assertSameTenant(document.tenantId, auth);
  return document;
}
