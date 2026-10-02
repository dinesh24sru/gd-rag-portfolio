import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createAuthContextFromClaims, type AuthContext } from "@gd-rag/core";
import { UnauthorizedError, type AuthClaims } from "@gd-rag/shared";

type JwtAuthorizerContext = {
  jwt?: {
    claims?: Record<string, string>;
  };
};

/**
 * Extract AuthContext from API Gateway HTTP API JWT authorizer claims.
 * Signature verification is done by API Gateway; this only maps claims → tenant.
 */
export function extractAuthContext(event: APIGatewayProxyEventV2): AuthContext {
  const authorizer = event.requestContext.authorizer as JwtAuthorizerContext | undefined;
  const claims = authorizer?.jwt?.claims;

  if (!claims) {
    throw new UnauthorizedError("Missing JWT authorizer claims");
  }

  return createAuthContextFromClaims(claims as AuthClaims);
}
