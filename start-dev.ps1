$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$backendDir = Join-Path $root 'trip-manager\backend'
$frontendDir = Join-Path $root 'trip-manager\frontend'

if (-not (Test-Path $backendDir)) {
  Write-Host "Backend directory not found: $backendDir"
  exit 1
}

if (-not (Test-Path $frontendDir)) {
  Write-Host "Frontend directory not found: $frontendDir"
  exit 1
}

$backendCmd = "`$host.UI.RawUI.WindowTitle = 'education-connect backend'; npm run dev"
$frontendCmd = "`$host.UI.RawUI.WindowTitle = 'education-connect frontend'; npm run dev"

Start-Process powershell `
  -WorkingDirectory $backendDir `
  -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $backendCmd)

Start-Process powershell `
  -WorkingDirectory $frontendDir `
  -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $frontendCmd)

Write-Host 'Started backend and frontend in separate windows.'
