# `packages/providers`

Provider implementations behind `packages/core` interfaces.

## Adapters

* `createDynamoDocumentRepository` — document metadata + status updates (DynamoDB on-demand)
* `createS3ObjectStorage` — presigned PUT, getObject, deleteObject
* `createVoyageEmbeddingProvider` — Voyage text embeddings via HTTPS (interim default)
* `createBedrockEmbeddingProvider` — Titan text embeddings via Bedrock (target)
* `createGeminiLLMProvider` — Gemini generateContent via HTTPS (interim ask)
* `createQdrantVectorStore` — tenant-filtered upsert/search/delete
* Planned: `createBedrockLLMProvider` (target ask)

See `docs/ARCHITECTURE.md` §11 for interim vs target model providers and env switch rules.

## Rules

* Depend on `packages/core` interfaces.
* Do not encode business policy here (tenant rules, file limits live in core).
* Use AWS SDK v3 modular clients for AWS; reuse clients across Lambda invocations.
* Keep Voyage/Gemini HTTP clients here too — never in `packages/core` or `apps/web`.
