export type { AuthContext } from "./auth/context";
export { createAuthContextFromClaims, assertSameTenant } from "./auth/context";

export type { DocumentRepository, ObjectStorage } from "./documents/ports";
export {
  MAX_UPLOAD_BYTES,
  PRESIGN_EXPIRES_SECONDS,
  MAX_DOCUMENTS_PER_TENANT,
  LIST_DOCUMENTS_LIMIT,
  ALLOWED_CONTENT_TYPES,
  isAllowedContentType,
} from "./documents/limits";
export { buildDocumentObjectKey, parseDocumentObjectKey } from "./documents/keys";
export type { ParsedDocumentObjectKey } from "./documents/keys";
export { createUpload } from "./documents/createUpload";
export type { CreateUploadDeps } from "./documents/createUpload";
export { getDocument } from "./documents/getDocument";
export { listDocuments } from "./documents/listDocuments";
export { deleteDocument } from "./documents/deleteDocument";
export type { DeleteDocumentDeps } from "./documents/deleteDocument";

export type {
  TextChunk,
  VectorChunk,
  VectorSearchRequest,
  SearchResult,
  EmbeddingProvider,
  VectorStore,
} from "./ingestion/ports";
export {
  chunkText,
  DEFAULT_CHUNK_CHARS,
  DEFAULT_CHUNK_OVERLAP,
  MAX_CHUNKS_PER_DOCUMENT,
} from "./ingestion/chunkText";
export type { ChunkTextParams } from "./ingestion/chunkText";
export { extractTextFromObject } from "./ingestion/extractText";
export { ingestDocument } from "./ingestion/ingestDocument";
export type {
  IngestDocumentDeps,
  IngestDocumentInput,
  IngestDocumentResult,
} from "./ingestion/ingestDocument";
export { parseS3EventRecords } from "./ingestion/parseS3Event";
export type { S3ObjectCreatedRef } from "./ingestion/parseS3Event";
