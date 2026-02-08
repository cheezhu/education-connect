param(
  [switch]$SkipFrontendBuild
)

$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "[verify] domain-selftest"
node scripts/domain-selftest.cjs

Write-Host "[verify] backend-routes-selftest"
node scripts/backend-routes-selftest.cjs

Write-Host "[verify] scan-garbled"
node scripts/scan-garbled.cjs

if (-not $SkipFrontendBuild) {
  Write-Host "[verify] frontend build"
  Push-Location "frontend"
  npm run build
  Pop-Location
}

Write-Host "[verify] OK"

