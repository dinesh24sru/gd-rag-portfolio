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

function buildFromEnv(): WorkerWiring {
  const tableName = requiredEnv("DOCUMENTS_TABLE_NAME");
  const bucketName = requiredEnv("DOCUMENTS_BUCKET_NAME");
  const qdrantUrl = requiredEnv("QDRANT_URL");
  const qdrantApiKey = requiredEnv("QDRANT_API_KEY");
  const qdrantCollection = requiredEnv("QDRANT_COLLECTION");
  const modelId = requiredEnv("BEDROCK_EMBEDDING_MODEL_ID");
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? "256");
  if (!Number.isFinite(dimensions) || dimensions < 256) {
    throw new Error("EMBEDDING_DIMENSIONS must be a number >= 256");
  }

  const documents = createDynamoDocumentRepository({ tableName });
  const objects = createS3ObjectStorage({ bucketName });
  const embeddings: EmbeddingProvider = createBedrockEmbeddingProvider({
    modelId,
    dimensions,
  });
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
