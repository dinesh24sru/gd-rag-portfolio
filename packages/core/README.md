# `packages/core`

Domain and application layer.

## Owns

* Tenant authorization rules
* Document ingestion use cases
* Retrieval → confidence gate → LLM → citation flow
* Provider interfaces (`VectorStore`, `EmbeddingProvider`, `LLMProvider`, `DocumentStore`)

## Must not own

* AWS SDK / Qdrant SDK / Bedrock SDK usage
* HTTP or Lambda event parsing
* SAM / infrastructure definitions

Place source under `src/` when implementation begins.

## Auth helpers

* `createAuthContextFromClaims` — maps verified JWT claims to `AuthContext` with `tenantId = sub`
* `assertSameTenant` — blocks cross-tenant resource access

## Document upload

* `createUpload` — validate type/size, persist `PENDING` metadata, return presigned PUT target
* `listDocuments` / `getDocument` — tenant-scoped reads via `DocumentRepository`
