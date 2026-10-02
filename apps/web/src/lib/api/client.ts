import { getAccessToken } from "@/lib/auth/cognito";
import { clearSession } from "@/lib/auth/session";

export type MeResponse = {
  tenantId: string;
  sub: string;
  email: string | null;
};

export type ApiClientError = {
  status: number;
  code?: string;
  message: string;
};

function getApiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set. Deploy the SAM stack and copy ApiBaseUrl into .env.local.",
    );
  }
  return base.replace(/\/$/, "");
}

export function isApiConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_BASE_URL?.trim());
}

async function parseError(response: Response): Promise<ApiClientError> {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string };
    };
    return {
      status: response.status,
      code: body.error?.code,
      message: body.error?.message ?? response.statusText,
    };
  } catch {
    return {
      status: response.status,
      message: response.statusText || "Request failed",
    };
  }
}

/**
 * Authenticated fetch against the GroundedRAG HTTP API.
 * Sends Cognito access token; on 401 clears local session and redirects to login.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    clearSession();
    window.location.assign("/login");
    throw { status: 401, message: "Not signed in" } satisfies ApiClientError;
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(`${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    clearSession();
    const next = encodeURIComponent(window.location.pathname || "/home");
    window.location.assign(`/login?next=${next}`);
    throw await parseError(response);
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me");
}
