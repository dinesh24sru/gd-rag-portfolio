import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProviderUnavailableError } from "@gd-rag/shared";
import { createGeminiLLMProvider } from "./llm";

describe("createGeminiLLMProvider", () => {
  it("rejects empty api key", () => {
    assert.throws(
      () => createGeminiLLMProvider({ apiKey: "" }),
      /Gemini API key is required/,
    );
  });

  it("calls generateContent and returns text", async () => {
    let url = "";
    let body: unknown;
    const fetchImpl: typeof fetch = async (input, init) => {
      url = String(input);
      body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "Grounded answer" }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 4,
            totalTokenCount: 14,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const provider = createGeminiLLMProvider({
      apiKey: "gem-key",
      modelId: "gemini-3.8-flash",
      fetchImpl,
    });

    const result = await provider.generate({
      systemPrompt: "Only use context.",
      userPrompt: "What is X?",
      maxOutputTokens: 128,
    });

    assert.match(url, /models\/gemini-3\.8-flash:generateContent/);
    assert.match(url, /key=gem-key/);
    assert.deepEqual(body, {
      systemInstruction: { parts: [{ text: "Only use context." }] },
      contents: [{ role: "user", parts: [{ text: "What is X?" }] }],
      generationConfig: { maxOutputTokens: 128, temperature: 0.2 },
    });
    assert.equal(result.text, "Grounded answer");
    assert.deepEqual(result.usage, {
      inputTokens: 10,
      outputTokens: 4,
      totalTokens: 14,
    });
  });

  it("retries transient 503 then succeeds", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls < 3) {
        return new Response(
          JSON.stringify({
            error: { message: "high demand", status: "UNAVAILABLE" },
          }),
          { status: 503 },
        );
      }
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "ok after retry" }] } }],
          usageMetadata: {
            promptTokenCount: 1,
            candidatesTokenCount: 1,
            totalTokenCount: 2,
          },
        }),
        { status: 200 },
      );
    };

    const provider = createGeminiLLMProvider({
      apiKey: "gem-key",
      fetchImpl,
      sleepImpl: async () => undefined,
    });

    const result = await provider.generate({
      systemPrompt: "sys",
      userPrompt: "user",
    });
    assert.equal(result.text, "ok after retry");
    assert.equal(calls, 3);
  });

  it("maps exhausted 503 retries to ProviderUnavailableError", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("busy", { status: 503 });
    const provider = createGeminiLLMProvider({
      apiKey: "gem-key",
      fetchImpl,
      sleepImpl: async () => undefined,
    });
    await assert.rejects(
      () =>
        provider.generate({
          systemPrompt: "sys",
          userPrompt: "user",
        }),
      (err: unknown) =>
        err instanceof ProviderUnavailableError && err.statusCode === 503,
    );
  });

  it("does not retry permanent 403 errors", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("quota", { status: 403 });
    };
    const provider = createGeminiLLMProvider({
      apiKey: "gem-key",
      fetchImpl,
      sleepImpl: async () => undefined,
    });
    await assert.rejects(
      () =>
        provider.generate({
          systemPrompt: "sys",
          userPrompt: "user",
        }),
      /Gemini generateContent failed \(403\)/,
    );
    assert.equal(calls, 1);
  });
});
