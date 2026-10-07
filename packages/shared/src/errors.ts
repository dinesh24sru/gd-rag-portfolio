import type { ApiErrorCode } from "./auth";
import type { ChatUsageSnapshot } from "./usage";

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;

  constructor(code: ApiErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super("NOT_FOUND", message, 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request") {
    super("BAD_REQUEST", message, 400);
    this.name = "ValidationError";
  }
}

/** Tenant chat token quota exhausted for the current period. */
export class QuotaExceededError extends AppError {
  readonly usage: ChatUsageSnapshot;

  constructor(message: string, usage: ChatUsageSnapshot) {
    super("QUOTA_EXCEEDED", message, 429);
    this.name = "QuotaExceededError";
    this.usage = usage;
  }
}

/** Upstream model/embedding provider overloaded or rate-limited after bounded retries. */
export class ProviderUnavailableError extends AppError {
  constructor(
    message = "The AI provider is temporarily unavailable. Please try again in a moment.",
  ) {
    super("PROVIDER_UNAVAILABLE", message, 503);
    this.name = "ProviderUnavailableError";
  }
}

/** Permanent ingestion failure — do not retry via SQS; mark document FAILED. */
export class PermanentIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentIngestionError";
  }
}
