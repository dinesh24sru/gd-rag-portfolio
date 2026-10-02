import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { NotFoundError } from "@gd-rag/shared";
import { extractAuthContext } from "./auth";
import { errorResponse, ok } from "./http";

function routeKey(event: APIGatewayProxyEventV2): string {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath || "/";
  return `${method} ${path}`;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    switch (routeKey(event)) {
      case "GET /health":
        return ok({ ok: true });

      case "GET /me": {
        const auth = extractAuthContext(event);
        return ok({
          tenantId: auth.tenantId,
          sub: auth.sub,
          email: auth.email ?? null,
        });
      }

      default:
        throw new NotFoundError(`Route not found: ${routeKey(event)}`);
    }
  } catch (error) {
    return errorResponse(error);
  }
};
