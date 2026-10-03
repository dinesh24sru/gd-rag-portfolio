const PKCE_VERIFIER_KEY = "gd-rag.cognito.pkce.verifier";
const OAUTH_STATE_KEY = "gd-rag.cognito.oauth.state";
const POST_LOGIN_NEXT_KEY = "gd-rag.cognito.post.login.next";

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  view.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function createPkceChallenge(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = randomString(32);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return {
    verifier,
    challenge: toBase64Url(digest),
  };
}

export function createOAuthState(): string {
  return randomString(16);
}

export function storePkceSession(params: {
  verifier: string;
  state: string;
  nextPath: string;
}): void {
  sessionStorage.setItem(PKCE_VERIFIER_KEY, params.verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, params.state);
  sessionStorage.setItem(POST_LOGIN_NEXT_KEY, params.nextPath);
}

export function peekPkceSession(): {
  verifier: string;
  state: string;
  nextPath: string;
} | null {
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  const state = sessionStorage.getItem(OAUTH_STATE_KEY);
  const nextPath = sessionStorage.getItem(POST_LOGIN_NEXT_KEY) || "/home";

  if (!verifier || !state) {
    return null;
  }

  return { verifier, state, nextPath };
}

/** Clear PKCE material only after a successful token exchange. */
export function clearPkceSession(): void {
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(POST_LOGIN_NEXT_KEY);
}
