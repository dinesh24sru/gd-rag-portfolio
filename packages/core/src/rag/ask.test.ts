import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QuotaExceededError, type ChatUsageSnapshot } from "@gd-rag/shared";
import type { EmbeddingProvider, SearchResult, VectorStore } from "../ingestion/ports";
import type { LLMProvider } from "../llm/ports";
import type { UsageRepository } from "../usage/ports";
import { ask } from "./ask";
import { DEFAULT_RAG_CONFIG } from "./config";

function memoryUsage(
  initial?: ChatUsageSnapshot,
): UsageRepository & { rows: Map<string, ChatUsageSnapshot> } {
  const rows = new Map<string, ChatUsageSnapshot>();
  if (initial) {
    rows.set("t1:2026-10", initial);
  }
  const key = (tenantId: string, period: string) => `${tenantId}:${period}`;
  return {
    rows,
    async getChatUsage(tenantId, period) {
      return rows.get(key(tenantId, period)) ?? null;
    },
    async tryConsumeChatTokens(params) {
      const k = key(params.tenantId, params.period);
      const prev = rows.get(k);
      const used = (prev?.usedTokens ?? 0) + params.deltaTokens;
      if (used > params.quotaTokens) {
        throw new QuotaExceededError("quota", {
          period: params.period,
          usedTokens: prev?.usedTokens ?? 0,
          quotaTokens: params.quotaTokens,
          remainingTokens: Math.max(
            0,
            params.quotaTokens - (prev?.usedTokens ?? 0),
          ),
        });
      }
      const next = {
        period: params.period,
        usedTokens: used,
        quotaTokens: params.quotaTokens,
        remainingTokens: Math.max(0, params.quotaTokens - used),
      };
      rows.set(k, next);
      return next;
    },
  };
}

function embeddings(
  vectors: number[][] = [[0.1, 0.2, 0.3]],
): EmbeddingProvider & { calls: number } {
  const provider = {
    calls: 0,
    async embed() {
      provider.calls += 1;
      return vectors;
    },
  };
  return provider;
}

function vectors(
  hits: SearchResult[],
): VectorStore & { lastTenantId?: string } {
  const store: VectorStore & { lastTenantId?: string } = {
    async upsert() {},
    async search(request) {
      store.lastTenantId = request.tenantId;
      return hits;
    },
    async deleteDocument() {},
  };
  return store;
}

