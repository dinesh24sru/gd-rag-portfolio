import { ForbiddenError, UnauthorizedError, type AuthClaims } from "@gd-rag/shared";

/**
 * Authenticated request context derived only from verified JWT claims.
 * tenantId is always Cognito `sub` — never a client-supplied value.
 */
export type AuthContext = {
  tenantId: string;
  sub: string;
  email?: string;
};

/**
 * Build AuthContext from already-verified JWT claims.
 * Does not trust any client-supplied tenantId.
 */
export function createAuthContextFromClaims(claims: AuthClaims): AuthContext {
  const sub = claims.sub?.trim();
  if (!sub) {
    throw new UnauthorizedError("JWT missing required sub claim");
  }

  const email = claims.email?.trim() || undefined;

  return {
    tenantId: sub,
    sub,
    email,
  };
}

/**
 * Enforce that a resource belongs to the authenticated tenant.
 */
export function assertSameTenant(resourceTenantId: string, auth: AuthContext): void {
  if (!resourceTenantId || resourceTenantId !== auth.tenantId) {
    throw new ForbiddenError("Resource does not belong to the authenticated tenant");
  }
}
