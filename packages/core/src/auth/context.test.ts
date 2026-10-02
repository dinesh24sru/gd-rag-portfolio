import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForbiddenError, UnauthorizedError } from "@gd-rag/shared";
import { assertSameTenant, createAuthContextFromClaims } from "./context";

describe("createAuthContextFromClaims", () => {
  it("maps Cognito sub to tenantId", () => {
    const auth = createAuthContextFromClaims({
      sub: "user-123",
      email: "user@example.com",
    });

    assert.equal(auth.tenantId, "user-123");
    assert.equal(auth.sub, "user-123");
    assert.equal(auth.email, "user@example.com");
  });

  it("rejects missing sub", () => {
    assert.throws(
      () => createAuthContextFromClaims({ email: "user@example.com" }),
      (error: unknown) => error instanceof UnauthorizedError,
    );
  });

  it("rejects blank sub", () => {
    assert.throws(
      () => createAuthContextFromClaims({ sub: "   " }),
      (error: unknown) => error instanceof UnauthorizedError,
    );
  });

  it("ignores any client-supplied tenantId field on claims object", () => {
    const claims = {
      sub: "real-sub",
      tenantId: "attacker-tenant",
    } as Record<string, string>;

    const auth = createAuthContextFromClaims(claims);
    assert.equal(auth.tenantId, "real-sub");
    assert.notEqual(auth.tenantId, "attacker-tenant");
  });
});

describe("assertSameTenant", () => {
  const auth = createAuthContextFromClaims({ sub: "tenant-a" });

  it("allows matching tenant", () => {
    assert.doesNotThrow(() => assertSameTenant("tenant-a", auth));
  });

  it("forbids cross-tenant access", () => {
    assert.throws(
      () => assertSameTenant("tenant-b", auth),
      (error: unknown) => error instanceof ForbiddenError,
    );
  });
});
