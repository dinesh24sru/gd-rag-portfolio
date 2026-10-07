import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeContentHash, sha256Hex } from "./contentHash";

describe("contentHash", () => {
  it("normalizes uppercase hex", () => {
    const hash = "A".repeat(64);
    assert.equal(normalizeContentHash(hash), "a".repeat(64));
  });

  it("rejects missing or invalid digests", () => {
    assert.throws(() => normalizeContentHash(undefined), /required/);
    assert.throws(() => normalizeContentHash("abc"), /SHA-256/);
    assert.throws(() => normalizeContentHash("g".repeat(64)), /SHA-256/);
  });

  it("hashes bytes as lowercase hex", () => {
    assert.equal(
      sha256Hex(new TextEncoder().encode("hello world")),
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });
});
