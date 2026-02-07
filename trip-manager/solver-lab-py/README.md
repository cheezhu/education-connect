# solver-lab-py

Standalone Python scheduler module for `ec-planning-input@2`.

## Purpose

- Keep hard constraints valid.
- Complete required location coverage.
- Provide long-running optimization path (CP-SAT + LNS).
- Stay decoupled from current backend/frontend routes.

## Run

From `trip-manager` root:

```bash
python solver-lab-py/cli.py ^
  --in solver-lab/examples/sample-input.json ^
  --out solver-lab-py/examples/sample-result.json ^
  --report solver-lab-py/examples/sample-report.json ^
  --seed 42 ^
  --time 120 ^
  --workers 8
```

## Notes

- If `ortools` is not installed, solver auto-falls back to greedy baseline.
- Output remains `ec-planning-result@1`, so existing import flow can reuse it.

