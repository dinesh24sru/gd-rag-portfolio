# `packages/providers`

Provider implementations behind `packages/core` interfaces.

## Adapters

* `createDynamoDocumentRepository` — document metadata (DynamoDB on-demand)
* `createS3ObjectStorage` — short-lived S3 presigned PUT URLs
* (later) Qdrant / Bedrock

## Rules

* Depend on `packages/core` interfaces.
* Do not encode business policy here (tenant rules, file limits live in core).
* Use AWS SDK v3 modular clients; reuse clients across Lambda invocations.
