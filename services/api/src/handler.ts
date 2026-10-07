import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  NotFoundError,
  ValidationError,
  logInfo,
  type CreateUploadRequest,
} from "@gd-rag/shared";
import { extractAuthContext } from "./auth";
import { errorResponse, noContent, ok } from "./http";
import { getApiWiring } from "./wiring";

function routeKey(event: APIGatewayProxyEventV2): string {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath || "/";
  return `${method} ${path}`;
}

function parseJsonBody<T>(event: APIGatewayProxyEventV2): T {
  if (!event.body) {
    throw new ValidationError("Request body is required");
  }
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const key = routeKey(event);
  try {
    switch (key) {
      case "GET /health":
        return ok({ ok: true });

      case "GET /me": {
        const auth = extractAuthContext(event);
        logInfo("api.me", { tenantId: auth.tenantId });
        return ok({
          tenantId: auth.tenantId,
          sub: auth.sub,
          email: auth.email ?? null,
        });
      }

      case "POST /documents/upload-url": {
        const auth = extractAuthContext(event);
        const body = parseJsonBody<CreateUploadRequest>(event);
        logInfo("api.upload_url_request", {
          tenantId: auth.tenantId,
          fileName: body.fileName,
          contentType: body.contentType,
          sizeBytes: body.sizeBytes,
          contentHash: body.contentHash,
        });
        const result = await getApiWiring().documents.createUpload(auth, body);
        logInfo("api.upload_url_ok", {
          tenantId: auth.tenantId,
          documentId: result.document.documentId,
          status: result.document.status,
        });
        return ok(result);
      }

      case "GET /documents": {
        const auth = extractAuthContext(event);
        const documents = await getApiWiring().documents.listDocuments(auth);
        logInfo("api.list_documents", {
          tenantId: auth.tenantId,
          count: documents.length,
        });
        return ok({ documents });
      }

      case "GET /usage": {
        const auth = extractAuthContext(event);
        const usage = await getApiWiring().usage.getUsage(auth);
        logInfo("api.get_usage", {
          tenantId: auth.tenantId,
          period: usage.period,
          used: usage.usedTokens,
          quota: usage.quotaTokens,
          remaining: usage.remainingTokens,
        });
        return ok(usage);
      }

      default: {
        const getMatch = /^GET \/documents\/([^/]+)$/.exec(key);
        if (getMatch) {
          const auth = extractAuthContext(event);
          const documentId = decodeURIComponent(getMatch[1] ?? "");
          const document = await getApiWiring().documents.getDocument(auth, documentId);
          logInfo("api.get_document", {
            tenantId: auth.tenantId,
            documentId: document.documentId,
            status: document.status,
          });
          return ok({ document });
        }

        const deleteMatch = /^DELETE \/documents\/([^/]+)$/.exec(key);
        if (deleteMatch) {
          const auth = extractAuthContext(event);
          const documentId = decodeURIComponent(deleteMatch[1] ?? "");
          logInfo("api.delete_document_request", {
            tenantId: auth.tenantId,
            documentId,
          });
          await getApiWiring().documents.deleteDocument(auth, documentId);
          logInfo("api.delete_document_ok", {
            tenantId: auth.tenantId,
            documentId,
          });
          return noContent();
        }

        throw new NotFoundError(`Route not found: ${key}`);
      }
    }
  } catch (error) {
    return errorResponse(error, { route: key });
  }
};
