import {
  ask,
  assertChatQuota,
  createUpload,
  deleteDocument,
  getChatUsage,
  getDocument,
  listDocuments,
  recordChatTokens,
  resolveChatTokenQuotaMonthly,
  resolveRagConfig,
  withChatQuota,
  type AskDeps,
  type ChatQuotaRunResult,
  type ChatUsageDeps,
  type CreateUploadDeps,
  type DocumentRepository,
  type EmbeddingProvider,
  type LLMProvider,
  type LLMTokenUsage,
  type ObjectStorage,
  type UsageRepository,
  type VectorStore,
} from "@gd-rag/core";
import {
  createBedrockEmbeddingProvider,
  createDynamoDocumentRepository,
  createDynamoUsageRepository,
  createGeminiLLMProvider,
  createQdrantVectorStore,
  createS3ObjectStorage,
  createVoyageEmbeddingProvider,
} from "@gd-rag/providers";
import type { AuthContext } from "@gd-rag/core";
import type {
  AskRequest,
  AskResponse,
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

export type ChatServices = {
  ask: (auth: AuthContext, input: AskRequest) => Promise<AskResponse>;
};

export type ApiWiring = {
  documents: DocumentServices;
  usage: UsageServices;
  chat: ChatServices;
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

function parseDimensions(provider: string): number {
  const fallback = provider === "voyage" ? "1024" : "256";
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? fallback);
  if (!Number.isFinite(dimensions) || dimensions < 256) {
    throw new Error("EMBEDDING_DIMENSIONS must be a number >= 256");
  }
  return dimensions;
}

function requiredVectorStore(dimensions: number): VectorStore {
  return createQdrantVectorStore({
    url: requiredEnv("QDRANT_URL"),
    apiKey: requiredEnv("QDRANT_API_KEY"),
    collection: requiredEnv("QDRANT_COLLECTION"),
    dimensions,
  });
}

function createEmbeddings(provider: string, dimensions: number): EmbeddingProvider {
  if (provider === "voyage") {
    return createVoyageEmbeddingProvider({
      apiKey: requiredEnv("VOYAGE_API_KEY"),
      modelId: process.env.VOYAGE_EMBEDDING_MODEL_ID?.trim() || "voyage-4-lite",
      dimensions,
      inputType: "query",
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

function createLlm(provider: string): LLMProvider {
  if (provider === "gemini") {
    return createGeminiLLMProvider({
      apiKey: requiredEnv("GEMINI_API_KEY"),
      modelId: process.env.GEMINI_MODEL_ID?.trim() || "gemini-3.8-flash",
      defaultMaxOutputTokens: resolveRagConfig().maxOutputTokens,
    });
  }
  throw new Error(
    `Unsupported LLM_PROVIDER "${provider}". Use "gemini" (bedrock LLM not wired yet).`,
  );
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
  const embeddingProvider = (
    process.env.EMBEDDING_PROVIDER ?? "voyage"
  )
    .trim()
    .toLowerCase();
  const llmProvider = (process.env.LLM_PROVIDER ?? "gemini").trim().toLowerCase();
  const dimensions = parseDimensions(embeddingProvider);

  const documents: DocumentRepository = createDynamoDocumentRepository({ tableName });
  const usageRepo: UsageRepository = createDynamoUsageRepository({ tableName });
  const objects: ObjectStorage = createS3ObjectStorage({ bucketName });
  const vectors = requiredVectorStore(dimensions);
  const embeddings = createEmbeddings(embeddingProvider, dimensions);
  const llm = createLlm(llmProvider);
  const deps: CreateUploadDeps = { documents, objects };
  const usageDeps = buildUsageDeps(usageRepo);
  const askDeps: AskDeps = {
    embeddings,
    vectors,
    llm,
    usage: usageDeps,
    config: resolveRagConfig(),
  };

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
    chat: {
      ask: (auth, input) => ask(auth, input, askDeps),
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
