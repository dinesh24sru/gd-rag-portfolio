import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createVoyageEmbeddingProvider } from "./embeddings";

describe("createVoyageEmbeddingProvider", () => {
  it("rejects empty api key", () => {
    assert.throws(
      () => createVoyageEmbeddingProvider({ apiKey: "  ", dimensions: 1024 }),
      /Voyage API key is required/,
    );
  });

  it("posts batched embeddings and returns ordered vectors", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({
          data: [
            { embedding: [0.1, 0.2], index: 1 },
            { embedding: [0.3, 0.4], index: 0 },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const provider = createVoyageEmbeddingProvider({
      apiKey: "test-key",
      dimensions: 2,
      modelId: "voyage-4-lite",
      batchSize: 10,
      fetchImpl,
    });

    const vectors = await provider.embed(["a", "b"]);
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.url, /\/embeddings$/);
    assert.deepEqual(calls[0]!.body, {
      input: ["a", "b"],
      model: "voyage-4-lite",
      output_dimension: 2,
      truncation: true,
      input_type: "document",
    });
    assert.deepEqual(vectors, [
      [0.3, 0.4],
      [0.1, 0.2],
    ]);
  });

  it("surfaces non-OK responses", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("rate limited", { status: 429 });
    const provider = createVoyageEmbeddingProvider({
      apiKey: "test-key",
      dimensions: 2,
      fetchImpl,
    });
    await assert.rejects(
      () => provider.embed(["hi"]),
      /Voyage embeddings failed \(429\)/,
    );
  });
});
