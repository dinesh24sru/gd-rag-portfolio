import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGroundedAnswer } from "./citations";
import type { SearchResult } from "../ingestion/ports";

const evidence: SearchResult[] = [
  {
    chunkId: "c1",
    documentId: "d1",
    version: 1,
    text: "Alpha policy says widgets are blue.",
    score: 0.9,
  },
  {
    chunkId: "c2",
    documentId: "d2",
    version: 1,
    text: "Beta note about shipping.",
    score: 0.7,
  },
];

describe("parseGroundedAnswer", () => {
  it("detects ABSTAIN prefix", () => {
    const parsed = parseGroundedAnswer(
      "ABSTAIN: Not enough detail in the documents.",
      evidence,
      80,
    );
    assert.equal(parsed.abstained, true);
    assert.match(parsed.answer, /Not enough detail/);
    assert.equal(parsed.citations.length, 0);
  });

  it("keeps only valid citation indices", () => {
    const parsed = parseGroundedAnswer(
      "Widgets are blue [1]. Ignore [9] and [0].",
      evidence,
      80,
    );
    assert.equal(parsed.abstained, false);
    assert.equal(parsed.citations.length, 1);
    assert.equal(parsed.citations[0]?.chunkId, "c1");
    assert.equal(parsed.citations[0]?.documentId, "d1");
  });

  it("falls back to all evidence when markers are missing", () => {
    const parsed = parseGroundedAnswer("Widgets are blue.", evidence, 80);
    assert.equal(parsed.abstained, false);
    assert.equal(parsed.citations.length, 2);
  });
});
