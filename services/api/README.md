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

## Endpoints (v1 auth smoke)

| Method | Path | Auth | Response |
| ------ | ---- | ---- | -------- |
| GET | `/health` | none | `{ ok: true }` |
| GET | `/me` | Cognito JWT | `{ tenantId, sub, email }` |

`tenantId` is always Cognito `sub` from verified claims.

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
