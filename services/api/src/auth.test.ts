import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { UnauthorizedError } from "@gd-rag/shared";
import { extractAuthContext } from "./auth";

function eventWithClaims(claims?: Record<string, string>): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "GET /me",
    rawPath: "/me",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123",
      apiId: "api",
      domainName: "example.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "example",
      http: {
        method: "GET",
        path: "/me",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "req",
      routeKey: "GET /me",
      stage: "$default",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 0,
      authorizer: claims
        ? {
            jwt: {
              claims,
            },
          }
        : undefined,
    },
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe("extractAuthContext", () => {
  it("derives tenantId from JWT sub", () => {
    const auth = extractAuthContext(
      eventWithClaims({ sub: "abc-123", email: "a@example.com" }),
    );
    assert.equal(auth.tenantId, "abc-123");
    assert.equal(auth.email, "a@example.com");
  });

  it("rejects missing authorizer claims", () => {
    assert.throws(
      () => extractAuthContext(eventWithClaims(undefined)),
      (error: unknown) => error instanceof UnauthorizedError,
    );
  });
});
