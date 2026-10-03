# Architecture

## 1. System Goal

A multi-tenant, document-grounded RAG application.

Users upload documents and ask questions about those documents.

The system must:

1. Isolate tenants.
2. Process documents asynchronously.
3. Retrieve relevant document chunks.
4. Refuse questions when sufficient evidence is unavailable.
5. Generate answers only from retrieved context.
6. Cite the source chunks used for the answer.
7. Remain inexpensive at low usage.
8. Scale without replacing the application/domain architecture.

Initial target:

* ~10 users/month
* ~2 documents/user/month
* ~10 queries/user/month

---

## 2. High-Level Architecture

```text
                    ┌───────────────────┐
                    │   Next.js UI      │
                    │     Vercel        │
                    └─────────┬─────────┘
                              │
                         HTTPS / Auth
                              │
                    ┌─────────▼─────────┐
                    │ API Gateway HTTP  │
                    │       API         │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │     Lambda        │
                    │   API Handlers    │
                    └───┬─────────┬─────┘
                        │         │
                        │         ├──────────────┐
                        │                        │
                        ▼                        ▼
                      S3                    DynamoDB
                 original files          metadata/session/
                                          usage/status
                        │
                     S3 event
                        │
                        ▼
                       SQS
                        │
                        ▼
                ┌───────────────┐
                │ Lambda Worker │
                └───────┬───────┘
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
           Extract     Chunk     Embed
                                  │
                                  ▼
                            Amazon Bedrock
                                  │
                                  ▼
                              Qdrant Cloud


Chat request:

User
 │
 ▼
API Gateway
 │
 ▼
Lambda
 │
 ├── authenticate/authorize
 ├── tenant-scoped retrieval
 ├── confidence gate
 ├── Bedrock LLM
 └── citation validation
 │
 ▼
Response
```

---

## 3. Responsibilities

| Component      | Responsibility                                          | Monorepo path |
| -------------- | ------------------------------------------------------- | ------------- |
| Next.js        | UI, authentication flow, document/chat UX               | `apps/web` |
| Vercel         | Frontend hosting and deployment                         | deploys `apps/web` |
| Cognito        | User Pool, Google IdP, Hosted UI / OAuth tokens         | `infra` |
| API Gateway    | HTTP API entry point                                    | `infra` |
| Lambda API     | API/business operations via thin handlers               | `services/api` + `packages/core` |
| Lambda Worker  | Async extract/chunk/embed/index                         | `services/ingestion-worker` + `packages/core` |
| S3             | Original uploaded documents                             | `infra` + `packages/providers` |
| SQS            | Asynchronous ingestion                                  | `infra` |
| SQS DLQ        | Failed/poison messages                                  | `infra` |
| DynamoDB       | Documents, sessions, messages, usage, processing status | `infra` + `packages/providers` |
| Bedrock        | Embeddings and LLM generation                           | `packages/providers` |
| Qdrant         | Vector storage and similarity search                    | `packages/providers` |
| CloudWatch     | Logs, metrics, operational visibility                   | `infra` |
| SAM            | Infrastructure definition                               | `infra` |
| GitHub Actions | CI/CD                                                   | `.github/workflows` |

---

## 4. Document Upload Flow

```text
Browser
  │
  │ request upload
  ▼
API Gateway
  │
  ▼
Lambda
  │
  ├── authenticate
  ├── authorize tenant
  ├── create document record
  └── generate presigned S3 URL
  │
  ▼
Browser
  │
  │ direct upload
  ▼
S3
  │
  ▼
SQS
```

The document itself must not be routed through Lambda unnecessarily.

S3 stores the original object.

DynamoDB stores document metadata and processing status.

v1 upload implementation:

* `POST /documents/upload-url` creates a `PENDING` metadata row (tenant = Cognito `sub`) and returns a short-lived S3 presigned PUT URL.
* Browser uploads directly to private S3 (`tenant/{tenantId}/documents/{documentId}/{version}/original`).
* Allowed types: PDF / plain text / Markdown; max 10 MiB; DynamoDB on-demand; S3 Block Public Access.
* SQS → ingestion worker (extract/chunk/embed/index) advances status `PENDING → PROCESSING → READY` (or `FAILED`).

---

## 5. Ingestion Flow

```text
SQS
 │
 ▼
Lambda Worker
 │
 ├── validate event
 ├── check idempotency
 ├── download document from S3
 ├── extract text
 ├── split into chunks
 ├── generate embeddings
 ├── upsert vectors into Qdrant
 └── update DynamoDB status
```

Status:

```text
PENDING
   ↓
PROCESSING
   ↓
READY
```

Failure:

```text
PROCESSING
   ↓
FAILED
```

SQS retries transient failures.

Messages exceeding the configured retry policy go to the DLQ.

---

## 6. Idempotency

A document must have a stable identity.

Recommended identifiers:

```text
tenantId
documentId
version
contentHash
chunkId
```

Vector IDs should be deterministic, for example:

