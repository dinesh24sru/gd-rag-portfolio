import {
  createUpload,
  deleteDocument,
  getDocument,
  listDocuments,
  type CreateUploadDeps,
  type DocumentRepository,
  type ObjectStorage,
  type VectorStore,
} from "@gd-rag/core";
import {
  createDynamoDocumentRepository,
  createQdrantVectorStore,
  createS3ObjectStorage,
} from "@gd-rag/providers";
import type { AuthContext } from "@gd-rag/core";
import type { CreateUploadRequest, DocumentRecord } from "@gd-rag/shared";

export type DocumentServices = {
  createUpload: (
    auth: AuthContext,
    input: CreateUploadRequest,
  ) => Promise<Awaited<ReturnType<typeof createUpload>>>;
  listDocuments: (auth: AuthContext) => Promise<DocumentRecord[]>;
  getDocument: (auth: AuthContext, documentId: string) => Promise<DocumentRecord>;
  deleteDocument: (auth: AuthContext, documentId: string) => Promise<void>;
};

export type ApiWiring = {
  documents: DocumentServices;
};

let cached: ApiWiring | undefined;
let testOverride: ApiWiring | undefined;

export function setApiWiringForTests(wiring: ApiWiring | undefined): void {
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

function requiredVectorStore(): VectorStore {
  const url = requiredEnv("QDRANT_URL");
  const apiKey = requiredEnv("QDRANT_API_KEY");
  const collection = requiredEnv("QDRANT_COLLECTION");
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? "256");
  if (!Number.isFinite(dimensions) || dimensions <= 0) {
    throw new Error("EMBEDDING_DIMENSIONS must be a positive number");
  }
  return createQdrantVectorStore({ url, apiKey, collection, dimensions });
}

function buildFromEnv(): ApiWiring {
  const tableName = requiredEnv("DOCUMENTS_TABLE_NAME");
  const bucketName = requiredEnv("DOCUMENTS_BUCKET_NAME");
  const documents: DocumentRepository = createDynamoDocumentRepository({ tableName });
  const objects: ObjectStorage = createS3ObjectStorage({ bucketName });
  const vectors = requiredVectorStore();
  const deps: CreateUploadDeps = { documents, objects };

  return {
    documents: {
      createUpload: (auth, input) => createUpload(auth, input, deps),
      listDocuments: (auth) => listDocuments(auth, documents),
      getDocument: (auth, documentId) => getDocument(auth, documentId, documents),
      deleteDocument: (auth, documentId) =>
        deleteDocument(auth, documentId, { documents, objects, vectors }),
    },
  };
}

export function getApiWiring(): ApiWiring {
  if (testOverride) {
    return testOverride;
  }
  if (!cached) {
    cached = buildFromEnv();
  }
  return cached;
}
