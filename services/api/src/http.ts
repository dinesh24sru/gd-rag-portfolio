import type { APIGatewayProxyResultV2 } from "aws-lambda";
import {
  AppError,
  QuotaExceededError,
  logError,
  logWarn,
  type ApiErrorBody,
  type ChatUsageSnapshot,
} from "@gd-rag/shared";

const DEFAULT_HEADERS = {
  "content-type": "application/json",
} as const;

export type ApiErrorResponseBody = ApiErrorBody & {
  usage?: ChatUsageSnapshot;
};

export function jsonResponse(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { ...DEFAULT_HEADERS, ...headers },
    body: JSON.stringify(body),
  };
}

export function ok(body: unknown): APIGatewayProxyResultV2 {
  return jsonResponse(200, body);
}

export function noContent(): APIGatewayProxyResultV2 {
  return {
    statusCode: 204,
    headers: { ...DEFAULT_HEADERS },
    body: "",
  };
}

export function errorResponse(
  error: unknown,
  context: Record<string, unknown> = {},
): APIGatewayProxyResultV2 {
  if (error instanceof AppError) {
    logWarn("api.error", {
      ...context,
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
    });
    const body: ApiErrorResponseBody = {
      error: {
        code: error.code,
        message: error.message,
      },
    };
    if (error instanceof QuotaExceededError) {
      body.usage = error.usage;
    }
    return jsonResponse(error.statusCode, body);
  }

  logError("api.unhandled_error", {
    ...context,
    error: error instanceof Error ? error.message : String(error),
  });
  const body: ApiErrorBody = {
    error: {
      code: "INTERNAL",
      message: "Internal server error",
    },
  };
  return jsonResponse(500, body);
}
