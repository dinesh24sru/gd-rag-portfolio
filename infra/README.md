# `infra`

AWS SAM / CloudFormation for GroundedRAG.

## Current stack

Resources in [`template.yaml`](template.yaml):

* Cognito User Pool
* Google identity provider
* Public app client (Authorization Code + PKCE)
* Hosted UI domain
* HTTP API with Cognito JWT authorizer
* API Lambda (`GET /health`, `GET /me`, document upload routes)
* Private S3 bucket for originals (Block Public Access + abort incomplete multipart + ObjectCreated → SQS)
* DynamoDB documents table (on-demand)
* Ingestion SQS queue + DLQ
* Ingestion worker Lambda (extract → chunk → embed → Qdrant)

## Prerequisites

1. AWS CLI configured (`aws sts get-caller-identity` works)
2. [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) installed
3. Google Cloud OAuth **Web application** client ID + secret
4. Node.js 20+ and npm available (run `npm run build:lambdas` before `sam build`)
5. Qdrant Cloud URL + API key (for indexing)
6. **Embeddings (interim):** Voyage API key (`voyage-4-lite`). **Target:** Bedrock model access in the deploy region for `amazon.titan-embed-text-v2:0`
7. **LLM / ask path (interim):** Gemini API key (Google AI Studio, Gemini 2.5 Flash). **Target:** Bedrock LLM access (Nova Micro/Lite or Claude Haiku)

Provider selection and switch-back rules: `docs/ARCHITECTURE.md` §11. Never commit Voyage/Gemini/Bedrock secrets; pass them only as SAM parameters / Lambda env.

## Google Cloud OAuth setup

1. In Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → **Web application**.
2. After Cognito deploy, add this **Authorized redirect URI** (from stack output `GoogleIdpRedirectUri`):

   ```text
   https://{CognitoDomainPrefix}.auth.{region}.amazoncognito.com/oauth2/idpresponse
   ```

3. Authorized JavaScript origins (optional for Hosted UI, useful for local app):

   ```text
   http://localhost:3000
   ```

4. Keep Client ID and Client Secret out of git. Pass them only as SAM parameters.

## Deploy

One-shot from repo root (works in Windows PowerShell and Unix):

```bash
# first time: copy and fill secrets locally (never commit)
cp infra/samconfig.toml.example infra/samconfig.toml

# PowerShell
$env:AWS_PROFILE = "local"
npm run deploy:sam

# bash / macOS / Linux
AWS_PROFILE=local npm run deploy:sam

# skip changeset prompt
npm run deploy:sam -- --no-confirm
```

`npm run deploy:sam` runs `scripts/deploy-sam.mjs`, which launches `deploy-sam.ps1` on Windows or `deploy-sam.sh` elsewhere. It runs `build:lambdas` (API + worker), then `sam build` + `sam deploy` using `infra/samconfig.toml`.

Manual equivalent:

```bash
# from repo root
npm run build:lambdas

cd infra
sam build
sam deploy
```

Add these SAM parameters (see `samconfig.toml.example`) for ingestion / ask:

* `QdrantUrl` / `QdrantApiKey` / `QdrantCollectionName`
* `EmbeddingProvider` (`voyage` default, or `bedrock`)
* `VoyageApiKey` / `VoyageEmbeddingModelId` (when `voyage`)
* `EmbeddingDimensions` (Voyage default `1024`; Titan often `256`)
* `LlmProvider` (`gemini` default) + `GeminiApiKey` / `GeminiModelId` (ask path; keyed on API Lambda)
* API Lambda also receives embedding env (`EmbeddingProvider`, Voyage/Bedrock) for query vectors on `POST /ask`
* Target switch-back: `EmbeddingProvider=bedrock`, `BedrockEmbeddingModelId`, `LlmProvider=bedrock`

Changing embedding provider or dimensions requires a compatible Qdrant collection and re-ingest.

Guided first-time deploy (optional):

```bash
cd infra
sam deploy \
  --guided \
  --parameter-overrides \
    CognitoDomainPrefix=gd-rag-yourname \
    GoogleClientId=YOUR_GOOGLE_CLIENT_ID \
    GoogleClientSecret=YOUR_GOOGLE_CLIENT_SECRET \
    CallbackUrls=http://localhost:3000/auth/callback,https://gd-rag-portfolio.vercel.app/auth/callback \
    LogoutUrls=http://localhost:3000/login,https://gd-rag-portfolio.vercel.app/login \
    CorsAllowOrigin=http://localhost:3000,https://gd-rag-portfolio.vercel.app \
    QdrantUrl=https://YOUR_CLUSTER.cloud.qdrant.io \
    QdrantApiKey=YOUR_QDRANT_KEY
```

`CognitoDomainPrefix` must be globally unique in the region.

`CallbackUrls`, `LogoutUrls`, and `CorsAllowOrigin` are comma-separated lists. Keep localhost for local dev and add the Vercel production URL after the frontend is deployed.

## Wire the Next.js app

Copy stack outputs into `apps/web/.env.local` (see `apps/web/.env.example`):

```bash
NEXT_PUBLIC_COGNITO_REGION=<Region>
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<UserPoolId>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<UserPoolClientId>
NEXT_PUBLIC_COGNITO_DOMAIN=<CognitoHostedUiDomain>
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=<ApiBaseUrl>
```

Then:

```bash
cd apps/web
npm run dev
```

Open http://localhost:3000/login → **Continue with Google**.

## Smoke-test the API

Public health check:

```bash
curl -sS "$API_BASE_URL/health"
# {"ok":true}
```

Authenticated identity (use Cognito **access token** from the browser session):

```bash
curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "$API_BASE_URL/me"
# {"tenantId":"<cognito-sub>","sub":"<cognito-sub>","email":null}
```

Notes:

* API Gateway validates the JWT; Lambda derives `tenantId` from claim `sub` only.
* Cognito access tokens often omit `email`; that field may be `null` on `/me`.
* Unauthenticated `GET /me` returns `401`.

## Troubleshooting: AWS CLI SSL in Cursor (Windows + Avast)

If `aws` works in a normal PowerShell but fails in Cursor with `CERTIFICATE_VERIFY_FAILED` / `unable to get local issuer certificate`, Avast (or similar) HTTPS scanning is intercepting TLS. AWS CLI uses its own CA bundle and does not trust the Avast root by default.

Fix (already applied on this machine if you followed setup): export **Avast Web/Mail Shield Root** to a PEM, append it to AWS CLI’s `cacert.pem`, and set a user env var:

```powershell
# Example path after creating the combined bundle:
# [Environment]::SetEnvironmentVariable("AWS_CA_BUNDLE", "$env:USERPROFILE\.aws\aws-ca-bundle-with-avast.pem", "User")
```

Restart Cursor after setting `AWS_CA_BUNDLE` so agent terminals inherit it. Confirm with:

```powershell
$env:AWS_PROFILE = "local"
aws sts get-caller-identity
```

## Rules

* Keep application algorithms out of this folder.
* Never commit secrets or `samconfig.toml` if it contains secrets.
* API code lives in `services/api`; run `npm run build:api` before `sam build` (output: `services/api/dist`).