```text
{documentId}:{version}:{chunkId}
```

Use vector upsert semantics.

Reprocessing the same document must not create duplicate vectors.

---

## 7. RAG Query Flow

```text
User question
      │
      ▼
Authentication
      │
      ▼
Tenant authorization
      │
      ▼
Generate query embedding
      │
      ▼
Qdrant search
      │
      ├── tenantId filter
      └── top-K chunks
      │
      ▼
Confidence gate
      │
   ┌──┴──┐
   │     │
 LOW    HIGH
   │     │
   ▼     ▼
REFUSE  LLM
          │
          ▼
   Citation validation
          │
          ▼
       Response
```

The LLM must not be called when retrieval does not meet the configured evidence threshold.

The threshold must be configurable and evaluated against a test dataset rather than chosen arbitrarily.

---

## 8. Grounding Rules

The LLM receives only the selected document context.

The prompt must instruct the model to:

* answer only from supplied context;
* not use outside knowledge;
* not fabricate citations;
* cite supporting chunks;
* abstain when the context does not support an answer.

Retrieved documents are untrusted content and must be clearly delimited from system instructions.

The application should describe this as:

**grounded RAG with abstention and citation validation**

rather than guaranteeing zero hallucinations.

---

## 9. Multi-Tenancy

Tenant identity comes from authenticated server-side context.

It must never be accepted as an authorization decision from request-body data.

Every tenant-owned resource must include tenant ownership:

```text
Document
Session
Message
Usage
Vector metadata
```

Every retrieval query must filter by tenant.

Example:

```text
tenantId = authenticatedTenantId
```

Cross-tenant access must fail authorization before returning data.

### Authentication (v1)

Identity provider: **Amazon Cognito User Pool**.

* Google is the only federated IdP in v1.
* The Next.js app uses Cognito Hosted UI with OAuth2 Authorization Code + PKCE.
* The frontend stores Cognito tokens from the token endpoint; it never receives AWS account credentials or Qdrant credentials.
* Public frontend config only: region, user pool id, app client id, hosted UI domain, app URL.

Tenant mapping (v1):

```text
tenantId = Cognito JWT "sub"
```

API handlers must verify the Cognito JWT and derive `tenantId` from claims. Never accept `tenantId` from the request body.

v1 implementation:

* API Gateway HTTP API Cognito JWT authorizer validates the bearer token (signature, issuer, audience).
* Lambda reads `event.requestContext.authorizer.jwt.claims` and maps `tenantId = sub` in `packages/core`.
* Smoke routes: `GET /health` (public), `GET /me` (JWT required).

---

## 10. Data Storage

### S3

Stores:

```text
tenant/{tenantId}/documents/{documentId}/{version}/original
```

S3 is the source of truth for original uploaded files.

### DynamoDB

Stores metadata rather than document binaries.

Core entities:

```text
Document
Session
Message
Usage
```

Each tenant-owned item contains `tenantId`.

### Qdrant

Stores:

```text
vector
documentId
chunkId
tenantId
documentVersion
source metadata
```

`tenantId` must be available as vector metadata for mandatory filtering.

---

## 11. Provider Interfaces

Application code should depend on interfaces rather than provider SDKs.

```typescript
interface VectorStore {
  upsert(chunks: VectorChunk[]): Promise<void>;
  search(request: VectorSearchRequest): Promise<SearchResult[]>;
  deleteDocument(documentId: string): Promise<void>;
}

interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
}
```

Current implementations:

```text
VectorStore
  └── QdrantVectorStore

EmbeddingProvider
  └── BedrockEmbeddingProvider

LLMProvider
  └── BedrockLLMProvider
```

This allows infrastructure providers to change without changing core application logic.

---

## 12. Reliability

### SQS

Use:

* visibility timeout;
* bounded retries;
* DLQ;
* appropriate batch size.

### Lambda

Handlers must distinguish:

* validation errors;
* authorization errors;
* transient provider errors;
* throttling;
* timeouts;
* permanent processing errors.

Do not retry permanent errors indefinitely.

### Bedrock

Handle throttling and transient failures using bounded exponential backoff.

A circuit breaker may be introduced around the LLM provider when the implementation requires it.

---

## 13. Security

Required controls:

* S3 Block Public Access.
* Short-lived presigned upload/download URLs.
* No vector database credentials in frontend code.
* Secrets stored outside source control.
* Server-side tenant authorization.
* Upload size/type validation.
* Per-tenant rate/usage limits.
* Prompt-injection-resistant context handling.
* No arbitrary remote URL ingestion in the initial version.
* CloudWatch logging without sensitive document contents where unnecessary.

---

## 14. Cost Strategy

Hard budget: near-zero idle cost; **worst case ≤ $10/month**. This is a portfolio workload, not a scale-out production estate.

Use serverless/pay-per-use only. Be stringent on memory, timeouts, retention, model size, and any always-on or provisioned feature.

Avoid adding unless architecture docs are updated first:

