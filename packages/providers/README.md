# `packages/providers`

Provider implementations behind `packages/core` interfaces.

## Expected adapters

* `QdrantVectorStore`
* `BedrockEmbeddingProvider`
* `BedrockLLMProvider`
* S3 document object access
* DynamoDB metadata/session/usage stores

## Rules

* Depend on `packages/core` interfaces.
* Do not encode business policy here (tenant rules, abstention thresholds, prompt policy live in core).

Place source under `src/` when implementation begins.
