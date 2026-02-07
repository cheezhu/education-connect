param(
  [string]$InputPath = "solver-lab/examples/sample-input.json",
  [string]$OutputPath = "solver-lab-py/examples/sample-result.json",
  [string]$ReportPath = "solver-lab-py/examples/sample-report.json",
  [int]$Seed = 42,
  [int]$Time = 120,
  [int]$Workers = 8
)

$ErrorActionPreference = "Stop"

python solver-lab-py/cli.py `
  --in $InputPath `
  --out $OutputPath `
  --report $ReportPath `
  --seed $Seed `
  --time $Time `
  --workers $Workers

