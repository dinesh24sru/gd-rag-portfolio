# `packages/shared`

Cross-cutting shared code.

## Owns

* Shared TypeScript types/contracts
* Common error shapes
* Small pure utilities

## Must not own

* Feature-specific RAG / tenant business logic
* Provider SDK wrappers

Place source under `src/` when implementation begins.

## Auth / API contracts

* `AuthClaims` — claim bag after JWT authorizer validation
* `UnauthorizedError` / `ForbiddenError` / `NotFoundError` — typed API errors
