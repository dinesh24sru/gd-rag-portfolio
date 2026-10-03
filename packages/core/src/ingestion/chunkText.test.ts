import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chunkText } from "./chunkText";

describe("chunkText", () => {
  it("assigns deterministic chunk IDs", () => {
    const chunks = chunkText({
      tenantId: "t1",
      documentId: "doc-1",
      version: 1,
      text: "hello world",
      chunkChars: 5,
      overlap: 0,
    });
    assert.equal(chunks[0]?.chunkId, "doc-1:1:0");
    assert.equal(chunks[0]?.tenantId, "t1");
  });

  it("respects max chunk cap", () => {
    const text = "a".repeat(1000);
    const chunks = chunkText({
      tenantId: "t1",
      documentId: "doc-1",
      version: 1,
      text,
      chunkChars: 10,
      overlap: 0,
      maxChunks: 3,
    });
    assert.equal(chunks.length, 3);
  });
});
