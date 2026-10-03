import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDocumentObjectKey, parseDocumentObjectKey } from "./keys";

describe("document object keys", () => {
  it("round-trips build and parse", () => {
    const key = buildDocumentObjectKey({
      tenantId: "tenant-a",
      documentId: "doc-1",
      version: 1,
    });
    assert.equal(key, "tenant/tenant-a/documents/doc-1/1/original");
    assert.deepEqual(parseDocumentObjectKey(key), {
      tenantId: "tenant-a",
      documentId: "doc-1",
      version: 1,
    });
  });

  it("decodes URL-encoded S3 keys", () => {
    const parsed = parseDocumentObjectKey(
      "tenant%2Ftenant-a%2Fdocuments%2Fdoc-1%2F1%2Foriginal",
    );
    assert.equal(parsed.documentId, "doc-1");
  });

  it("rejects unrecognized keys", () => {
    assert.throws(() => parseDocumentObjectKey("other/path"), /Unrecognized/);
  });
});