describe("ask", () => {
  const auth = { tenantId: "t1", sub: "t1" };
  const now = () => new Date("2026-10-07T12:00:00.000Z");
  const config = { ...DEFAULT_RAG_CONFIG, minScore: 0.35, maxQuestionChars: 100 };

  it("abstains at the gate without calling the LLM or consuming tokens", async () => {
    let llmCalls = 0;
    const llm: LLMProvider = {
      async generate() {
        llmCalls += 1;
        return { text: "should not run" };
      },
    };
    const usage = memoryUsage();
    const result = await ask(
      auth,
      { question: "What color are widgets?" },
      {
        embeddings: embeddings(),
        vectors: vectors([
          {
            chunkId: "c1",
            documentId: "d1",
            version: 1,
            text: "noise",
            score: 0.1,
          },
        ]),
        llm,
        usage: { usage, quotaTokens: 1000, now },
        config,
      },
    );
    assert.equal(result.abstained, true);
    assert.equal(llmCalls, 0);
    assert.equal(result.usage.usedTokens, 0);
    assert.equal(result.citations.length, 0);
  });

  it("abstains on empty retrieval without LLM", async () => {
    let llmCalls = 0;
    const result = await ask(
      auth,
      { question: "Anything?" },
      {
        embeddings: embeddings(),
        vectors: vectors([]),
        llm: {
          async generate() {
            llmCalls += 1;
            return { text: "nope" };
          },
        },
        usage: { usage: memoryUsage(), quotaTokens: 1000, now },
        config,
      },
    );
    assert.equal(result.abstained, true);
    assert.equal(llmCalls, 0);
    assert.equal(result.usage.usedTokens, 0);
  });

  it("generates with citations and records chat usage", async () => {
    const llm: LLMProvider = {
      async generate(req) {
        assert.match(req.systemPrompt, /Answer ONLY/i);
        assert.match(req.userPrompt, /BEGIN CONTEXT/);
        assert.match(req.userPrompt, /END CONTEXT/);
        assert.match(req.userPrompt, /untrusted/i);
        return {
          text: "Widgets are blue [1].",
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        };
      },
    };
    const usage = memoryUsage();
    const result = await ask(
      auth,
      { question: "What color are widgets?" },
      {
        embeddings: embeddings(),
        vectors: vectors([
          {
            chunkId: "c1",
            documentId: "d1",
            version: 1,
            text: "Widgets are blue.",
            score: 0.9,
          },
        ]),
        llm,
        usage: { usage, quotaTokens: 1000, now },
        config,
      },
    );
    assert.equal(result.abstained, false);
    assert.match(result.answer, /blue/i);
    assert.equal(result.citations.length, 1);
    assert.equal(result.citations[0]?.chunkId, "c1");
    assert.equal(result.usage.usedTokens, 30);
    assert.equal(result.usage.remainingTokens, 970);
  });

  it("scopes vector search to auth.tenantId only", async () => {
    const store = vectors([
      {
        chunkId: "c1",
        documentId: "d1",
        version: 1,
        text: "ok",
        score: 0.9,
      },
    ]);
    await ask(
      { tenantId: "tenant-A", sub: "tenant-A" },
      { question: "hello?" },
      {
        embeddings: embeddings(),
        vectors: store,
        llm: {
          async generate() {
            return {
              text: "ok [1]",
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            };
          },
        },
        usage: { usage: memoryUsage(), quotaTokens: 1000, now },
        config,
      },
    );
    assert.equal(store.lastTenantId, "tenant-A");
  });

  it("rejects exhausted quota before embedding", async () => {
    const emb = embeddings();
    let searchCalls = 0;
    await assert.rejects(
      () =>
        ask(
          auth,
          { question: "What color?" },
          {
            embeddings: emb,
            vectors: {
              async upsert() {},
              async search() {
                searchCalls += 1;
                return [];
              },
              async deleteDocument() {},
            },
            llm: { async generate() { return { text: "x" }; } },
            usage: {
              usage: memoryUsage({
                period: "2026-10",
                usedTokens: 1000,
                quotaTokens: 1000,
                remainingTokens: 0,
              }),
              quotaTokens: 1000,
              now,
            },
            config,
          },
        ),
      (err: unknown) => err instanceof QuotaExceededError,
    );
    assert.equal(emb.calls, 0);
    assert.equal(searchCalls, 0);
  });

  it("records tokens when the LLM abstains", async () => {
    const usage = memoryUsage();
    const result = await ask(
      auth,
      { question: "What color?" },
      {
        embeddings: embeddings(),
        vectors: vectors([
          {
            chunkId: "c1",
            documentId: "d1",
            version: 1,
            text: "unrelated",
            score: 0.8,
          },
        ]),
        llm: {
          async generate() {
            return {
              text: "ABSTAIN: Not supported by the documents.",
              usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
            };
          },
        },
        usage: { usage, quotaTokens: 1000, now },
        config,
      },
    );
    assert.equal(result.abstained, true);
    assert.match(result.answer, /Not supported/);
    assert.equal(result.usage.usedTokens, 16);
  });

  it("rejects empty questions", async () => {
    await assert.rejects(
      () =>
        ask(
          auth,
          { question: "   " },
          {
            embeddings: embeddings(),
            vectors: vectors([]),
            llm: { async generate() { return { text: "x" }; } },
            usage: { usage: memoryUsage(), quotaTokens: 1000, now },
            config,
          },
        ),
      /question is required/,
    );
  });

  it("rejects oversized questions", async () => {
    await assert.rejects(
      () =>
        ask(
          auth,
          { question: "x".repeat(101) },
          {
            embeddings: embeddings(),
            vectors: vectors([]),
            llm: { async generate() { return { text: "x" }; } },
            usage: { usage: memoryUsage(), quotaTokens: 1000, now },
            config,
          },
        ),
      /at most 100 characters/,
    );
  });

  it("fails fast on empty embedding vectors", async () => {
    await assert.rejects(
      () =>
        ask(
          auth,
          { question: "What color?" },
          {
            embeddings: embeddings([]),
            vectors: vectors([]),
            llm: { async generate() { return { text: "x" }; } },
            usage: { usage: memoryUsage(), quotaTokens: 1000, now },
            config,
          },
        ),
      /empty query vector/,
    );
  });
});
