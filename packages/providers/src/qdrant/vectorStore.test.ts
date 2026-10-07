import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chunkPointId,
  createQdrantVectorStore,
} from "./vectorStore";

type FakePoint = {
  id: string;
  score?: number;
  payload?: Record<string, unknown>;
};

/**
 * Mimics @qdrant/js-client-rest ≥1.19: query exists, search does not.
 */
function fakeQdrantClient(options?: {
  collections?: string[];
  queryPoints?: FakePoint[];
}) {
  const collections = new Set(options?.collections ?? ["gd-rag-chunks"]);
  const calls: { method: string; args: unknown[] }[] = [];

  const client = {
    calls,
    async getCollections() {
      calls.push({ method: "getCollections", args: [] });
      return { collections: [...collections].map((name) => ({ name })) };
    },
    async createCollection(name: string, body: unknown) {
      calls.push({ method: "createCollection", args: [name, body] });
      collections.add(name);
    },
    async createPayloadIndex(name: string, body: unknown) {
      calls.push({ method: "createPayloadIndex", args: [name, body] });
    },
    async upsert(name: string, body: unknown) {
      calls.push({ method: "upsert", args: [name, body] });
    },
    async query(name: string, body: unknown) {
      calls.push({ method: "query", args: [name, body] });
      return { points: options?.queryPoints ?? [] };
    },
    async delete(name: string, body: unknown) {
      calls.push({ method: "delete", args: [name, body] });
    },
    // Intentionally absent in 1.19 — calling this must never happen.
    search: undefined as unknown,
  };

  return client;
}

describe("createQdrantVectorStore (Qdrant 1.19 API)", () => {
  it("chunkPointId is a stable UUID-shaped id", () => {
    const a = chunkPointId("tenant/doc/0");
    const b = chunkPointId("tenant/doc/0");
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f-]{36}$/);
  });

  it("search uses client.query (not removed client.search) with tenant filter", async () => {
    const client = fakeQdrantClient({
      collections: ["gd-rag-chunks"],
      queryPoints: [
        {
          id: "p1",
          score: 0.91,
          payload: {
            chunkId: "c1",
            documentId: "d1",
            version: 1,
            text: "Widgets are blue.",
            tenantId: "t1",
          },
        },
      ],
    });

    const store = createQdrantVectorStore({
      url: "https://example.invalid",
      apiKey: "test",
      collection: "gd-rag-chunks",
      dimensions: 3,
      client: client as never,
    });

    const hits = await store.search({
      tenantId: "t1",
      vector: [0.1, 0.2, 0.3],
      topK: 5,
    });

    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.chunkId, "c1");
    assert.equal(hits[0]?.documentId, "d1");
    assert.equal(hits[0]?.score, 0.91);

    const queryCall = client.calls.find((c) => c.method === "query");
    assert.ok(queryCall, "expected client.query to be called");
    assert.equal(queryCall.args[0], "gd-rag-chunks");
    const body = queryCall.args[1] as {
      query: number[];
      limit: number;
      filter: { must: Array<{ key: string; match: { value: string } }> };
    };
    assert.deepEqual(body.query, [0.1, 0.2, 0.3]);
    assert.equal(body.limit, 5);
    assert.deepEqual(body.filter.must, [
      { key: "tenantId", match: { value: "t1" } },
    ]);
    assert.equal(
      client.calls.some((c) => c.method === "search"),
      false,
      "must not call removed client.search",
    );
  });

  it("upsert uses client.upsert with deterministic point ids", async () => {
    const client = fakeQdrantClient({ collections: ["gd-rag-chunks"] });
    const store = createQdrantVectorStore({
      url: "https://example.invalid",
      apiKey: "test",
      collection: "gd-rag-chunks",
      dimensions: 2,
      client: client as never,
    });

    await store.upsert([
      {
        chunkId: "chunk-a",
        tenantId: "t1",
        documentId: "d1",
        version: 1,
        index: 0,
        text: "hello",
        vector: [0.1, 0.2],
      },
    ]);

    const upsertCall = client.calls.find((c) => c.method === "upsert");
    assert.ok(upsertCall);
    const body = upsertCall.args[1] as {
      points: Array<{ id: string; payload: { tenantId: string } }>;
    };
    assert.equal(body.points[0]?.id, chunkPointId("chunk-a"));
    assert.equal(body.points[0]?.payload.tenantId, "t1");
  });

  it("deleteDocument filters by tenantId and documentId", async () => {
    const client = fakeQdrantClient({ collections: ["gd-rag-chunks"] });
    const store = createQdrantVectorStore({
      url: "https://example.invalid",
      apiKey: "test",
      collection: "gd-rag-chunks",
      dimensions: 2,
      client: client as never,
    });

    await store.deleteDocument("t1", "d1");

    const deleteCall = client.calls.find((c) => c.method === "delete");
    assert.ok(deleteCall);
    const body = deleteCall.args[1] as {
      filter: { must: Array<{ key: string; match: { value: string } }> };
    };
    assert.deepEqual(body.filter.must, [
      { key: "tenantId", match: { value: "t1" } },
      { key: "documentId", match: { value: "d1" } },
    ]);
  });

  it("exposes every Qdrant method we rely on (1.19 surface)", () => {
    const required = [
      "getCollections",
      "createCollection",
      "createPayloadIndex",
      "upsert",
      "query",
      "delete",
    ] as const;
    const client = fakeQdrantClient();
    for (const method of required) {
      assert.equal(typeof client[method], "function", `${method} missing`);
    }
    assert.equal(client.search, undefined, "search must stay unused (removed in 1.19)");
  });
});
