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
