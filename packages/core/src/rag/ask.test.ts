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

function embeddings(): EmbeddingProvider {
  return {
    async embed() {
      return [[0.1, 0.2, 0.3]];
    },
  };
}

function vectors(hits: SearchResult[]): VectorStore {
  return {
    async upsert() {},
    async search() {
      return hits;
    },
    async deleteDocument() {},
  };
}

describe("ask", () => {
  const auth = { tenantId: "t1", sub: "t1" };
  const now = () => new Date("2026-10-07T12:00:00.000Z");
  const config = { ...DEFAULT_RAG_CONFIG, minScore: 0.35 };

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

  it("generates with citations and records chat usage", async () => {
    const llm: LLMProvider = {
      async generate(req) {
        assert.match(req.systemPrompt, /Answer ONLY/i);
        assert.match(req.userPrompt, /BEGIN CONTEXT/);
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
});
