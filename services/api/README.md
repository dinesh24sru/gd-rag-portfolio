# `services/api`

Thin AWS Lambda handlers behind API Gateway HTTP API.

## Owns

* HTTP request/response mapping
* Auth context extraction
* Boundary input validation
* Calling `packages/core` use cases

## Must not own

* Heavy business logic
* Direct provider SDK usage (use `packages/providers` via core wiring)

Place handlers under `src/` when implementation begins.
