$port = 3001
$processIds = @()

try {
  $processIds = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop |
    Select-Object -ExpandProperty OwningProcess
} catch {
  $processIds = @()
}

$processIds = $processIds | Sort-Object -Unique
foreach ($processId in $processIds) {
  try {
    Stop-Process -Id $processId -Force -ErrorAction Stop
  } catch {
  }
}

Start-Sleep -Milliseconds 300

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Resolve-Path (Join-Path $scriptDir "..")
$command = "cd `"$backendDir`"; npm run start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $command
