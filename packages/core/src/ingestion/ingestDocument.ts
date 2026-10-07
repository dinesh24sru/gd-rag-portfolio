import { PermanentIngestionError, type DocumentRecord } from "@gd-rag/shared";
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
    throw new PermanentIngestionError(reason);
  }

  const document = await deps.documents.get(parsed.tenantId, parsed.documentId);
  if (!document) {
    throw new PermanentIngestionError(
      `Document metadata not found for ${parsed.tenantId}/${parsed.documentId}`,
    );
  }

  if (document.s3Key !== decodeURIComponent(input.key.replace(/\+/g, " "))) {
    throw new PermanentIngestionError("S3 key does not match document metadata");
  }

  if (document.status === "READY") {
    return { outcome: "skipped", reason: "already_ready", document };
  }

  try {
    if (document.status === "PENDING" || document.status === "FAILED") {
      await markStatus(deps, document, "PROCESSING");
      document.status = "PROCESSING";
    }

    const object = await deps.objects.getObject(document.s3Key);
    if (document.contentHash) {
      const actualHash = sha256Hex(object.body);
      if (actualHash !== document.contentHash) {
        throw new PermanentIngestionError(
          "Uploaded object contentHash does not match document metadata",
        );
      }
    }
    const contentType = document.contentType || object.contentType || "application/octet-stream";
    const text = await extractTextFromObject({ body: object.body, contentType });
    const chunks = chunkText({
      tenantId: document.tenantId,
      documentId: document.documentId,
      version: document.version,
      text,
    });

    if (chunks.length === 0) {
      throw new PermanentIngestionError("No chunks produced from document text");
    }

    // Replace prior vectors for idempotent retries.
    await deps.vectors.deleteDocument(document.tenantId, document.documentId);

    const vectors = await deps.embeddings.embed(chunks.map((c) => c.text));
    if (vectors.length !== chunks.length) {
      throw new Error("Embedding count mismatch");
    }

    await deps.vectors.upsert(
      chunks.map((chunk, i) => ({
        ...chunk,
        vector: vectors[i]!,
      })),
    );

    await markStatus(deps, document, "READY");
    document.status = "READY";
    return { outcome: "ready", document, chunkCount: chunks.length };
  } catch (err) {
    if (err instanceof PermanentIngestionError) {
      await markStatus(deps, document, "FAILED").catch(() => undefined);
      throw err;
    }
    // Transient — leave PROCESSING for retry; do not mark FAILED.
    throw err;
  }
}
