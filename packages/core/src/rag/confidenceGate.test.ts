import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateRetrievalConfidence } from "./confidenceGate";

describe("evaluateRetrievalConfidence", () => {
  it("abstains when there are no hits", () => {
    const gate = evaluateRetrievalConfidence([], 0.35);
    assert.equal(gate.ok, false);
    if (!gate.ok) {
      assert.equal(gate.reason, "no_results");
    }
  });

  it("abstains when top score is below threshold", () => {
    const gate = evaluateRetrievalConfidence(
      [
        {
          chunkId: "c1",
          documentId: "d1",
          version: 1,
          text: "hello",
          score: 0.2,
        },
      ],
      0.35,
    );
    assert.equal(gate.ok, false);
    if (!gate.ok) {
      assert.equal(gate.reason, "below_threshold");
    }
  });

  it("passes and keeps only chunks at or above threshold", () => {
    const gate = evaluateRetrievalConfidence(
      [
        {
          chunkId: "c1",
          documentId: "d1",
          version: 1,
          text: "strong",
          score: 0.8,
        },
        {
          chunkId: "c2",
          documentId: "d1",
          version: 1,
          text: "weak",
          score: 0.1,
        },
      ],
      0.35,
    );
    assert.equal(gate.ok, true);
    if (gate.ok) {
      assert.equal(gate.evidence.length, 1);
      assert.equal(gate.evidence[0]?.chunkId, "c1");
    }
  });
});
