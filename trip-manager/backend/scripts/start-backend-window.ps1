$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Resolve-Path (Join-Path $scriptDir "..")

$command = "cd `"$backendDir`"; npm run start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $command
