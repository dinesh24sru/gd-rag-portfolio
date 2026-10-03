# GD RAG

Multi-tenant, document-grounded RAG SaaS.

Users upload documents and ask questions. Answers are grounded only in the authenticated tenant's documents; the system abstains when evidence is insufficient.

## Live demo

**App:** [https://gd-rag-portfolio.vercel.app](https://gd-rag-portfolio.vercel.app)

Sign in with Google (Cognito Hosted UI). After login, open **Profile** to confirm API `tenantId` matches your Cognito `sub`.

## Stack

| Layer | Choice |
| ----- | ------ |
| Frontend | Next.js on Vercel |
| API | API Gateway HTTP API + Lambda |
| Storage | S3 (documents), DynamoDB (metadata/sessions/usage) |
| Ingestion | S3 → SQS → Lambda worker |
| AI | Amazon Bedrock (embeddings + LLM) |
| Vectors | Qdrant Cloud |
| IaC | AWS SAM |
| CI/CD | GitHub Actions |
| Repo | TypeScript pnpm monorepo |

## Monorepo layout

```text
apps/web                  Next.js UI
packages/core             Domain + application logic + interfaces
packages/providers        Bedrock / Qdrant / S3 / DynamoDB adapters
packages/shared           Shared types and utilities
services/api              HTTP API Lambda handlers
services/ingestion-worker Document processing Lambda
infra                     SAM templates
docs                      Architecture source of truth
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`AGENTS.md`](AGENTS.md) before changing structure or adding infrastructure.

## Auth (Cognito + API JWT)

Deploy Cognito and the HTTP API from [`infra/`](infra/), then configure `apps/web/.env.local` from stack outputs (`ApiBaseUrl` included). See [`infra/README.md`](infra/README.md).

* Frontend: Cognito Hosted UI + PKCE
* API: HTTP API Cognito JWT authorizer; `GET /me` returns `tenantId = sub`
* Google OAuth Client ID/Secret are SAM deploy parameters only — never commit them.
