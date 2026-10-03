/** High-level document processing status (ingestion worker advances beyond PENDING). */
export type DocumentStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

export type DocumentRecord = {
  tenantId: string;
  documentId: string;
  version: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: DocumentStatus;
  s3Key: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateUploadRequest = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export type CreateUploadResponse = {
  document: DocumentRecord;
  uploadUrl: string;
  expiresInSeconds: number;
};
