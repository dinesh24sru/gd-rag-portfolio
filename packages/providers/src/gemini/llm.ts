import type { LLMProvider, LLMRequest, LLMResponse } from "@gd-rag/core";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 512;

export type GeminiLLMOptions = {
  apiKey: string;
  modelId?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Provider default when request omits maxOutputTokens. */
  defaultMaxOutputTokens?: number;
  fetchImpl?: typeof fetch;
};

type GeminiPart = { text?: string };
type GeminiCandidate = {
  content?: { parts?: GeminiPart[] };
};
type GeminiGenerateResponse = {
  candidates?: GeminiCandidate[];
  error?: { message?: string };
};

/**
 * Google Gemini generateContent via HTTPS (no SDK — keeps Lambda bundles small).
 */
export function createGeminiLLMProvider(options: GeminiLLMOptions): LLMProvider {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("Gemini API key is required");
  }
  const modelId = options.modelId?.trim() || DEFAULT_MODEL;
  const baseUrl = (options.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const defaultMaxOutputTokens =
    options.defaultMaxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async generate(request: LLMRequest): Promise<LLMResponse> {
      const maxOutputTokens = request.maxOutputTokens ?? defaultMaxOutputTokens;
      const url =
        `${baseUrl}/models/${encodeURIComponent(modelId)}:generateContent` +
        `?key=${encodeURIComponent(apiKey)}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: request.systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: request.userPrompt }],
              },
            ],
            generationConfig: {
              maxOutputTokens,
              temperature: 0.2,
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await safeReadText(response);
          throw new Error(
            `Gemini generateContent failed (${response.status}): ${detail || response.statusText}`,
          );
        }

        const payload = (await response.json()) as GeminiGenerateResponse;
        if (payload.error?.message) {
          throw new Error(`Gemini generateContent error: ${payload.error.message}`);
        }
        const text = extractText(payload);
        if (!text) {
          throw new Error("Gemini generateContent response missing text");
        }
        return { text };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function extractText(payload: GeminiGenerateResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}
