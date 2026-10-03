import { randomUUID } from "node:crypto";
import {
  ValidationError,
  type CreateUploadRequest,
  type CreateUploadResponse,
  type DocumentRecord,
} from "@gd-rag/shared";
import type { AuthContext } from "../auth/context";
import { buildDocumentObjectKey } from "./keys";
import {
  ALLOWED_CONTENT_TYPES,
  isAllowedContentType,
  MAX_UPLOAD_BYTES,
  PRESIGN_EXPIRES_SECONDS,
} from "./limits";
import type { DocumentRepository, ObjectStorage } from "./ports";

export type CreateUploadDeps = {
  documents: DocumentRepository;
  objects: ObjectStorage;
  now?: () => Date;
  idFactory?: () => string;
  maxUploadBytes?: number;
  presignExpiresSeconds?: number;
};

function sanitizeFileName(raw: string): string {
  const base = raw.trim().replace(/[/\\]/g, "").slice(0, 200);
  if (!base) {
    throw new ValidationError("fileName is required");
  }
  return base;
}

export async function createUpload(
  auth: AuthContext,
  input: CreateUploadRequest,
  deps: CreateUploadDeps,
): Promise<CreateUploadResponse> {
  const fileName = sanitizeFileName(input.fileName ?? "");
  const contentType = (input.contentType ?? "").trim().toLowerCase();
  const sizeBytes = Number(input.sizeBytes);
  const maxBytes = deps.maxUploadBytes ?? MAX_UPLOAD_BYTES;
  const expiresInSeconds = deps.presignExpiresSeconds ?? PRESIGN_EXPIRES_SECONDS;

  if (!isAllowedContentType(contentType)) {
    throw new ValidationError(
      `Unsupported contentType. Allowed: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
    );
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || !Number.isInteger(sizeBytes)) {
    throw new ValidationError("sizeBytes must be a positive integer");
  }

  if (sizeBytes > maxBytes) {
    throw new ValidationError(`File exceeds maximum size of ${maxBytes} bytes`);
  }

  const documentId = (deps.idFactory ?? randomUUID)();
  const version = 1;
  const now = (deps.now ?? (() => new Date))().toISOString();
  const s3Key = buildDocumentObjectKey({
    tenantId: auth.tenantId,
    documentId,
    version,
  });

  const document: DocumentRecord = {
    tenantId: auth.tenantId,
    documentId,
    version,
    fileName,
    contentType,
    sizeBytes,
    status: "PENDING",
    s3Key,
    createdAt: now,
    updatedAt: now,
  };

  await deps.documents.put(document);

  const uploadUrl = await deps.objects.presignPut({
    key: s3Key,
    contentType,
    contentLength: sizeBytes,
    expiresInSeconds,
  });

  return { document, uploadUrl, expiresInSeconds };
}
