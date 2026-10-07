import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DocumentRecord } from "@gd-rag/shared";
import { deleteDocument } from "./deleteDocument";
import type { DocumentRepository, ObjectStorage } from "./ports";

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

describe("deleteDocument", () => {
  it("deletes S3 object then DynamoDB row for owning tenant", async () => {
    const documents = memoryRepo([
      {
        tenantId: "tenant-a",
        documentId: "doc-1",
        version: 1,
        fileName: "a.txt",
        contentType: "text/plain",
        sizeBytes: 1,
        contentHash: "a".repeat(64),
        status: "PENDING",
        s3Key: "tenant/tenant-a/documents/doc-1/1/original",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const deletedKeys: string[] = [];
    const objects: ObjectStorage = {
      async presignPut() {
        return "";
      },
      async getObject() {
        return { body: new Uint8Array() };
      },
      async deleteObject(key) {
        deletedKeys.push(key);
      },
    };

    await deleteDocument({ tenantId: "tenant-a", sub: "tenant-a" }, "doc-1", {
      documents,
      objects,
    });

    assert.deepEqual(deletedKeys, ["tenant/tenant-a/documents/doc-1/1/original"]);
    assert.equal(documents.items.length, 0);
  });

  it("forbids deleting another tenant document", async () => {
    const documents = memoryRepo([
      {
        tenantId: "tenant-a",
        documentId: "doc-1",
        version: 1,
        fileName: "a.txt",
        contentType: "text/plain",
        sizeBytes: 1,
        contentHash: "a".repeat(64),
        status: "PENDING",
        s3Key: "tenant/tenant-a/documents/doc-1/1/original",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    await assert.rejects(
      () =>
        deleteDocument({ tenantId: "tenant-b", sub: "tenant-b" }, "doc-1", {
          documents,
          objects: {
            async presignPut() {
              return "";
            },
            async getObject() {
              return { body: new Uint8Array() };
            },
            async deleteObject() {},
          },
        }),
      /not found/i,
    );
    assert.equal(documents.items.length, 1);
  });
});
