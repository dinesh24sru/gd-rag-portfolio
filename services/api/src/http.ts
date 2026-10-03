import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { AppError, type ApiErrorBody } from "@gd-rag/shared";

const DEFAULT_HEADERS = {
  "content-type": "application/json",
} as const;

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

export function errorResponse(error: unknown): APIGatewayProxyResultV2 {
  if (error instanceof AppError) {
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        message: error.message,
      },
    };
    return jsonResponse(error.statusCode, body);
  }

  console.error("Unhandled error", error);
  const body: ApiErrorBody = {
    error: {
      code: "INTERNAL",
      message: "Internal server error",
    },
  };
  return jsonResponse(500, body);
}
