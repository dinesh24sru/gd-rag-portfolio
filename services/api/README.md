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
| POST | `/documents/upload-url` | Cognito JWT | `{ document, uploadUrl, expiresInSeconds }` |
| GET | `/documents` | Cognito JWT | `{ documents: [...] }` |
| GET | `/documents/{documentId}` | Cognito JWT | `{ document }` |
| DELETE | `/documents/{documentId}` | Cognito JWT | `204` (deletes S3 object + DynamoDB row) |

`tenantId` is always Cognito `sub` from verified claims. Uploads: PDF / TXT / Markdown, max 10 MB, max 5 documents per tenant; browser PUTs to the presigned S3 URL.

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
