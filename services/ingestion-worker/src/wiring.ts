import {
  ingestDocument,
  type EmbeddingProvider,
  type IngestDocumentDeps,
  type VectorStore,
} from "@gd-rag/core";
import {
  createBedrockEmbeddingProvider,
  createDynamoDocumentRepository,
  createQdrantVectorStore,
  createS3ObjectStorage,
  createVoyageEmbeddingProvider,
} from "@gd-rag/providers";

export type WorkerWiring = {
  ingest: (input: { bucket: string; key: string }) => ReturnType<typeof ingestDocument>;
};

let cached: WorkerWiring | undefined;
let testOverride: WorkerWiring | undefined;

export function setWorkerWiringForTests(wiring: WorkerWiring | undefined): void {
  testOverride = wiring;
  cached = undefined;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseDimensions(provider: string): number {
  const fallback = provider === "voyage" ? "1024" : "256";
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? fallback);
  if (!Number.isFinite(dimensions) || dimensions < 256) {
    throw new Error("EMBEDDING_DIMENSIONS must be a number >= 256");
  }
  return dimensions;
}

function createEmbeddings(provider: string, dimensions: number): EmbeddingProvider {
  if (provider === "voyage") {
    return createVoyageEmbeddingProvider({
      apiKey: requiredEnv("VOYAGE_API_KEY"),
      modelId: process.env.VOYAGE_EMBEDDING_MODEL_ID?.trim() || "voyage-4-lite",
      dimensions,
      inputType: "document",
      baseUrl: process.env.VOYAGE_BASE_URL?.trim() || undefined,
    });
  }
  if (provider === "bedrock") {
    return createBedrockEmbeddingProvider({
      modelId: requiredEnv("BEDROCK_EMBEDDING_MODEL_ID"),
      dimensions,
    });
  }
  throw new Error(
    `Unsupported EMBEDDING_PROVIDER "${provider}". Use "voyage" or "bedrock".`,
  );
}

function buildFromEnv(): WorkerWiring {
  const tableName = requiredEnv("DOCUMENTS_TABLE_NAME");
  const bucketName = requiredEnv("DOCUMENTS_BUCKET_NAME");
  const qdrantUrl = requiredEnv("QDRANT_URL");
  const qdrantApiKey = requiredEnv("QDRANT_API_KEY");
  const qdrantCollection = requiredEnv("QDRANT_COLLECTION");
  const provider = (process.env.EMBEDDING_PROVIDER ?? "voyage").trim().toLowerCase();
  const dimensions = parseDimensions(provider);

  const documents = createDynamoDocumentRepository({ tableName });
  const objects = createS3ObjectStorage({ bucketName });
  const embeddings = createEmbeddings(provider, dimensions);
  const vectors: VectorStore = createQdrantVectorStore({
    url: qdrantUrl,
    apiKey: qdrantApiKey,
    collection: qdrantCollection,
    dimensions,
  });

  const deps: IngestDocumentDeps = { documents, objects, embeddings, vectors };
  return {
    ingest: (input) => ingestDocument(input, deps),
  };
}

export function getWorkerWiring(): WorkerWiring {
  if (testOverride) {
    return testOverride;
  }
  if (!cached) {
    cached = buildFromEnv();
  }
  return cached;
}
