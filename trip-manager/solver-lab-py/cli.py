#!/usr/bin/env python3
"""Standalone planner CLI.

Input schema: ec-planning-input@2
Output schema: ec-planning-result@1
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any, Dict

from solver_lab.normalize import normalize_input
from solver_lab.precheck import run_precheck
from solver_lab.solve_feasible import solve_feasible
from solver_lab.optimize_lns import optimize_with_lns
from solver_lab.validate import validate_solution
from solver_lab.exporter import build_result_payload, build_report_payload


def _read_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _write_json(path: str, payload: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Standalone scheduling solver (CP-SAT + LNS pipeline)."
    )
    parser.add_argument("--in", dest="input_path", required=True, help="input json path")
    parser.add_argument("--out", dest="output_path", required=True, help="result json path")
    parser.add_argument("--report", dest="report_path", default="", help="report json path")
    parser.add_argument("--seed", type=int, default=42, help="random seed")
    parser.add_argument("--time", type=int, default=300, help="total time limit in seconds")
    parser.add_argument("--workers", type=int, default=8, help="cp-sat worker threads")
    parser.add_argument(
        "--phase1-ratio",
        type=float,
        default=0.25,
        help="fraction of total time reserved for phase1 feasible solve",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    started_at = time.time()

    input_path = os.path.abspath(args.input_path)
    output_path = os.path.abspath(args.output_path)
    report_path = os.path.abspath(args.report_path) if args.report_path else ""

    raw_payload = _read_json(input_path)
    normalized = normalize_input(raw_payload)
    precheck = run_precheck(normalized)

    config = {
        "seed": int(args.seed),
        "time_limit_sec": max(1, int(args.time)),
        "workers": max(1, int(args.workers)),
        "phase1_ratio": min(0.9, max(0.05, float(args.phase1_ratio))),
    }

    phase1 = solve_feasible(normalized, config, precheck)
    optimized = optimize_with_lns(normalized, phase1, config, started_at)
    audit = validate_solution(normalized, optimized["assignments"])

    elapsed_ms = int((time.time() - started_at) * 1000)
    result_payload = build_result_payload(
        normalized=normalized,
        assignments=optimized["assignments"],
        config=config,
        diagnostics=optimized.get("diagnostics", {}),
        elapsed_ms=elapsed_ms,
    )
    report_payload = build_report_payload(
        normalized=normalized,
        precheck=precheck,
        phase1=phase1,
        optimized=optimized,
        audit=audit,
        elapsed_ms=elapsed_ms,
    )

    _write_json(output_path, result_payload)
    if report_path:
        _write_json(report_path, report_payload)

    print(f"Wrote result: {output_path}")
    if report_path:
        print(f"Wrote report: {report_path}")
    print(
        "Hard violations: "
        f"{len(audit['hard_violations'])}, Must-visit missing: {len(audit['must_visit_missing'])}"
    )
    curve_tail = optimized.get("diagnostics", {}).get("curve_tail_zh", [])
    if isinstance(curve_tail, list) and curve_tail:
        print("Optimization trace (ZH):")
        for note in curve_tail:
            if isinstance(note, str) and note.strip():
                print(f"- {note}")

    if audit["hard_violations"] or audit["must_visit_missing"]:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
