import type { SearchResult } from "../ingestion/ports";

export type ConfidenceGateResult =
  | { ok: true; evidence: SearchResult[] }
  | { ok: false; reason: string; evidence: SearchResult[] };

/**
 * Decide whether retrieved chunks are strong enough to call the LLM.
 * Uses top score vs minScore; empty or weak retrieval → abstain.
 */
export function evaluateRetrievalConfidence(
  results: SearchResult[],
  minScore: number,
): ConfidenceGateResult {
  if (results.length === 0) {
    return { ok: false, reason: "no_results", evidence: [] };
  }

  const ranked = [...results].sort((a, b) => b.score - a.score);
  const top = ranked[0]!;
  if (top.score < minScore) {
    return {
      ok: false,
      reason: "below_threshold",
      evidence: ranked,
    };
  }

  const evidence = ranked.filter((r) => r.score >= minScore);
  if (evidence.length === 0) {
    return { ok: false, reason: "below_threshold", evidence: ranked };
  }

  return { ok: true, evidence };
}
