# `packages/providers`

Provider implementations behind `packages/core` interfaces.

## Adapters

* `createDynamoDocumentRepository` — document metadata + status updates (DynamoDB on-demand)
* `createS3ObjectStorage` — presigned PUT, getObject, deleteObject
* `createBedrockEmbeddingProvider` — Titan text embeddings via Bedrock
* `createQdrantVectorStore` — tenant-filtered upsert/search/delete

## Rules

* Depend on `packages/core` interfaces.
* Do not encode business policy here (tenant rules, file limits live in core).
* Use AWS SDK v3 modular clients; reuse clients across Lambda invocations.
