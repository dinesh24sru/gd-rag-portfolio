# AGENTS.md

## Project

Multi-tenant document-grounded RAG SaaS.

The system allows authenticated users to upload documents and ask questions. Answers must be grounded only in the user's/tenant's documents. If sufficient evidence cannot be retrieved, the system must abstain.

## Architecture

Follow `docs/ARCHITECTURE.md` as the source of truth for system architecture.

Core stack:

* Frontend: Next.js
* Frontend hosting: Vercel
* Auth: Amazon Cognito (Google IdP, Hosted UI, PKCE)
* API: AWS API Gateway HTTP API
* Compute: AWS Lambda
* Object storage: Amazon S3
* Metadata/session/usage: Amazon DynamoDB
* Async processing: Amazon SQS + DLQ
* Embeddings/LLM: Amazon Bedrock
* Vector database: Qdrant Cloud
* IaC: AWS SAM
* CI/CD: GitHub Actions
* Observability: CloudWatch
* Repository: TypeScript pnpm monorepo

## Monorepo Layout

```text
apps/web                  Next.js UI (Vercel)
packages/core             Domain + application logic + provider interfaces
packages/providers        Bedrock, Qdrant, S3, DynamoDB adapters
packages/shared           Shared types and utilities
services/api              API Gateway Lambda handlers
services/ingestion-worker SQS ingestion Lambda worker
infra                     AWS SAM templates
.github/workflows         CI/CD
docs                      Architecture docs
```

Rules:

* Keep AWS handlers thin; put business logic in `packages/core`.
* Keep provider SDKs inside `packages/providers`.
* Do not put secrets, vector credentials, or LLM calls in `apps/web`.
* Prefer shared packages over copy-pasting tenant/RAG logic across services.

## Mandatory Principles

### Multi-tenancy

* Every document, chunk/vector, session, message, and usage record must be associated with a `tenantId`.
* `tenantId` must come from authenticated server-side identity/context (v1: Cognito JWT `sub`).
* Never trust a client-supplied `tenantId`.
* Every vector search must apply the authenticated tenant filter.
* Every document/session lookup must enforce tenant ownership.

### Authentication

* Use Amazon Cognito User Pool with Google as the v1 IdP.
* Frontend auth uses Cognito Hosted UI + OAuth Authorization Code + PKCE.
* Do not put Cognito client secrets, AWS credentials, or Qdrant credentials in `apps/web`.
* Google OAuth client secrets are SAM deploy parameters / secrets — never commit them.

### RAG grounding

* Retrieval must occur before generation.
* Retrieval must be tenant-scoped.
* The application must evaluate retrieval confidence before calling the LLM.
* If sufficient evidence is unavailable, the system must abstain.
* LLM prompts must explicitly restrict answers to retrieved context.
* Factual answers must contain citations to source document/chunk information.
* Do not claim the system provides mathematically guaranteed "zero hallucinations"; describe it as grounded RAG with abstention.

### Ingestion

Document processing is asynchronous:

`S3 → SQS → Lambda worker → extract → chunk → embed → Qdrant → READY`

* Processing must be idempotent.
* Duplicate events must not create duplicate vectors.
* Failed messages must be retried through SQS.
* Poison messages must eventually reach the DLQ.
* Document status must be persisted.

Valid high-level states:

`PENDING → PROCESSING → READY`

or

`PENDING/PROCESSING → FAILED`

### Security

* S3 buckets must not be public.
* Vector database credentials must never reach the frontend.
* Secrets must not be committed to source control.
* Presigned S3 URLs should be short-lived.
* Validate uploaded file type and size.
* Treat document content as untrusted input.
* Protect against prompt injection from retrieved documents.
* Enforce per-tenant usage/rate limits.

### Provider abstraction

Keep provider-specific implementations behind interfaces.

The application/domain layer must not directly depend on Qdrant, Bedrock, or other provider SDKs.

Important interfaces include:

* `VectorStore`
* `EmbeddingProvider`
* `LLMProvider`
* `DocumentStore`

### Reliability

* Use idempotency keys for ingestion.
* Use bounded retries with exponential backoff where appropriate.
* Handle Bedrock throttling/timeouts explicitly.
* Do not retry permanent validation/configuration errors indefinitely.
* Keep document processing status observable.

### Cost

Optimize for the initial portfolio workload.

Do not introduce infrastructure such as Kubernetes, ECS, Redis, Kafka, OpenSearch, or additional managed services unless there is a demonstrated requirement.

Prefer serverless, pay-per-use services.

## Coding Rules

* TypeScript for application/backend code unless a specific component requires another language.
* Use the monorepo workspace packages; do not create separate repos for frontend, API, worker, or providers.
* Keep business logic separate from AWS handlers (`packages/core`, not `services/*`).
* Keep infrastructure code separate from domain/application logic (`infra` vs `packages/*`).
* Prefer small, testable functions.
* Validate external input at system boundaries.
* Do not duplicate tenant authorization logic across handlers; centralize it in `packages/core`.
* Do not hard-code credentials, tenant IDs, AWS regions, model IDs, or environment-specific configuration.
* Add tests for security-sensitive and RAG-critical behavior.

## Change Discipline

Before changing architecture:

1. Check `docs/ARCHITECTURE.md`.
2. Preserve the mandatory principles in this file.
3. Prefer the smallest change that satisfies the requirement.
4. Do not add infrastructure merely for theoretical future scale.
5. Update architecture documentation when an architectural decision changes.