* EC2, ECS, EKS, RDS, Redis, Kafka, OpenSearch
* NAT Gateways / convenience VPC networking
* Provisioned concurrency, reserved capacity, DAX, global tables

Default allocations:

* Lambda API: start 128–256 MB, short timeout
* DynamoDB: on-demand
* S3: Block Public Access + lifecycle rules
* API Gateway: HTTP API
* CloudWatch logs: short retention (7–14 days)

Primary variable cost is LLM/embeddings (Bedrock) and any vector tier — not Lambda/API at low volume.

Control model cost through:

* smallest suitable Bedrock models;
* limited retrieval top-K;
* bounded context size;
* output token limits;
* per-tenant quotas;
* abstention instead of speculative retries;
* avoiding unnecessary second-pass LLM calls.

---

## 15. Observability

At minimum track:

```text
document ingestion success/failure
ingestion duration
documents by status
SQS failures
DLQ messages
retrieval latency
LLM latency
LLM errors/throttling
query count by tenant
token usage where available
abstention rate
```

Do not log complete uploaded documents or sensitive user questions by default.

---

## 16. Repository Layout (Monorepo)

All application components are maintained in a single TypeScript monorepo.

This is preferred because:

* domain logic, provider interfaces, and handlers share one language and type system;
* tenant/RAG rules stay centralized instead of duplicated across repos;
* frontend and backend can share request/response contracts without publishing packages;
* CI can run unit tests once and deploy frontend/backend independently from the same commit;
* the portfolio workload does not justify multi-repo operational overhead.

### Workspace structure

```text
gd-rag-portfolio/
├── apps/
│   └── web/                      # Next.js UI (deployed to Vercel)
├── packages/
│   ├── core/                     # Domain + application logic and provider interfaces
│   ├── providers/                # Qdrant, Bedrock, S3, DynamoDB implementations
│   └── shared/                   # Shared types, errors, config helpers
├── services/
│   ├── api/                      # API Gateway → Lambda HTTP handlers
│   └── ingestion-worker/         # SQS → Lambda document processor
├── infra/                        # AWS SAM templates and deploy config
├── .github/workflows/            # CI/CD
└── docs/                         # Architecture and design docs
```

### Ownership boundaries

| Path | Owns | Must not own |
| ---- | ---- | ------------ |
| `apps/web` | UI, auth UX, client API calls | AWS credentials, Qdrant credentials, vector search, LLM calls |
| `packages/core` | tenant rules, RAG flow, abstention, citations, use cases, interfaces | Provider SDKs, HTTP/Lambda wiring, SAM resources |
| `packages/providers` | Bedrock/Qdrant/S3/DynamoDB adapters behind interfaces | Business policy decisions |
| `packages/shared` | cross-cutting types/utilities | Feature-specific business logic |
| `services/api` | auth context extraction, input validation, HTTP mapping | Heavy business logic (delegate to `packages/core`) |
| `services/ingestion-worker` | SQS event handling, idempotency at the edge | Direct SDK usage outside provider adapters |
| `infra` | SAM/CloudFormation resources and env wiring | Application algorithms |

### Tooling

* Package manager: `pnpm` workspaces
* Language: TypeScript across apps, packages, and services
* Backend build: SAM + esbuild for Lambda bundles
* Frontend deploy: Vercel from `apps/web`
* Backend deploy: GitHub Actions → SAM from `infra` + `services/*`

Do not introduce Nx, Turborepo, Kubernetes, or additional monorepo platforms unless a concrete build/cache problem appears.

---

## 17. Deployment

Infrastructure is defined using AWS SAM in `infra/`.

Application deployment:

```text
GitHub (monorepo)
   ↓
GitHub Actions
   ↓
tests (packages + services)
   ↓
build Lambda bundles
   ↓
SAM validate/build
   ↓
SAM deploy
   ↓
AWS
```

Frontend deployment:

```text
GitHub (monorepo)
   ↓
Vercel project root: apps/web
   ↓
Next.js
```

Backend and frontend deploy independently, but share the same repository, contracts, and CI commit SHA.

---

## 18. Initial Scope

### Build first

1. Authentication
2. Tenant model
3. Document upload
4. S3 storage
5. SQS ingestion
6. Text extraction
7. Chunking
8. Bedrock embeddings
9. Qdrant indexing
10. Document status
11. Tenant-filtered retrieval
12. Confidence gate
13. Bedrock answer generation
14. Citations
15. Chat sessions
16. DLQ/retry handling
17. Basic usage limits
18. CloudWatch logging
19. Automated tests
20. CI/CD

### Defer

* hybrid search
* reranking
* semantic caching
* second-pass faithfulness model
* multiple LLM providers
* multiple vector providers
* advanced analytics
* billing
* organization/team administration

These should only be added after the core flow is working.

---

## 19. Architectural Rule

Prefer the simplest implementation that preserves:

**tenant isolation + grounded retrieval + abstention + idempotent async ingestion + provider abstraction + serverless scalability + monorepo maintainability.**
