param(
  [switch]$SkipFrontendLint,
  [switch]$SkipFrontendTest,
  [switch]$SkipFrontendBuild
)

$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

function Invoke-VerifyStep {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  Write-Host "[verify] $Name"
  & $Command

  if (-not $?) {
    throw "[verify] $Name failed."
  }

  if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    throw "[verify] $Name failed with exit code $LASTEXITCODE."
  }
}

Invoke-VerifyStep -Name "domain-selftest" -Command { node scripts/domain-selftest.cjs }
Invoke-VerifyStep -Name "backend-routes-selftest" -Command { node scripts/backend-routes-selftest.cjs }
Invoke-VerifyStep -Name "scan-garbled" -Command { node scripts/scan-garbled.cjs }

Push-Location "frontend"
try {
  if (-not $SkipFrontendLint) {
    Invoke-VerifyStep -Name "frontend lint" -Command { npm run lint }
  }

  if (-not $SkipFrontendTest) {
    Invoke-VerifyStep -Name "frontend test" -Command { npm run test }
  }

  if (-not $SkipFrontendBuild) {
    Invoke-VerifyStep -Name "frontend build" -Command { npm run build }
  }
}
finally {
  Pop-Location
}

Write-Host "[verify] OK"
