#!/usr/bin/env bash
# Build Lambda bundles (API + ingestion worker) and deploy the SAM stack.
# Usage (from repo root, Git Bash / WSL / macOS / Linux):
#   ./scripts/deploy-sam.sh
#   AWS_PROFILE=local ./scripts/deploy-sam.sh
#   ./scripts/deploy-sam.sh --no-confirm
# Extra args after -- are passed to `sam deploy` (e.g. --guided).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONFIRM=true
SAM_DEPLOY_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-confirm)
      CONFIRM=false
      shift
      ;;
    --)
      shift
      SAM_DEPLOY_ARGS+=("$@")
      break
      ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      SAM_DEPLOY_ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ ! -f "infra/samconfig.toml" ]]; then
  echo "Missing infra/samconfig.toml" >&2
  echo "Copy infra/samconfig.toml.example → infra/samconfig.toml and fill secrets locally." >&2
  exit 1
fi

if ! command -v sam >/dev/null 2>&1; then
  echo "AWS SAM CLI (sam) not found on PATH." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found on PATH." >&2
  exit 1
fi

if [[ -n "${AWS_PROFILE:-}" ]]; then
  echo "Using AWS_PROFILE=${AWS_PROFILE}"
fi

echo "==> Building Lambda bundles (API + ingestion worker)"
npm run build:lambdas

echo "==> sam build"
(
  cd infra
  sam build
)

echo "==> sam deploy"
DEPLOY=(sam deploy --config-file samconfig.toml)
if [[ "$CONFIRM" == "false" ]]; then
  DEPLOY+=(--no-confirm-changeset --no-fail-on-empty-changeset)
fi
if [[ ${#SAM_DEPLOY_ARGS[@]} -gt 0 ]]; then
  DEPLOY+=("${SAM_DEPLOY_ARGS[@]}")
fi

(
  cd infra
  "${DEPLOY[@]}"
)

echo "==> Done. Stack outputs:"
(
  cd infra
  sam list stack-outputs --config-file samconfig.toml 2>/dev/null \
    || echo "(Install/update SAM CLI, or run: aws cloudformation describe-stacks --stack-name <name> --query Stacks[0].Outputs)"
)
