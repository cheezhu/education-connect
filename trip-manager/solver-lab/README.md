# Solver Lab (Standalone)

This module is a standalone scheduling solver sandbox.
It does not modify backend/frontend code paths.

## What it does

- Input: `ec-planning-input@2` JSON
- Output: `ec-planning-result@1` JSON
- Goal: keep hard constraints valid and complete required locations coverage

Current engine: deterministic greedy baseline with required-point completion.

## Usage

Run from project root (`trip-manager`):

```bash
node solver-lab/cli.js --in solver-lab/examples/sample-input.json --out solver-lab/examples/sample-result.json --report solver-lab/examples/sample-report.json --seed 42 --time 300
```

## Files

- `cli.js`: entry point
- `lib/normalize.js`: parse and normalize export payload
- `lib/solver.js`: greedy solve logic
- `lib/validate.js`: hard-constraint and must-visit checks
- `examples/sample-input.json`: runnable sample

## Notes

- This is phase-1 baseline for fast testing.
- Next step can replace `lib/solver.js` with CP-SAT or LNS implementation while keeping input/output contract unchanged.

