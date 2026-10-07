# `services/api`

Thin AWS Lambda handlers behind API Gateway HTTP API.

## Owns

* HTTP request/response mapping
* Auth context extraction from API Gateway JWT authorizer claims
* Boundary input validation
* Calling `packages/core` use cases

## Must not own

* Heavy business logic
* Direct provider SDK usage (use `packages/providers` via core wiring)
* JWT signature verification (API Gateway Cognito JWT authorizer)

## Endpoints

| Method | Path | Auth | Response |
| ------ | ---- | ---- | -------- |
| GET | `/health` | none | `{ ok: true }` |
| GET | `/me` | Cognito JWT | `{ tenantId, sub, email }` |
| GET | `/usage` | Cognito JWT | `{ period, usedTokens, quotaTokens, remainingTokens }` |
| POST | `/ask` | Cognito JWT | `{ answer, abstained, citations, usage }` |
| POST | `/documents/upload-url` | Cognito JWT | `{ document, uploadUrl, expiresInSeconds }` |
| GET | `/documents` | Cognito JWT | `{ documents: [...] }` |
| GET | `/documents/{documentId}` | Cognito JWT | `{ document }` |
| DELETE | `/documents/{documentId}` | Cognito JWT | `204` (Qdrant → S3 → DynamoDB) |

`tenantId` is always Cognito `sub` from verified claims. Uploads: PDF / TXT / Markdown, max 10 MB, max 5 documents per tenant; browser PUTs to the presigned S3 URL.

`POST /ask` embeds the question (Voyage `input_type=query`), tenant-filters Qdrant, confidence-gates, then Gemini with citations/abstain. Chat token quota is enforced before the LLM; gate abstentions do not consume tokens. Response always includes updated `usage`.

## Local build

```bash
# from repo root
node ./scripts/build-api.mjs
# → services/api/dist/handler.js

npm test --prefix services/api
```

SAM packages `services/api/dist`. Always build before deploy:

```bash
# from repo root
npm run build:api
# → services/api/dist/handler.js

cd infra && sam build && sam deploy
```
