import type { DocumentRecord } from "@gd-rag/shared";

export interface DocumentRepository {
  put(document: DocumentRecord): Promise<void>;
  get(tenantId: string, documentId: string): Promise<DocumentRecord | null>;
  listByTenant(tenantId: string, limit: number): Promise<DocumentRecord[]>;
}

export interface ObjectStorage {
  presignPut(params: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<string>;
}
