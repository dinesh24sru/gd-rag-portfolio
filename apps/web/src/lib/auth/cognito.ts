import { getCognitoConfig } from "@/lib/auth/config";
import {
  consumePkceSession,
  createOAuthState,
  createPkceChallenge,
  storePkceSession,
} from "@/lib/auth/pkce";
import {
  clearSession,
  getStoredSession,
  saveSession,
  userFromIdToken,
  type CognitoSession,
  type CognitoUser,
} from "@/lib/auth/session";

export type { CognitoUser, CognitoSession };

type TokenResponse = {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

/**
 * Start Google sign-in via Cognito Hosted UI (Authorization Code + PKCE).
 * Redirects the browser; does not return a user synchronously.
 */
export async function beginGoogleSignIn(nextPath = "/home"): Promise<void> {
  const config = getCognitoConfig();
  const { verifier, challenge } = await createPkceChallenge();
  const state = createOAuthState();

  storePkceSession({
    verifier,
    state,
    nextPath: nextPath.startsWith("/") ? nextPath : "/home",
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: config.redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
    identity_provider: "Google",
  });

  window.location.assign(`https://${config.domain}/oauth2/authorize?${params.toString()}`);
}

/**
 * Exchange authorization code for tokens after Cognito redirects to /auth/callback.
 */
export async function completeSignInFromCallback(params: {
  code: string;
  state: string;
}): Promise<{ user: CognitoUser; nextPath: string }> {
  const config = getCognitoConfig();
  const pkce = consumePkceSession();

  if (!pkce) {
    throw new Error("Missing PKCE session. Start sign-in again from the login page.");
  }

  if (pkce.state !== params.state) {
    throw new Error("OAuth state mismatch. Start sign-in again.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code: params.code,
    redirect_uri: config.redirectUri,
    code_verifier: pkce.verifier,
  });

  const response = await fetch(`https://${config.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${detail}`);
  }

  const tokens = (await response.json()) as TokenResponse;
  const user = userFromIdToken(tokens.id_token);

  const session: CognitoSession = {
    user,
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };

  saveSession(session);
  return { user, nextPath: pkce.nextPath };
}

export function getStoredCognitoSession(): CognitoUser | null {
  return getStoredSession()?.user ?? null;
}

export function getAccessToken(): string | null {
  return getStoredSession()?.accessToken ?? null;
}

export function getIdToken(): string | null {
  return getStoredSession()?.idToken ?? null;
}

/**
 * Clear local session and redirect to Cognito logout (ends Hosted UI session).
 */
export function signOutCognito(): void {
  clearSession();

  let config;
  try {
    config = getCognitoConfig();
  } catch {
    window.location.assign("/login");
    return;
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.logoutUri,
  });

  window.location.assign(`https://${config.domain}/logout?${params.toString()}`);
}
