# Build the API Lambda bundle and deploy the SAM stack (Windows PowerShell).
# Usage (from repo root):
#   .\scripts\deploy-sam.ps1
#   $env:AWS_PROFILE = "local"; .\scripts\deploy-sam.ps1
#   .\scripts\deploy-sam.ps1 -NoConfirm
# Extra args are passed to `sam deploy`.

param(
  [switch]$NoConfirm,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$SamDeployArgs
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

if (-not (Test-Path "infra\samconfig.toml")) {
  Write-Error "Missing infra/samconfig.toml. Copy infra/samconfig.toml.example and fill secrets locally."
}

if (-not (Get-Command sam -ErrorAction SilentlyContinue)) {
  Write-Error "AWS SAM CLI (sam) not found on PATH."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js not found on PATH."
}

if ($env:AWS_PROFILE) {
  Write-Host "Using AWS_PROFILE=$($env:AWS_PROFILE)"
}

Write-Host "==> Building API bundle (esbuild → services/api/dist)"
npm run build:api
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> sam build"
Push-Location infra
try {
  sam build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "==> sam deploy"
  $deployArgs = @("deploy", "--config-file", "samconfig.toml")
  if ($NoConfirm) {
    $deployArgs += @("--no-confirm-changeset", "--no-fail-on-empty-changeset")
  }
  if ($SamDeployArgs -and $SamDeployArgs.Count -gt 0) {
    $deployArgs += $SamDeployArgs
  }

  & sam @deployArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "==> Done. Stack outputs:"
  sam list stack-outputs --config-file samconfig.toml
  if ($LASTEXITCODE -ne 0) {
    Write-Host "(Or run: aws cloudformation describe-stacks --query Stacks[0].Outputs)"
  }
}
finally {
  Pop-Location
}
