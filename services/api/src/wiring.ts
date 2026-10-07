import {
  assertChatQuota,
  createUpload,
  deleteDocument,
  getChatUsage,
  getDocument,
  listDocuments,
  recordChatTokens,
  resolveChatTokenQuotaMonthly,
  withChatQuota,
  type ChatQuotaRunResult,
  type ChatUsageDeps,
  type CreateUploadDeps,
  type DocumentRepository,
  type LLMTokenUsage,
  type ObjectStorage,
  type UsageRepository,
  type VectorStore,
} from "@gd-rag/core";
import {
  createDynamoDocumentRepository,
  createDynamoUsageRepository,
  createQdrantVectorStore,
  createS3ObjectStorage,
} from "@gd-rag/providers";
import type { AuthContext } from "@gd-rag/core";
import type {
  ChatUsageSnapshot,
  CreateUploadRequest,
  DocumentRecord,
} from "@gd-rag/shared";

export type DocumentServices = {
  createUpload: (
    auth: AuthContext,
    input: CreateUploadRequest,
  ) => Promise<Awaited<ReturnType<typeof createUpload>>>;
  listDocuments: (auth: AuthContext) => Promise<DocumentRecord[]>;
  getDocument: (auth: AuthContext, documentId: string) => Promise<DocumentRecord>;
  deleteDocument: (auth: AuthContext, documentId: string) => Promise<void>;
};

export type UsageServices = {
  getUsage: (auth: AuthContext) => Promise<ChatUsageSnapshot>;
  /** Exported for chat ask wiring — hard gate before LLM. */
  assertQuota: (auth: AuthContext, estimatedTokens?: number) => Promise<ChatUsageSnapshot>;
  recordTokens: (auth: AuthContext, deltaTokens: number) => Promise<ChatUsageSnapshot>;
  withQuota: <T extends { usage?: LLMTokenUsage }>(
    auth: AuthContext,
    run: () => Promise<T>,
    estimatedTokens?: number,
  ) => Promise<ChatQuotaRunResult<T>>;
};

export type ApiWiring = {
  documents: DocumentServices;
  usage: UsageServices;
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

function buildUsageDeps(usage: UsageRepository): ChatUsageDeps {
  return {
    usage,
    quotaTokens: resolveChatTokenQuotaMonthly(),
  };
}

function buildFromEnv(): ApiWiring {
  const tableName = requiredEnv("DOCUMENTS_TABLE_NAME");
  const bucketName = requiredEnv("DOCUMENTS_BUCKET_NAME");
  const documents: DocumentRepository = createDynamoDocumentRepository({ tableName });
  const usageRepo: UsageRepository = createDynamoUsageRepository({ tableName });
  const objects: ObjectStorage = createS3ObjectStorage({ bucketName });
  const vectors = requiredVectorStore();
  const deps: CreateUploadDeps = { documents, objects };
  const usageDeps = buildUsageDeps(usageRepo);

  return {
    documents: {
      createUpload: (auth, input) => createUpload(auth, input, deps),
      listDocuments: (auth) => listDocuments(auth, documents),
      getDocument: (auth, documentId) => getDocument(auth, documentId, documents),
      deleteDocument: (auth, documentId) =>
        deleteDocument(auth, documentId, { documents, objects, vectors }),
    },
    usage: {
      getUsage: (auth) => getChatUsage(auth, usageDeps),
      assertQuota: (auth, estimatedTokens) =>
        assertChatQuota(auth, usageDeps, estimatedTokens),
      recordTokens: (auth, deltaTokens) =>
        recordChatTokens(auth, deltaTokens, usageDeps),
      withQuota: (auth, run, estimatedTokens) =>
        withChatQuota(auth, usageDeps, run, estimatedTokens),
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
