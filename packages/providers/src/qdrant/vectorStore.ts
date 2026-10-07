import { createHash } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import type { SearchResult, VectorChunk, VectorStore } from "@gd-rag/core";

export type QdrantVectorStoreOptions = {
  url: string;
  apiKey: string;
  collection: string;
  dimensions: number;
  client?: QdrantClient;
};

let ensuredCollections = new Set<string>();

/** Deterministic UUID from chunkId for Qdrant point IDs. */
export function chunkPointId(chunkId: string): string {
  const hex = createHash("sha256").update(chunkId).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "5" + hex.slice(13, 16),
    "a" + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** Payload fields used in tenant/document filters (required under Qdrant strict mode). */
const FILTER_PAYLOAD_INDEXES = ["tenantId", "documentId"] as const;

async function ensurePayloadIndexes(
  client: QdrantClient,
  collection: string,
): Promise<void> {
  for (const fieldName of FILTER_PAYLOAD_INDEXES) {
    try {
      await client.createPayloadIndex(collection, {
        wait: true,
        field_name: fieldName,
        field_schema: "keyword",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Index may already exist from a prior ensure / console setup.
      if (!/already exists|duplicate/i.test(message)) {
        throw err;
      }
    }
  }
}

async function ensureCollection(
  client: QdrantClient,
  collection: string,
  dimensions: number,
): Promise<void> {
  const key = `${collection}:${dimensions}`;
  if (ensuredCollections.has(key)) {
    return;
  }
  const existing = await client.getCollections();
  const found = existing.collections?.some((c) => c.name === collection);
  if (!found) {
    await client.createCollection(collection, {
      vectors: {
        size: dimensions,
        distance: "Cosine",
      },
    });
  }
  await ensurePayloadIndexes(client, collection);
  ensuredCollections.add(key);
}

export function createQdrantVectorStore(options: QdrantVectorStoreOptions): VectorStore {
  const client =
    options.client ??
    new QdrantClient({
      url: options.url,
      apiKey: options.apiKey,
      checkCompatibility: false,
    });

  return {
    async upsert(chunks: VectorChunk[]): Promise<void> {
      if (chunks.length === 0) {
        return;
      }
      await ensureCollection(client, options.collection, options.dimensions);
      await client.upsert(options.collection, {
        wait: true,
        points: chunks.map((chunk) => ({
          id: chunkPointId(chunk.chunkId),
          vector: chunk.vector,
          payload: {
            tenantId: chunk.tenantId,
            documentId: chunk.documentId,
            version: chunk.version,
            chunkId: chunk.chunkId,
            index: chunk.index,
            text: chunk.text,
          },
        })),
      });
    },

    async search(request): Promise<SearchResult[]> {
      if (typeof client.query !== "function") {
        throw new Error(
          "Qdrant client missing query(); upgrade @qdrant/js-client-rest or stop using removed search()",
        );
      }
      await ensureCollection(client, options.collection, options.dimensions);
      // @qdrant/js-client-rest 1.19 removed search(); query() returns { points }.
      const result = await client.query(options.collection, {
        query: request.vector,
        limit: request.topK,
        with_payload: true,
        filter: {
          must: [{ key: "tenantId", match: { value: request.tenantId } }],
        },
      });
      const points = result.points ?? [];
      return points
        .map((point) => {
          const payload = (point.payload ?? {}) as Record<string, unknown>;
          return {
            chunkId: String(payload.chunkId ?? point.id),
            documentId: String(payload.documentId ?? ""),
            version: Number(payload.version ?? 0),
            text: String(payload.text ?? ""),
            score: typeof point.score === "number" ? point.score : 0,
          };
        })
        .sort((a, b) => b.score - a.score);
    },

    async deleteDocument(tenantId: string, documentId: string): Promise<void> {
      const existing = await client.getCollections();
      const found = existing.collections?.some((c) => c.name === options.collection);
      if (!found) {
        return;
      }
      // Strict mode rejects filter deletes on unindexed payload fields.
      await ensurePayloadIndexes(client, options.collection);
      await client.delete(options.collection, {
        wait: true,
        filter: {
          must: [
            { key: "tenantId", match: { value: tenantId } },
            { key: "documentId", match: { value: documentId } },
          ],
        },
      });
    },
  };
}
