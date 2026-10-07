import {
  ValidationError,
  logInfo,
  logWarn,
  type AskRequest,
  type AskResponse,
} from "@gd-rag/shared";
import type { AuthContext } from "../auth/context";
import type { EmbeddingProvider, VectorStore } from "../ingestion/ports";
import type { LLMProvider } from "../llm/ports";
import {
  assertChatQuota,
  getChatUsage,
  type ChatUsageDeps,
} from "../usage/chatUsage";
import { withChatQuota } from "../usage/withChatQuota";
import { parseGroundedAnswer } from "./citations";
import { evaluateRetrievalConfidence } from "./confidenceGate";
import {
  DEFAULT_RAG_CONFIG,
  resolveRagConfig,
  type RagConfig,
} from "./config";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";

export type AskDeps = {
  embeddings: EmbeddingProvider;
  vectors: VectorStore;
  llm: LLMProvider;
  usage: ChatUsageDeps;
  config?: RagConfig;
};

const GATE_ABSTAIN_MESSAGE =
  "I could not find enough support in your documents to answer that.";

/**
 * Tenant-scoped RAG ask: embed → retrieve → confidence gate → generate or abstain.
 * LLM calls are wrapped in chat quota accounting; gate abstentions do not consume tokens.
 */
export async function ask(
  auth: AuthContext,
  input: AskRequest,
  deps: AskDeps,
): Promise<AskResponse> {
  const config = deps.config ?? resolveRagConfig();
  const question = normalizeQuestion(input.question, config.maxQuestionChars);

  logInfo("rag.ask_start", {
    tenantId: auth.tenantId,
    questionChars: question.length,
    topK: config.topK,
    minScore: config.minScore,
  });

  await assertChatQuota(auth, deps.usage);

  logInfo("rag.embed_start", { tenantId: auth.tenantId });
  const [queryVector] = await deps.embeddings.embed([question]);
  if (!queryVector?.length) {
    throw new Error("Embedding provider returned an empty query vector");
  }
  logInfo("rag.embed_done", {
    tenantId: auth.tenantId,
    dimensions: queryVector.length,
  });

  logInfo("rag.search_start", {
    tenantId: auth.tenantId,
    topK: config.topK,
  });
  const results = await deps.vectors.search({
    tenantId: auth.tenantId,
    vector: queryVector,
    topK: config.topK,
  });
  logInfo("rag.search_done", {
    tenantId: auth.tenantId,
    hitCount: results.length,
    topScore: results[0]?.score ?? null,
  });

  const gate = evaluateRetrievalConfidence(results, config.minScore);
  if (!gate.ok) {
    logWarn("rag.abstain_gate", {
      tenantId: auth.tenantId,
      reason: gate.reason,
      hitCount: results.length,
      topScore: results[0]?.score ?? null,
      minScore: config.minScore,
    });
    const usage = await getChatUsage(auth, deps.usage);
    return {
      answer: GATE_ABSTAIN_MESSAGE,
      abstained: true,
      citations: [],
      usage,
    };
  }

  const evidence = gate.evidence.slice(0, config.topK);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    question,
    evidence,
    maxContextChars: config.maxContextChars,
    maxChunkChars: config.maxChunkChars,
  });

  logInfo("rag.generate_start", {
    tenantId: auth.tenantId,
    evidenceCount: evidence.length,
    maxOutputTokens: config.maxOutputTokens,
  });

  const { result, usage } = await withChatQuota(
    auth,
    deps.usage,
    async () => {
      const generated = await deps.llm.generate({
        systemPrompt,
        userPrompt,
        maxOutputTokens: config.maxOutputTokens,
      });
      const parsed = parseGroundedAnswer(
        generated.text,
        evidence,
        config.excerptChars,
      );
      return {
        answer: parsed.answer,
        abstained: parsed.abstained,
        citations: parsed.citations,
        usage: generated.usage,
      };
    },
  );

  logInfo("rag.ask_done", {
    tenantId: auth.tenantId,
    abstained: result.abstained,
    citationCount: result.citations.length,
    usedTokens: usage.usedTokens,
    remainingTokens: usage.remainingTokens,
  });

  return {
    answer: result.answer,
    abstained: result.abstained,
    citations: result.citations,
    usage,
  };
}

function normalizeQuestion(raw: string | undefined, maxChars: number): string {
  const question = raw?.trim() ?? "";
  if (!question) {
    throw new ValidationError("question is required");
  }
  if (question.length > maxChars) {
    throw new ValidationError(
      `question must be at most ${maxChars} characters`,
    );
  }
  return question;
}

export { DEFAULT_RAG_CONFIG };
