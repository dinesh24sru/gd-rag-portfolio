import { PermanentIngestionError, logError, logInfo, logWarn, type DocumentRecord } from "@gd-rag/shared";
import { sha256Hex } from "../documents/contentHash";
import { parseDocumentObjectKey } from "../documents/keys";
import type { DocumentRepository, ObjectStorage } from "../documents/ports";
import { chunkText } from "./chunkText";
import { extractTextFromObject } from "./extractText";
import type { EmbeddingProvider, VectorStore } from "./ports";

export type IngestDocumentDeps = {
  documents: DocumentRepository;
  objects: ObjectStorage;
  embeddings: EmbeddingProvider;
  vectors: VectorStore;
  now?: () => Date;
};

export type IngestDocumentInput = {
  bucket: string;
  key: string;
};

export type IngestDocumentResult =
  | { outcome: "skipped"; reason: string; document?: DocumentRecord }
  | { outcome: "ready"; document: DocumentRecord; chunkCount: number }
  | { outcome: "failed"; documentId?: string; reason: string };

function isoNow(deps: IngestDocumentDeps): string {
  return (deps.now ?? (() => new Date()))().toISOString();
}

async function markStatus(
  deps: IngestDocumentDeps,
  doc: DocumentRecord,
  status: DocumentRecord["status"],
): Promise<void> {
  await deps.documents.updateStatus({
    tenantId: doc.tenantId,
    documentId: doc.documentId,
    status,
    updatedAt: isoNow(deps),
  });
  logInfo("ingest.status", {
    tenantId: doc.tenantId,
    documentId: doc.documentId,
    status,
  });
}

/**
 * Full ingestion: parse key → PROCESSING → download → extract → chunk → embed → upsert → READY.
 * Permanent errors mark FAILED and rethrow PermanentIngestionError so the worker can ack the message.
 */
export async function ingestDocument(
  input: IngestDocumentInput,
  deps: IngestDocumentDeps,
): Promise<IngestDocumentResult> {
  let parsed;
  try {
    parsed = parseDocumentObjectKey(input.key);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Invalid object key";
    logError("ingest.invalid_key", { key: input.key, error: reason });
    throw new PermanentIngestionError(reason);
  }

  logInfo("ingest.started", {
    bucket: input.bucket,
    key: input.key,
    tenantId: parsed.tenantId,
    documentId: parsed.documentId,
  });

  const document = await deps.documents.get(parsed.tenantId, parsed.documentId);
  if (!document) {
    logError("ingest.metadata_missing", {
      tenantId: parsed.tenantId,
      documentId: parsed.documentId,
    });
    throw new PermanentIngestionError(
      `Document metadata not found for ${parsed.tenantId}/${parsed.documentId}`,
    );
  }

  if (document.s3Key !== decodeURIComponent(input.key.replace(/\+/g, " "))) {
    logError("ingest.s3_key_mismatch", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      expectedS3Key: document.s3Key,
      eventKey: input.key,
    });
    throw new PermanentIngestionError("S3 key does not match document metadata");
  }

  if (document.status === "READY") {
    logInfo("ingest.skipped", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      reason: "already_ready",
    });
    return { outcome: "skipped", reason: "already_ready", document };
  }

  try {
    if (document.status === "PENDING" || document.status === "FAILED") {
      await markStatus(deps, document, "PROCESSING");
      document.status = "PROCESSING";
    }

    logInfo("ingest.download_start", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      s3Key: document.s3Key,
    });
    const object = await deps.objects.getObject(document.s3Key);
    logInfo("ingest.download_done", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      bytes: object.body.byteLength,
      contentType: object.contentType ?? document.contentType,
    });

    if (document.contentHash) {
      const actualHash = sha256Hex(object.body);
      if (actualHash !== document.contentHash) {
        logError("ingest.content_hash_mismatch", {
          tenantId: document.tenantId,
          documentId: document.documentId,
          expectedHash: document.contentHash,
          actualHash,
        });
        throw new PermanentIngestionError(
          "Uploaded object contentHash does not match document metadata",
        );
      }
      logInfo("ingest.content_hash_ok", {
        tenantId: document.tenantId,
        documentId: document.documentId,
        contentHash: document.contentHash,
      });
    }

    const contentType = document.contentType || object.contentType || "application/octet-stream";
    logInfo("ingest.extract_start", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      contentType,
    });
    const text = await extractTextFromObject({ body: object.body, contentType });
    logInfo("ingest.extract_done", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      textChars: text.length,
    });

    const chunks = chunkText({
      tenantId: document.tenantId,
      documentId: document.documentId,
      version: document.version,
      text,
    });
    logInfo("ingest.chunk_done", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      chunkCount: chunks.length,
    });

    if (chunks.length === 0) {
      throw new PermanentIngestionError("No chunks produced from document text");
    }

    // Replace prior vectors for idempotent retries.
    logInfo("ingest.vectors_delete_start", {
      tenantId: document.tenantId,
      documentId: document.documentId,
    });
    await deps.vectors.deleteDocument(document.tenantId, document.documentId);
    logInfo("ingest.vectors_delete_done", {
      tenantId: document.tenantId,
      documentId: document.documentId,
    });

    logInfo("ingest.embed_start", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      chunkCount: chunks.length,
    });
    const vectors = await deps.embeddings.embed(chunks.map((c) => c.text));
    if (vectors.length !== chunks.length) {
      throw new Error("Embedding count mismatch");
    }
    logInfo("ingest.embed_done", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      embeddingCount: vectors.length,
    });

    logInfo("ingest.vectors_upsert_start", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      pointCount: chunks.length,
    });
    await deps.vectors.upsert(
      chunks.map((chunk, i) => ({
        ...chunk,
        vector: vectors[i]!,
      })),
    );
    logInfo("ingest.vectors_upsert_done", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      pointCount: chunks.length,
    });

    await markStatus(deps, document, "READY");
    document.status = "READY";
    logInfo("ingest.completed", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      fileName: document.fileName,
      chunkCount: chunks.length,
    });
    return { outcome: "ready", document, chunkCount: chunks.length };
  } catch (err) {
    if (err instanceof PermanentIngestionError) {
      logError("ingest.permanent_failure", {
        tenantId: document.tenantId,
        documentId: document.documentId,
        error: err.message,
      });
      await markStatus(deps, document, "FAILED").catch(() => undefined);
      throw err;
    }
    logWarn("ingest.transient_failure", {
      tenantId: document.tenantId,
      documentId: document.documentId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Transient — leave PROCESSING for retry; do not mark FAILED.
    throw err;
  }
}
