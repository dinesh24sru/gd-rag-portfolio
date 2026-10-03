import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PermanentIngestionError, type DocumentRecord } from "@gd-rag/shared";
import type { DocumentRepository, ObjectStorage } from "../documents/ports";
import { ingestDocument } from "./ingestDocument";
import type { EmbeddingProvider, VectorStore } from "./ports";

function memoryRepo(seed: DocumentRecord[]): DocumentRepository & { items: DocumentRecord[] } {
  const items = [...seed];
  return {
    items,
    async put(document) {
      items.push(document);
    },
    async get(tenantId, documentId) {
      return items.find((d) => d.tenantId === tenantId && d.documentId === documentId) ?? null;
    },
    async listByTenant(tenantId) {
      return items.filter((d) => d.tenantId === tenantId);
    },
    async delete(tenantId, documentId) {
      const idx = items.findIndex((d) => d.tenantId === tenantId && d.documentId === documentId);
      if (idx >= 0) items.splice(idx, 1);
    },
    async updateStatus(params) {
      const doc = items.find(
        (d) => d.tenantId === params.tenantId && d.documentId === params.documentId,
      );
      if (doc) {
        doc.status = params.status;
        doc.updatedAt = params.updatedAt;
      }
    },
  };
}

describe("ingestDocument", () => {
  const baseDoc: DocumentRecord = {
    tenantId: "tenant-a",
    documentId: "doc-1",
    version: 1,
    fileName: "notes.txt",
    contentType: "text/plain",
    sizeBytes: 11,
    status: "PENDING",
    s3Key: "tenant/tenant-a/documents/doc-1/1/original",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("extracts, chunks, embeds, upserts, and marks READY", async () => {
    const documents = memoryRepo([structuredClone(baseDoc)]);
    const upserted: string[] = [];
    const objects: ObjectStorage = {
      async presignPut() {
        return "";
      },
      async getObject() {
        return { body: new TextEncoder().encode("hello world"), contentType: "text/plain" };
      },
      async deleteObject() {},
    };
    const embeddings: EmbeddingProvider = {
      async embed(texts) {
        return texts.map((_, i) => [i, 1, 0]);
      },
    };
    const vectors: VectorStore = {
      async upsert(chunks) {
        upserted.push(...chunks.map((c) => c.chunkId));
      },
      async search() {
        return [];
      },
      async deleteDocument() {},
    };

    const result = await ingestDocument(
      { bucket: "b", key: baseDoc.s3Key },
      {
        documents,
        objects,
        embeddings,
        vectors,
        now: () => new Date("2026-01-02T00:00:00.000Z"),
      },
    );

    assert.equal(result.outcome, "ready");
    assert.equal(documents.items[0]?.status, "READY");
    assert.ok(upserted.length >= 1);
  });

  it("skips when already READY", async () => {
    const documents = memoryRepo([{ ...baseDoc, status: "READY" }]);
    const result = await ingestDocument(
      { bucket: "b", key: baseDoc.s3Key },
      {
        documents,
        objects: {
          async presignPut() {
            return "";
          },
          async getObject() {
            throw new Error("should not download");
          },
          async deleteObject() {},
        },
        embeddings: {
          async embed() {
            throw new Error("should not embed");
          },
        },
        vectors: {
          async upsert() {},
          async search() {
            return [];
          },
          async deleteDocument() {},
        },
      },
    );
    assert.equal(result.outcome, "skipped");
  });

  it("marks FAILED on permanent extract errors and rethrows", async () => {
    const documents = memoryRepo([structuredClone(baseDoc)]);
    await assert.rejects(
      () =>
        ingestDocument(
          { bucket: "b", key: baseDoc.s3Key },
          {
            documents,
            objects: {
              async presignPut() {
                return "";
              },
              async getObject() {
                return { body: new Uint8Array(), contentType: "text/plain" };
              },
              async deleteObject() {},
            },
            embeddings: {
              async embed() {
                return [];
              },
            },
            vectors: {
              async upsert() {},
              async search() {
                return [];
              },
              async deleteDocument() {},
            },
          },
        ),
      (err: unknown) => err instanceof PermanentIngestionError,
    );
    assert.equal(documents.items[0]?.status, "FAILED");
  });
});
