# Python CP-SAT Solver Workflow

This document describes the standalone Python solver design used for scheduling tests.

## Goal

- Read `ec-planning-input@2`
- Produce `ec-planning-result@1`
- Keep hard constraints valid
- Support long-running optimization
- Stay decoupled from current production routes

## Pipeline

```text
input json
  -> normalize
  -> precheck
  -> phase1 feasible solve (CP-SAT first, greedy fallback)
  -> phase2 optimize (CP-SAT LNS loop)
  -> validate
  -> result json + report json
```

## File Mapping

- `trip-manager/solver-lab-py/cli.py`
  - orchestrates full workflow and writes output
- `trip-manager/solver-lab-py/solver_lab/normalize.py`
  - validates and normalizes payload fields
- `trip-manager/solver-lab-py/solver_lab/precheck.py`
  - checks impossible required-location cases before solve
- `trip-manager/solver-lab-py/solver_lab/model_cp_sat.py`
  - builds CP-SAT model and solves it (if ortools exists)
- `trip-manager/solver-lab-py/solver_lab/solve_feasible.py`
  - phase1 feasible search
- `trip-manager/solver-lab-py/solver_lab/optimize_lns.py`
  - phase2 LNS optimization loop
- `trip-manager/solver-lab-py/solver_lab/validate.py`
  - hard-constraint and required-coverage audit
- `trip-manager/solver-lab-py/solver_lab/exporter.py`
  - builds result and report payloads

## Runtime Behavior

- If `ortools` is available:
  - phase1 uses CP-SAT first feasible solve
  - phase2 runs CP-SAT LNS iterations
- If `ortools` is not available:
  - phase1 uses greedy baseline
  - phase2 returns phase1 result directly

## Constraints Implemented

- group/date/slot uniqueness
- group date range validity
- location active/type/weekday/closed-date/open-hours validity
- location capacity
- required location coverage per group

## Quality / Business Rules (optional)

For additional business-specific rules and quality objectives (e.g. day/slot fill policies, avoid same-day MORNING/AFTERNOON duplicates, repeat-penalty, load-balancing), see:

- `docs/planning/solver-quality-rules.md`

## CLI Example

```bash
python trip-manager/solver-lab-py/cli.py \
  --in trip-manager/solver-lab/examples/sample-input.json \
  --out trip-manager/solver-lab-py/examples/sample-result.json \
  --report trip-manager/solver-lab-py/examples/sample-report.json \
  --seed 42 \
  --time 120 \
  --workers 8
```

