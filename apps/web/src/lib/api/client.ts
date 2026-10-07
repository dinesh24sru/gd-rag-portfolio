import { getAccessToken } from "@/lib/auth/cognito";
import { clearSession } from "@/lib/auth/session";

export type MeResponse = {
  tenantId: string;
  sub: string;
  email: string | null;
};

export type DocumentStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

export type DocumentRecord = {
  tenantId: string;
  documentId: string;
  version: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  contentHash?: string;
  status: DocumentStatus;
  s3Key: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateUploadUrlResponse = {
  document: DocumentRecord;
  uploadUrl: string;
  expiresInSeconds: number;
};

export type ChatUsageSnapshot = {
  period: string;
  usedTokens: number;
  quotaTokens: number;
  remainingTokens: number;
};

export type Citation = {
  documentId: string;
  chunkId: string;
  score: number;
  excerpt: string;
};

export type AskResponse = {
  answer: string;
  abstained: boolean;
  citations: Citation[];
  usage: ChatUsageSnapshot;
};

export type ApiClientError = {
  status: number;
  code?: string;
  message: string;
  usage?: ChatUsageSnapshot;
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
      usage?: ChatUsageSnapshot;
    };
    return {
      status: response.status,
      code: body.error?.code,
      message: body.error?.message ?? response.statusText,
      usage: body.usage,
    };
  } catch {
    return {
      status: response.status,
      message: response.statusText || "Request failed",
    };
  }
}

/**
 * Authenticated fetch against the GD RAG HTTP API.
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

export async function createUploadUrl(input: {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  contentHash: string;
}): Promise<CreateUploadUrlResponse> {
  return apiFetch<CreateUploadUrlResponse>("/documents/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchUsage(): Promise<ChatUsageSnapshot> {
  return apiFetch<ChatUsageSnapshot>("/usage");
}

export async function askQuestion(question: string): Promise<AskResponse> {
  return apiFetch<AskResponse>("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const result = await apiFetch<{ documents: DocumentRecord[] }>("/documents");
  return result.documents;
}

export async function getDocument(documentId: string): Promise<DocumentRecord> {
  const result = await apiFetch<{ document: DocumentRecord }>(
    `/documents/${encodeURIComponent(documentId)}`,
  );
  return result.document;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await apiFetch<void>(`/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  });
}
