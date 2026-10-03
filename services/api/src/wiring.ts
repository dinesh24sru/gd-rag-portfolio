import {
  createUpload,
  deleteDocument,
  getDocument,
  listDocuments,
  type CreateUploadDeps,
  type DocumentRepository,
  type ObjectStorage,
} from "@gd-rag/core";
import { createDynamoDocumentRepository, createS3ObjectStorage } from "@gd-rag/providers";
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

function buildFromEnv(): ApiWiring {
  const tableName = requiredEnv("DOCUMENTS_TABLE_NAME");
  const bucketName = requiredEnv("DOCUMENTS_BUCKET_NAME");
  const documents: DocumentRepository = createDynamoDocumentRepository({ tableName });
  const objects: ObjectStorage = createS3ObjectStorage({ bucketName });
  const deps: CreateUploadDeps = { documents, objects };

  return {
    documents: {
      createUpload: (auth, input) => createUpload(auth, input, deps),
      listDocuments: (auth) => listDocuments(auth, documents),
      getDocument: (auth, documentId) => getDocument(auth, documentId, documents),
      deleteDocument: (auth, documentId) => deleteDocument(auth, documentId, deps),
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
