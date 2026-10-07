import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DocumentRecord } from "@gd-rag/shared";
import { createUpload } from "./createUpload";
import type { DocumentRepository, ObjectStorage } from "./ports";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

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

const stubObjects: ObjectStorage = {
  async presignPut() {
    return "https://example.com/upload";
  },
  async getObject() {
    return { body: new Uint8Array() };
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
        contentHash: HASH_A,
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
    assert.equal(result.document.contentHash, HASH_A);
    assert.equal(
      result.document.s3Key,
      "tenant/tenant-a/documents/doc-1/1/original",
    );
    assert.equal(result.uploadUrl, "https://example.com/upload");
    assert.equal(documents.items.length, 1);
  });

  it("rejects duplicate contentHash for the same tenant", async () => {
    const documents = memoryRepo();
    await documents.put({
      tenantId: "tenant-a",
      documentId: "existing",
      version: 1,
      fileName: "readme.md",
      contentType: "text/markdown",
      sizeBytes: 10,
      contentHash: HASH_A,
      status: "READY",
      s3Key: "tenant/tenant-a/documents/existing/1/original",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await assert.rejects(
      () =>
        createUpload(
          auth,
          {
            fileName: "README-copy.md",
            contentType: "text/markdown",
            sizeBytes: 10,
            contentHash: HASH_A,
          },
          { documents, objects: stubObjects },
        ),
      /already uploaded as “readme\.md”/,
    );
  });

  it("allows the same contentHash for a different tenant", async () => {
    const documents = memoryRepo();
    await documents.put({
      tenantId: "tenant-b",
      documentId: "other",
      version: 1,
      fileName: "notes.txt",
      contentType: "text/plain",
      sizeBytes: 12,
      contentHash: HASH_A,
      status: "READY",
      s3Key: "tenant/tenant-b/documents/other/1/original",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await createUpload(
      auth,
      {
        fileName: "notes.txt",
        contentType: "text/plain",
        sizeBytes: 12,
        contentHash: HASH_A,
      },
      { documents, objects: stubObjects, idFactory: () => "doc-2" },
    );
    assert.equal(result.document.documentId, "doc-2");
  });

  it("rejects invalid contentHash", async () => {
    await assert.rejects(
      () =>
        createUpload(
          auth,
          {
            fileName: "notes.txt",
            contentType: "text/plain",
            sizeBytes: 12,
            contentHash: "nope",
          },
          { documents: memoryRepo(), objects: stubObjects },
        ),
      /SHA-256/,
    );
  });

  it("rejects disallowed content types", async () => {
    await assert.rejects(
      () =>
        createUpload(
          auth,
          {
            fileName: "x.exe",
            contentType: "application/octet-stream",
            sizeBytes: 10,
            contentHash: HASH_B,
          },
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
          {
            fileName: "big.pdf",
            contentType: "application/pdf",
            sizeBytes: 99,
            contentHash: HASH_B,
          },
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
        contentHash: `${i}`.padStart(64, "0"),
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
          {
            fileName: "extra.txt",
            contentType: "text/plain",
            sizeBytes: 1,
            contentHash: HASH_B,
          },
          { documents, objects: stubObjects, maxDocumentsPerTenant: 5 },
        ),
      /Document limit reached/,
    );
  });
});
