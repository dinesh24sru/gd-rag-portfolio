import type { DocumentRecord, DocumentStatus } from "@gd-rag/shared";

export interface DocumentRepository {
  put(document: DocumentRecord): Promise<void>;
  get(tenantId: string, documentId: string): Promise<DocumentRecord | null>;
  listByTenant(tenantId: string, limit: number): Promise<DocumentRecord[]>;
  delete(tenantId: string, documentId: string): Promise<void>;
  updateStatus(params: {
    tenantId: string;
    documentId: string;
    status: DocumentStatus;
    updatedAt: string;
  }): Promise<void>;
}

export interface ObjectStorage {
  presignPut(params: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<string>;
  getObject(key: string): Promise<{ body: Uint8Array; contentType?: string }>;
  deleteObject(key: string): Promise<void>;
}
