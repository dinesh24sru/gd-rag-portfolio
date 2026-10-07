/** Cost-bounded defaults for retrieval + generation. Override via env. */
export type RagConfig = {
  topK: number;
  minScore: number;
  maxQuestionChars: number;
  maxContextChars: number;
  maxChunkChars: number;
  maxOutputTokens: number;
  excerptChars: number;
};

export const DEFAULT_RAG_CONFIG: RagConfig = {
  topK: 5,
  /** Voyage cosine sims on short portfolio docs often land ~0.2–0.5; 0.35 was too strict. */
  minScore: 0.2,
  maxQuestionChars: 2_000,
  maxContextChars: 6_000,
  maxChunkChars: 1_200,
  maxOutputTokens: 512,
  excerptChars: 160,
};

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.floor(n);
}

function unitInterval(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    return fallback;
  }
  return n;
}

/** Resolve RAG knobs from process env (API Lambda). */
export function resolveRagConfig(): RagConfig {
  return {
    topK: positiveInt(process.env.RAG_TOP_K, DEFAULT_RAG_CONFIG.topK),
    minScore: unitInterval(process.env.RAG_MIN_SCORE, DEFAULT_RAG_CONFIG.minScore),
    maxQuestionChars: positiveInt(
      process.env.RAG_MAX_QUESTION_CHARS,
      DEFAULT_RAG_CONFIG.maxQuestionChars,
    ),
    maxContextChars: positiveInt(
      process.env.RAG_MAX_CONTEXT_CHARS,
      DEFAULT_RAG_CONFIG.maxContextChars,
    ),
    maxChunkChars: positiveInt(
      process.env.RAG_MAX_CHUNK_CHARS,
      DEFAULT_RAG_CONFIG.maxChunkChars,
    ),
    maxOutputTokens: positiveInt(
      process.env.RAG_MAX_OUTPUT_TOKENS,
      DEFAULT_RAG_CONFIG.maxOutputTokens,
    ),
    excerptChars: positiveInt(
      process.env.RAG_EXCERPT_CHARS,
      DEFAULT_RAG_CONFIG.excerptChars,
    ),
  };
}
