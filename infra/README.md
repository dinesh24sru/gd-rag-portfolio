# `infra`

AWS SAM / CloudFormation for GroundedRAG.

## Current stack

Cognito-first auth stack in [`template.yaml`](template.yaml):

* Cognito User Pool
* Google identity provider
* Public app client (Authorization Code + PKCE)
* Hosted UI domain

API Gateway, Lambdas, S3, SQS, and DynamoDB will be added in later stacks/templates.

## Prerequisites

1. AWS CLI configured (`aws sts get-caller-identity` works)
2. [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) installed
3. Google Cloud OAuth **Web application** client ID + secret

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

## Deploy Cognito

```bash
cd infra
cp samconfig.toml.example samconfig.toml
# edit samconfig.toml region / parameter_overrides as needed

sam deploy \
  --guided \
  --parameter-overrides \
    CognitoDomainPrefix=gd-rag-yourname \
    GoogleClientId=YOUR_GOOGLE_CLIENT_ID \
    GoogleClientSecret=YOUR_GOOGLE_CLIENT_SECRET \
    CallbackUrls=http://localhost:3000/auth/callback \
    LogoutUrls=http://localhost:3000/login
```

`CognitoDomainPrefix` must be globally unique in the region.

## Wire the Next.js app

Copy stack outputs into `apps/web/.env.local` (see `apps/web/.env.example`):

```bash
NEXT_PUBLIC_COGNITO_REGION=<Region>
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<UserPoolId>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<UserPoolClientId>
NEXT_PUBLIC_COGNITO_DOMAIN=<CognitoHostedUiDomain>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then:

```bash
cd apps/web
npm run dev
```

Open http://localhost:3000/login → **Continue with Google**.

## Rules

* Keep application algorithms out of this folder.
* Never commit secrets or `samconfig.toml` if it contains secrets.
* Reference built artifacts from `services/*` when API/worker resources are added.
