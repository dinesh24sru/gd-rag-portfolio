import type { Citation } from "@gd-rag/shared";
import type { SearchResult } from "../ingestion/ports";
import { ABSTAIN_PREFIX } from "./prompts";

export type ParsedGeneration = {
  abstained: boolean;
  answer: string;
  citations: Citation[];
};

/**
 * Parse LLM text: detect abstain prefix, extract [n] citations, drop unknowns.
 */
export function parseGroundedAnswer(
  raw: string,
  evidence: SearchResult[],
  excerptChars: number,
): ParsedGeneration {
  const text = raw.trim();
  if (!text) {
    return {
      abstained: true,
      answer:
        "I could not find enough support in your documents to answer that.",
      citations: [],
    };
  }

  if (text.toUpperCase().startsWith(ABSTAIN_PREFIX)) {
    const reason = text.slice(ABSTAIN_PREFIX.length).trim();
    return {
      abstained: true,
      answer:
        reason ||
        "I could not find enough support in your documents to answer that.",
      citations: [],
    };
  }

  const indices = new Set<number>();
  for (const match of text.matchAll(/\[(\d+)\]/g)) {
    const n = Number(match[1]);
    if (Number.isInteger(n) && n >= 1 && n <= evidence.length) {
      indices.add(n);
    }
  }

  const citations: Citation[] = [...indices]
    .sort((a, b) => a - b)
    .map((n) => toCitation(evidence[n - 1]!, excerptChars));

  // Guaranteed grounding links: if the model omitted markers, cite evidence used.
  if (citations.length === 0 && evidence.length > 0) {
    for (const chunk of evidence) {
      citations.push(toCitation(chunk, excerptChars));
    }
  }

  return {
    abstained: false,
    answer: text,
    citations,
  };
}

function toCitation(chunk: SearchResult, excerptChars: number): Citation {
  const excerpt = chunk.text.replace(/\s+/g, " ").trim();
  return {
    documentId: chunk.documentId,
    chunkId: chunk.chunkId,
    score: chunk.score,
    excerpt:
      excerpt.length <= excerptChars
        ? excerpt
        : `${excerpt.slice(0, Math.max(0, excerptChars - 1))}…`,
  };
}
