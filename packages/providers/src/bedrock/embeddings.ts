import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { EmbeddingProvider } from "@gd-rag/core";

export type BedrockEmbeddingOptions = {
  modelId: string;
  dimensions: number;
  client?: BedrockRuntimeClient;
  /** Max characters per embed call (cost/timeout guard). */
  maxInputChars?: number;
};

let sharedClient: BedrockRuntimeClient | undefined;

function getClient(): BedrockRuntimeClient {
  if (!sharedClient) {
    sharedClient = new BedrockRuntimeClient({
      maxAttempts: 3,
    });
  }
  return sharedClient;
}

/**
 * Amazon Titan Text Embeddings V2 via Bedrock InvokeModel.
 * Embeds sequentially to keep portfolio cost/throttling predictable.
 */
export function createBedrockEmbeddingProvider(
  options: BedrockEmbeddingOptions,
): EmbeddingProvider {
  const client = options.client ?? getClient();
  const maxInputChars = options.maxInputChars ?? 8000;

  return {
    async embed(texts: string[]): Promise<number[][]> {
      const vectors: number[][] = [];
      for (const text of texts) {
        const inputText = text.slice(0, maxInputChars);
        const response = await client.send(
          new InvokeModelCommand({
            modelId: options.modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
              inputText,
              dimensions: options.dimensions,
              normalize: true,
            }),
          }),
        );
        const payload = JSON.parse(new TextDecoder().decode(response.body)) as {
          embedding?: number[];
        };
        if (!payload.embedding?.length) {
          throw new Error("Bedrock embedding response missing embedding");
        }
        vectors.push(payload.embedding);
      }
      return vectors;
    },
  };
}
