# `apps/web`

Next.js + Material UI frontend for GD RAG (Vercel).

## Live demo

[https://gd-rag-portfolio-i3pohx75y-dinesh24srus-projects.vercel.app](https://gd-rag-portfolio-i3pohx75y-dinesh24srus-projects.vercel.app)

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

## Deploy to Vercel

1. In [Vercel](https://vercel.com), **Import** the GitHub repo `gd-rag-portfolio`.
2. Set **Root Directory** to `apps/web` (Framework: Next.js).
3. Add environment variables (Production and Preview):

| Name | Source |
| ---- | ------ |
| `NEXT_PUBLIC_COGNITO_REGION` | stack output `Region` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | `UserPoolId` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `UserPoolClientId` |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | `CognitoHostedUiDomain` |
| `NEXT_PUBLIC_API_BASE_URL` | `ApiBaseUrl` |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR_APP.vercel.app` (no trailing slash) |

4. Deploy, then copy the production URL.
5. Redeploy the SAM stack with that URL added to `CallbackUrls`, `LogoutUrls`, and `CorsAllowOrigin` (see [`infra/README.md`](../../infra/README.md)).
6. Confirm Google login and Profile `GET /me` on the Vercel URL.

Do not put Google client secrets or AWS credentials in Vercel.

## Notes

* Do not put Google client secrets or AWS credentials in this app.
* Frontend only needs public Cognito + API base URL env vars (see `.env.example`).
* Profile page calls `GET /me` with the Cognito access token to verify server-side `tenantId`.
