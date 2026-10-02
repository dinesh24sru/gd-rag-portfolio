# `apps/web`

Next.js + Material UI frontend for GroundedRAG (Vercel).

## Run locally

```bash
cd apps/web
cp .env.example .env.local
# fill Cognito values from infra SAM outputs
npm install --strict-ssl=false
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Auth

* Google sign-in via **AWS Cognito Hosted UI**
* OAuth2 Authorization Code + **PKCE** (`src/lib/auth/`)
* Callback route: `/auth/callback`
* Deploy Cognito first: see [`infra/README.md`](../../infra/README.md)

## Notes

* Do not put Google client secrets or AWS credentials in this app.
* Frontend only needs public Cognito + API base URL env vars (see `.env.example`).
* Profile page calls `GET /me` with the Cognito access token to verify server-side `tenantId`.
