import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DocumentRecord } from "@gd-rag/shared";
import { createUpload } from "./createUpload";
import type { DocumentRepository, ObjectStorage } from "./ports";

function memoryRepo(): DocumentRepository & { items: DocumentRecord[] } {
  const items: DocumentRecord[] = [];
  return {
    items,
    async put(document) {
      items.push(document);
    },
    async get(tenantId, documentId) {
      return items.find((d) => d.tenantId === tenantId && d.documentId === documentId) ?? null;
    },
    async listByTenant(tenantId, limit) {
      return items.filter((d) => d.tenantId === tenantId).slice(0, limit);
    },
    async delete(tenantId, documentId) {
      const idx = items.findIndex((d) => d.tenantId === tenantId && d.documentId === documentId);
      if (idx >= 0) items.splice(idx, 1);
    },
  };
}

const stubObjects: ObjectStorage = {
  async presignPut() {
    return "https://example.com/upload";
  },
  async deleteObject() {},
};

describe("createUpload", () => {
  const auth = { tenantId: "tenant-a", sub: "tenant-a" };

  it("creates PENDING document under tenant and returns presigned URL", async () => {
    const documents = memoryRepo();

    const result = await createUpload(
      auth,
      {
        fileName: "notes.txt",
        contentType: "text/plain",
        sizeBytes: 12,
      },
      {
        documents,
        objects: stubObjects,
        idFactory: () => "doc-1",
        now: () => new Date("2026-01-01T00:00:00.000Z"),
      },
    );

    assert.equal(result.document.tenantId, "tenant-a");
    assert.equal(result.document.status, "PENDING");
    assert.equal(
      result.document.s3Key,
      "tenant/tenant-a/documents/doc-1/1/original",
    );
    assert.equal(result.uploadUrl, "https://example.com/upload");
    assert.equal(documents.items.length, 1);
  });

  it("rejects disallowed content types", async () => {
    await assert.rejects(
      () =>
        createUpload(
          auth,
          { fileName: "x.exe", contentType: "application/octet-stream", sizeBytes: 10 },
          {
            documents: memoryRepo(),
            objects: stubObjects,
          },
        ),
      /Unsupported contentType/,
    );
  });

  it("rejects oversized files", async () => {
    await assert.rejects(
      () =>
        createUpload(
          auth,
          { fileName: "big.pdf", contentType: "application/pdf", sizeBytes: 99 },
          {
            documents: memoryRepo(),
            objects: stubObjects,
            maxUploadBytes: 10,
          },
        ),
      /maximum size/,
    );
  });

  it("rejects when tenant already has max documents", async () => {
    const documents = memoryRepo();
    for (let i = 0; i < 5; i++) {
      await documents.put({
        tenantId: "tenant-a",
        documentId: `d-${i}`,
        version: 1,
        fileName: `${i}.txt`,
        contentType: "text/plain",
        sizeBytes: 1,
        status: "PENDING",
        s3Key: `tenant/tenant-a/documents/d-${i}/1/original`,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    }

    await assert.rejects(
      () =>
        createUpload(
          auth,
          { fileName: "extra.txt", contentType: "text/plain", sizeBytes: 1 },
          { documents, objects: stubObjects, maxDocumentsPerTenant: 5 },
        ),
      /Document limit reached/,
    );
  });
});
