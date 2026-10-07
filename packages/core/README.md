# `packages/core`

Domain and application layer.

## Owns

* Tenant authorization rules
* Document upload/delete use cases
* Ingestion: extract → chunk → embed orchestration (`ingestDocument`)
* Provider interfaces (`VectorStore`, `EmbeddingProvider`, `LLMProvider`, `DocumentRepository`, `ObjectStorage`)
* Retrieval → confidence gate → LLM → citation flow (`ask`)

## Must not own

* AWS SDK / Qdrant / Voyage / Gemini / Bedrock SDK usage
* HTTP or Lambda event wiring (thin handlers in `services/*`)
* SAM / infrastructure definitions

## LLM ports

* `LLMProvider.generate({ systemPrompt, userPrompt, maxOutputTokens? })` — grounded generation contract for ask

## RAG ask

* `ask(auth, { question }, deps)` — tenant-filtered retrieve → confidence gate → Gemini (or configured `LLMProvider`) with citations/abstain; quota via `withChatQuota` only when the LLM runs

## Auth helpers

* `createAuthContextFromClaims` — maps verified JWT claims to `AuthContext` with `tenantId = sub`
* `assertSameTenant` — blocks cross-tenant resource access

## Documents

* `createUpload` — validate type/size, persist `PENDING` metadata, return presigned PUT target
* `listDocuments` / `getDocument` / `deleteDocument` — tenant-scoped
* `ingestDocument` — PENDING/FAILED → PROCESSING → READY (or FAILED)

## Ingestion helpers

* `parseDocumentObjectKey` / `parseS3EventRecords`
* `extractTextFromObject` / `chunkText`
