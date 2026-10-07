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
* Embeddings: Voyage `voyage-4-lite` (interim); Amazon Bedrock Titan (target)
* LLM: Google Gemini 2.5 Flash (interim); Amazon Bedrock Nova/Claude Haiku (target)
* Vector database: Qdrant Cloud
* IaC: AWS SAM
* CI/CD: GitHub Actions
* Observability: CloudWatch
* Repository: TypeScript pnpm monorepo

Model APIs are selected behind `EmbeddingProvider` / `LLMProvider` (env switch). See `docs/ARCHITECTURE.md` §11. Do not put Voyage/Gemini/Bedrock keys in `apps/web`.

## Monorepo Layout

```text
apps/web                  Next.js UI (Vercel)
packages/core             Domain + application logic + provider interfaces
packages/providers        Voyage, Gemini, Bedrock, Qdrant, S3, DynamoDB adapters
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
* Do not put Cognito client secrets, AWS credentials, Qdrant credentials, or Voyage/Gemini/Bedrock API keys in `apps/web`.
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

### Observability / logging (required)

Every meaningful backend flow must emit **clear, step-by-step CloudWatch logs** so upload, ingestion, delete, RAG, and failures are diagnosable without guessing.

Use `logInfo` / `logWarn` / `logError` from `@gd-rag/shared` (structured `event` name + fields). Prefer dotted event names by domain:

* `api.*` — HTTP route request/success (handlers in `services/api`)
* `upload.*` — create upload / duplicate reject (`packages/core` documents)
* `ingest.*` — SQS batch + each pipeline step (`services/ingestion-worker`, `packages/core` ingestion)
* `delete.*` — Qdrant → S3 → DynamoDB steps (`packages/core` delete)
* Add matching prefixes for new domains (e.g. `rag.*`, `chat.*`) when those flows land

**Where to log (wherever applicable):**

* Thin handlers: request received, outcome, and batch/record boundaries (messageId, route, counts).
* Domain/application logic in `packages/core`: each significant step start/done and status transitions (e.g. download → hash → extract → chunk → embed → vector upsert → READY).
* Multi-store operations: log each store explicitly (Qdrant, S3, DynamoDB) so partial failures are obvious.
* Failures: permanent vs transient, with `tenantId` / `documentId` / `messageId` / error message when known.
* Provider adapters may log provider-specific faults (status codes, throttles) without dumping payloads.

**Always include when available:** `tenantId`, `documentId`, `messageId`, `status`, sizes/counts (`sizeBytes`, `chunkCount`, `bytes`), `s3Key`, `contentHash`, outcome/reason.

**Never log:** document/file body text, retrieved chunk text, full prompts/completions, secrets, API keys, raw JWTs, or presigned URL query strings.

Keep logs cheap: short CloudWatch retention already applies; do not add high-cardinality custom metrics or per-token chatter. Skip pure getters with no side effects unless debugging a boundary validation failure.

When adding or changing a backend flow, update step logs in the same change (do not leave silent multi-step paths).

### Secrets check before commit and push

Before every `git commit` and `git push`, scan the changes that would leave this machine for secrets. Do not commit or push if any are found.

Block:

* Private keys, cloud credentials, API keys, PATs, OAuth client secrets, and assigned passwords or tokens
* `.env` files other than `*.example` / `*.sample` / `*.template`
* `samconfig.toml`, credential JSON, service-account JSON, and private key / certificate files

Allow:

* Placeholder values in example/template files
* CloudFormation references such as `!Ref GoogleClientSecret`
* Docs that mention secrets without a live value

If a finding appears, stop, report the file path and kind of secret (never the value), and wait for the secret to be removed.

### Provider abstraction

Keep provider-specific implementations behind interfaces.

The application/domain layer must not directly depend on Qdrant, Voyage, Gemini, Bedrock, or other provider SDKs.

Important interfaces include:

* `VectorStore`
* `EmbeddingProvider`
* `LLMProvider`
* `DocumentStore`

### Reliability

* Use idempotency keys for ingestion.
* Use bounded retries with exponential backoff where appropriate.
* Handle model-provider throttling/timeouts explicitly (Voyage, Gemini, Bedrock).
* Do not retry permanent validation/configuration errors indefinitely.
* Keep document processing status observable.

### Cost (hard budget)

This is a near-zero portfolio project. Target ~$0–few dollars/month idle; **worst case ≤ $10/month**.

Be stringent. Prefer the cheapest correct option. Do not over-allocate “just in case.”

* Prefer pay-per-use serverless only. No always-on compute.
* Forbidden unless architecture docs explicitly change first: EC2, ECS, EKS, RDS, Redis, Kafka, OpenSearch, NAT Gateways, VPC endpoints “for convenience,” provisioned concurrency, reserved capacity, multi-AZ extras not required for v1.
* Lambda: smallest memory that meets latency needs (start low, e.g. 128–256 MB for API; raise only with evidence). Short timeouts. No provisioned concurrency.
* DynamoDB: on-demand only for v1. Tight item sizes. No DAX, no global tables, no unused GSIs.
* S3: Standard; lifecycle expire/abort incomplete multipart; Block Public Access; no Transfer Acceleration.
* SQS: short retention appropriate to the workload; small payloads (S3 pointer pattern); conservative batch sizes.
* API Gateway: HTTP API (not REST API). No extra stages/custom domains unless required.
* CloudWatch: low retention (e.g. 7–14 days); avoid high-cardinality custom metrics and verbose payload logging.
* Embeddings / LLM: prefer interim free/low tiers (Voyage + Gemini Flash); when on Bedrock, smallest suitable models. Hard caps on top-K, context tokens, max output tokens; per-tenant quotas; no speculative second LLM passes; abstain instead of expensive retries.
* Qdrant: free/smallest Cloud tier; minimal dimensions/collections; delete vectors on document delete.
* Never add caches, queues, or services that bill when idle unless required for a documented feature.
* Before adding any AWS resource or raising memory/timeout/capacity, state the monthly cost impact and keep the stack inside the $10 worst-case budget.

## Coding Rules

### Style (required)

Write modular, reusable, simple, straightforward code. Prefer clarity over cleverness.

* Keep units small and single-purpose: one clear job per function/module; compose rather than nest deep logic.
* Reuse shared helpers and workspace packages (`packages/core`, `packages/shared`, `packages/providers`) instead of copy-pasting.
* Do not bloat: no speculative features, unused abstractions, wrapper layers that only forward calls, or “just in case” config/options.
* Avoid redundant code: extract when the same logic appears twice with the same meaning; do not duplicate tenant/auth/RAG rules across handlers or services.
* Prefer the shortest correct implementation that stays readable. Delete dead code; do not leave commented-out alternatives.
* Avoid premature abstraction: wait for a second real use before generalizing. Interfaces exist for provider boundaries, not for every local helper.
* Name things plainly; keep control flow linear where possible; fail fast with explicit errors.

### Structure and practices

* TypeScript for application/backend code unless a specific component requires another language.
* Use the monorepo workspace packages; do not create separate repos for frontend, API, worker, or providers.
* Keep business logic separate from AWS handlers (`packages/core`, not `services/*`).
* Keep infrastructure code separate from domain/application logic (`infra` vs `packages/*`).
* Prefer small, testable, pure functions; explicit types at boundaries; fail fast on invalid input.
* Validate external input at system boundaries; never trust client `tenantId` or file metadata alone.
* Do not duplicate tenant authorization logic across handlers; centralize it in `packages/core`.
* Do not hard-code credentials, tenant IDs, AWS regions, model IDs, or environment-specific configuration.
* Add tests for security-sensitive and RAG-critical behavior.
* Avoid unused dependencies and large SDK surface area in Lambda bundles.
* Prefer deterministic IDs, idempotent writes, and clear error types over silent retries.

### Frontend responsiveness (required)

Every `apps/web` UI change must stay usable on **phones and iPads/tablets**, not only desktop.

* Design mobile-first; verify layouts at ~375px (phone), ~768px (iPad portrait), and desktop.
* Use responsive spacing, typography, and stacking (`xs` / `sm` / `md` breakpoints). Prefer fluid type (`clamp`) for page titles.
* Avoid horizontal overflow: wrap long filenames, emails, Cognito IDs, and URLs (`overflow-wrap: anywhere` / no fixed-width rows that clip).
* Keep primary actions reachable on small screens (adequate tap targets; account for top app bar and bottom nav safe areas).
* Respect `env(safe-area-inset-*)` and `100dvh` so notched phones and home-indicator devices do not hide chrome or content.
* Navigation: compact patterns on small viewports (drawer + bottom tabs); permanent sidebar only from `md` up.
* Do not ship desktop-only grids, side-by-side toolbars, or hover-only critical actions without a touch-friendly alternative.
* When adding or changing a page/component, check that it still fits phone and iPad without horizontal scroll.

### AWS SDK and Lambda practices

* Put AWS SDK usage only in `packages/providers` (or thin service wiring), not in `packages/core` or `apps/web`.
* Use AWS SDK v3 modular clients (`@aws-sdk/client-*`). Import only the clients/commands you need.
* Reuse clients across invocations (initialize outside the handler) to limit cold-start and connection churn.
* Prefer temporary credentials from the Lambda execution role; never ship long-lived access keys in code or env for app runtime.
* Use least-privilege IAM (per function, per action, per resource). No `*` actions/resources unless unavoidable and documented.
* Prefer freeless patterns: S3 presigned PUT from the client; DynamoDB single-table or few tables with careful keys; SQS event source mapping with modest batch size and partial batch failure when needed.
* Bound all retries (SDK max attempts + application backoff). Do not retry validation/auth errors.
* Set explicit timeouts on Bedrock and other HTTP model calls (Voyage, Gemini); keep Lambda timeout only slightly above the longest bounded downstream call.
* Bundle with esbuild/tree-shaking; exclude AWS SDK from browsers; keep Lambda artifacts small.
* Follow **Observability / logging** above for every Lambda-facing flow; CloudWatch is the default sink.

## Change Discipline

### Planning and execution

Break work into the smallest useful tasks, then complete them one at a time.

* Prefer many small, shippable steps over one large change.
* Each task should have a clear outcome (e.g. one route, one provider method, one status transition)—not a whole vertical slice unless asked.
* Plan briefly, implement the next smallest task, verify, then move on.
* Do not batch unrelated refactors with feature work.
* Keep PRs/commits focused when the user asks to commit.

### Architecture changes

Before changing architecture:

1. Check `docs/ARCHITECTURE.md`.
2. Preserve the mandatory principles in this file.
3. Prefer the smallest change that satisfies the requirement.
4. Do not add infrastructure merely for theoretical future scale.
5. Update architecture documentation when an architectural decision changes.
