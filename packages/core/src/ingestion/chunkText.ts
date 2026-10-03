import type { TextChunk } from "./ports";

/** Keep chunks small for Bedrock token/cost caps. */
export const DEFAULT_CHUNK_CHARS = 800;
export const DEFAULT_CHUNK_OVERLAP = 100;
export const MAX_CHUNKS_PER_DOCUMENT = 200;

export type ChunkTextParams = {
  tenantId: string;
  documentId: string;
  version: number;
  text: string;
  chunkChars?: number;
  overlap?: number;
  maxChunks?: number;
};

function buildChunkId(documentId: string, version: number, index: number): string {
  return `${documentId}:${version}:${index}`;
}

/** Split text into overlapping character windows with deterministic chunk IDs. */
export function chunkText(params: ChunkTextParams): TextChunk[] {
  const chunkChars = params.chunkChars ?? DEFAULT_CHUNK_CHARS;
  const overlap = params.overlap ?? DEFAULT_CHUNK_OVERLAP;
  const maxChunks = params.maxChunks ?? MAX_CHUNKS_PER_DOCUMENT;
  const text = params.text.trim();
  if (!text) {
    return [];
  }

  const step = Math.max(1, chunkChars - overlap);
  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length && index < maxChunks) {
    const end = Math.min(text.length, start + chunkChars);
    const slice = text.slice(start, end).trim();
    if (slice) {
      chunks.push({
        chunkId: buildChunkId(params.documentId, params.version, index),
        tenantId: params.tenantId,
        documentId: params.documentId,
        version: params.version,
        index,
        text: slice,
      });
      index += 1;
    }
    if (end >= text.length) {
      break;
    }
    start += step;
  }

  return chunks;
}
