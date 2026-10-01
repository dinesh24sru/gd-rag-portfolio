# `services/ingestion-worker`

SQS-triggered Lambda for asynchronous document processing.

Flow:

`S3 → SQS → this worker → extract → chunk → embed → Qdrant → READY`

## Owns

* SQS event handling
* Edge idempotency checks
* Orchestrating core ingestion use cases

## Must not own

* Duplicate vector creation on retries
* Business rules that belong in `packages/core`

Place handlers under `src/` when implementation begins.
