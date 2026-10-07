import type { EmbeddingProvider } from "@gd-rag/core";

const DEFAULT_BASE_URL = "https://api.voyageai.com/v1";
const DEFAULT_MODEL = "voyage-4-lite";
const DEFAULT_TIMEOUT_MS = 30_000;
/** Keep batches small for Lambda memory/timeout predictability. */
const DEFAULT_BATCH_SIZE = 32;

export type VoyageInputType = "document" | "query" | null;

export type VoyageEmbeddingOptions = {
  apiKey: string;
  modelId?: string;
  /** Output dimensions (voyage-4-lite: 256 | 512 | 1024 | 2048). */
  dimensions: number;
  /** Retrieval-oriented prompt prefix; use `document` for ingestion. */
  inputType?: VoyageInputType;
  baseUrl?: string;
  timeoutMs?: number;
  batchSize?: number;
  fetchImpl?: typeof fetch;
};

type VoyageEmbeddingItem = {
  embedding?: number[];
  index?: number;
};

type VoyageEmbeddingsResponse = {
  data?: VoyageEmbeddingItem[];
};

/**
 * Voyage text embeddings via HTTPS (no SDK — keeps Lambda bundles small).
 * Default endpoint is api.voyageai.com; override baseUrl for Atlas-scoped keys if needed.
 */
export function createVoyageEmbeddingProvider(
  options: VoyageEmbeddingOptions,
): EmbeddingProvider {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("Voyage API key is required");
  }
  const modelId = options.modelId?.trim() || DEFAULT_MODEL;
  const baseUrl = (options.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const inputType = options.inputType === undefined ? "document" : options.inputType;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) {
        return [];
      }
      const vectors: number[][] = new Array(texts.length);
      for (let start = 0; start < texts.length; start += batchSize) {
        const batch = texts.slice(start, start + batchSize);
        const batchVectors = await embedBatch({
          fetchImpl,
          baseUrl,
          apiKey,
          modelId,
          dimensions: options.dimensions,
          inputType,
          timeoutMs,
          texts: batch,
        });
        for (let i = 0; i < batchVectors.length; i++) {
          vectors[start + i] = batchVectors[i]!;
        }
      }
      return vectors;
    },
  };
}

async function embedBatch(params: {
  fetchImpl: typeof fetch;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  dimensions: number;
  inputType: VoyageInputType;
  timeoutMs: number;
  texts: string[];
}): Promise<number[][]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const body: Record<string, unknown> = {
      input: params.texts,
      model: params.modelId,
      output_dimension: params.dimensions,
      truncation: true,
    };
    if (params.inputType) {
      body.input_type = params.inputType;
    }

    const response = await params.fetchImpl(`${params.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      throw new Error(
        `Voyage embeddings failed (${response.status}): ${detail || response.statusText}`,
      );
    }

    const payload = (await response.json()) as VoyageEmbeddingsResponse;
    const data = payload.data;
    if (!Array.isArray(data) || data.length !== params.texts.length) {
      throw new Error("Voyage embeddings response missing or incomplete data");
    }

    const ordered = [...data].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );
    return ordered.map((item, i) => {
      const embedding = item.embedding;
      if (!embedding?.length) {
        throw new Error(`Voyage embeddings response missing vector at index ${i}`);
      }
      if (embedding.length !== params.dimensions) {
        throw new Error(
          `Voyage embedding dimension mismatch: expected ${params.dimensions}, got ${embedding.length}`,
        );
      }
      return embedding;
    });
  } finally {
    clearTimeout(timer);
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}
