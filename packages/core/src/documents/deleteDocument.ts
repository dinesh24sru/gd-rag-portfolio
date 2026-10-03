import { NotFoundError } from "@gd-rag/shared";
import { assertSameTenant, type AuthContext } from "../auth/context";
import type { VectorStore } from "../ingestion/ports";
import type { DocumentRepository, ObjectStorage } from "./ports";

export type DeleteDocumentDeps = {
  documents: DocumentRepository;
  objects: ObjectStorage;
  vectors?: VectorStore;
};

/**
 * Tenant-scoped delete: vectors (if configured), S3 object, then DynamoDB metadata.
 * Ownership is always checked from authenticated context.
 */
export async function deleteDocument(
  auth: AuthContext,
  documentId: string,
  deps: DeleteDocumentDeps,
): Promise<void> {
  const id = documentId?.trim();
  if (!id) {
    throw new NotFoundError("Document not found");
  }

  const document = await deps.documents.get(auth.tenantId, id);
  if (!document) {
    throw new NotFoundError("Document not found");
  }

  assertSameTenant(document.tenantId, auth);

  if (deps.vectors) {
    await deps.vectors.deleteDocument(auth.tenantId, document.documentId);
  }
  await deps.objects.deleteObject(document.s3Key);
  await deps.documents.delete(auth.tenantId, document.documentId);
}
