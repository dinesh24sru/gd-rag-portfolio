export type TextChunk = {
  chunkId: string;
  tenantId: string;
  documentId: string;
  version: number;
  index: number;
  text: string;
};

export type VectorChunk = TextChunk & {
  vector: number[];
};

export type VectorSearchRequest = {
  tenantId: string;
  vector: number[];
  topK: number;
};

export type SearchResult = {
  chunkId: string;
  documentId: string;
  version: number;
  text: string;
  score: number;
};

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export interface VectorStore {
  upsert(chunks: VectorChunk[]): Promise<void>;
  search(request: VectorSearchRequest): Promise<SearchResult[]>;
  deleteDocument(tenantId: string, documentId: string): Promise<void>;
}
