import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { handler } from "./handler";

function baseEvent(overrides: Partial<APIGatewayProxyEventV2> & {
  requestContext: APIGatewayProxyEventV2["requestContext"];
}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/",
    rawQueryString: "",
    headers: {},
    isBase64Encoded: false,
    ...overrides,
  } as APIGatewayProxyEventV2;
}

describe("handler routes", () => {
  it("GET /health returns ok without auth", async () => {
    const result = (await handler(
      baseEvent({
        rawPath: "/health",
        requestContext: {
          accountId: "123",
          apiId: "api",
          domainName: "example.execute-api.us-east-1.amazonaws.com",
          domainPrefix: "example",
          http: {
            method: "GET",
            path: "/health",
            protocol: "HTTP/1.1",
            sourceIp: "127.0.0.1",
            userAgent: "test",
          },
          requestId: "req",
          routeKey: "GET /health",
          stage: "$default",
          time: "01/Jan/2026:00:00:00 +0000",
          timeEpoch: 0,
        },
      }),
      {} as never,
      () => undefined,
    )) as APIGatewayProxyStructuredResultV2;

    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body ?? "{}"), { ok: true });
  });

  it("GET /me returns tenantId from JWT sub", async () => {
    const result = (await handler(
      baseEvent({
        rawPath: "/me",
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
          authorizer: {
            jwt: {
              claims: {
                sub: "tenant-xyz",
                email: "user@example.com",
              },
            },
          },
        },
      }),
      {} as never,
      () => undefined,
    )) as APIGatewayProxyStructuredResultV2;

    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body ?? "{}"), {
      tenantId: "tenant-xyz",
      sub: "tenant-xyz",
      email: "user@example.com",
    });
  });

  it("GET /me without claims returns 401", async () => {
    const result = (await handler(
      baseEvent({
        rawPath: "/me",
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
        },
      }),
      {} as never,
      () => undefined,
    )) as APIGatewayProxyStructuredResultV2;

    assert.equal(result.statusCode, 401);
  });
});
