import { createHash } from "node:crypto";
import { ValidationError } from "@gd-rag/shared";

const SHA256_HEX = /^[a-f0-9]{64}$/;

/** Normalize and validate a client-supplied SHA-256 hex digest. */
export function normalizeContentHash(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new ValidationError("contentHash is required");
  }
  const value = raw.trim().toLowerCase();
  if (!SHA256_HEX.test(value)) {
    throw new ValidationError("contentHash must be a SHA-256 hex digest");
  }
  return value;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
