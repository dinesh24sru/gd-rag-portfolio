export type CognitoUser = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  provider: "Google";
};

export type CognitoSession = {
  user: CognitoUser;
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

const SESSION_KEY = "gd-rag.cognito.session";

type IdTokenClaims = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  identities?: Array<{ providerName?: string }>;
};

function decodeJwtPayload(token: string): IdTokenClaims {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid ID token");
  }

  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(atob(padded)) as IdTokenClaims;
}

export function userFromIdToken(idToken: string): CognitoUser {
  const claims = decodeJwtPayload(idToken);
  if (!claims.sub) {
    throw new Error("ID token missing sub claim");
  }

  const providerName = claims.identities?.[0]?.providerName;
  if (providerName && providerName.toLowerCase() !== "google") {
    throw new Error(`Unsupported identity provider: ${providerName}`);
  }

  return {
    sub: claims.sub,
    email: claims.email ?? "",
    name: claims.name ?? claims.email ?? "User",
    picture: claims.picture,
    provider: "Google",
  };
}

export function saveSession(session: CognitoSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getStoredSession(): CognitoSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as CognitoSession;
    if (!session?.user?.sub || !session.idToken || !session.accessToken) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function isSessionExpired(session: CognitoSession, skewMs = 30_000): boolean {
  return Date.now() >= session.expiresAt - skewMs;
}
