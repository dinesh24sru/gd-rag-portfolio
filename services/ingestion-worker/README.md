# `services/ingestion-worker`

SQS-triggered Lambda for asynchronous document processing.

Flow:

`S3 ObjectCreated → SQS → this worker → extract → chunk → embed → Qdrant → READY`

## Owns

* SQS event handling with partial batch failure
* Edge parsing of S3 notification bodies
* Orchestrating `ingestDocument` from `@gd-rag/core`

## Must not own

* Duplicate vector creation on retries (core deletes-then-upserts)
* Business rules that belong in `packages/core`
* Provider SDKs (those live in `packages/providers`)

## Build

From repo root:

```bash
npm run build:worker
```

Deploy with the rest of the stack via `npm run deploy:sam` (builds API + worker).

## Required env (set by SAM)

* `DOCUMENTS_TABLE_NAME`
* `DOCUMENTS_BUCKET_NAME`
* `QDRANT_URL` / `QDRANT_API_KEY` / `QDRANT_COLLECTION`
* `BEDROCK_EMBEDDING_MODEL_ID`
* `EMBEDDING_DIMENSIONS`
