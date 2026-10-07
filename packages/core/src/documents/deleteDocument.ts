import { NotFoundError, logError, logInfo, logWarn } from "@gd-rag/shared";
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

  logInfo("delete.started", {
    tenantId: auth.tenantId,
    documentId: document.documentId,
    fileName: document.fileName,
    status: document.status,
    s3Key: document.s3Key,
    hasVectors: Boolean(deps.vectors),
  });

  try {
    if (deps.vectors) {
      logInfo("delete.qdrant_start", {
        tenantId: auth.tenantId,
        documentId: document.documentId,
      });
      await deps.vectors.deleteDocument(auth.tenantId, document.documentId);
      logInfo("delete.qdrant_done", {
        tenantId: auth.tenantId,
        documentId: document.documentId,
      });
    } else {
      logWarnSkipVectors(auth.tenantId, document.documentId);
    }

    logInfo("delete.s3_start", {
      tenantId: auth.tenantId,
      documentId: document.documentId,
      s3Key: document.s3Key,
    });
    await deps.objects.deleteObject(document.s3Key);
    logInfo("delete.s3_done", {
      tenantId: auth.tenantId,
      documentId: document.documentId,
    });

    logInfo("delete.dynamodb_start", {
      tenantId: auth.tenantId,
      documentId: document.documentId,
    });
    await deps.documents.delete(auth.tenantId, document.documentId);
    logInfo("delete.dynamodb_done", {
      tenantId: auth.tenantId,
      documentId: document.documentId,
    });

    logInfo("delete.completed", {
      tenantId: auth.tenantId,
      documentId: document.documentId,
      fileName: document.fileName,
    });
  } catch (err) {
    logError("delete.failed", {
      tenantId: auth.tenantId,
      documentId: document.documentId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function logWarnSkipVectors(tenantId: string, documentId: string): void {
  logWarn("delete.qdrant_skipped", {
    tenantId,
    documentId,
    reason: "vector_store_not_configured",
  });
}
