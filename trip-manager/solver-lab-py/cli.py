#!/usr/bin/env python3
"""Standalone planner CLI.

Input schema: ec-planning-input@2
Output schema: ec-planning-result@1
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import sys
import time
from typing import Any, Dict, List, Tuple

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
    parser.add_argument(
        "--candidates",
        dest="candidates_path",
        default="",
        help="optional candidates json path (multi-solution output)",
    )
    parser.add_argument("--seed", type=int, default=42, help="random seed")
    parser.add_argument("--time", type=int, default=720, help="max time limit in seconds (auto-budget may stop early)")
    parser.add_argument("--workers", type=int, default=8, help="cp-sat worker threads")
    parser.add_argument(
        "--phase1-ratio",
        type=float,
        default=0.20,
        help="fraction of total time reserved for phase1 feasible solve",
    )
    parser.add_argument(
        "--auto-budget",
        action="store_true",
        default=True,
        help="enable staged time budgeting (default: enabled)",
    )
    parser.add_argument(
        "--no-auto-budget",
        action="store_false",
        dest="auto_budget",
        help="disable staged time budgeting and run until --time",
    )
    parser.add_argument(
        "--multi",
        "--user-friendly",
        dest="multi",
        action="store_true",
        default=False,
        help="run multiple profiles and output alternative candidate solutions",
    )
    parser.add_argument(
        "--candidates-max",
        type=int,
        default=6,
        help="max number of candidate solutions to keep (including primary)",
    )
    return parser.parse_args()


def _extract_candidate_metrics(optimized: Dict[str, Any], audit: Dict[str, Any]) -> Dict[str, Any]:
    diagnostics = optimized.get("diagnostics") if isinstance(optimized.get("diagnostics"), dict) else {}
    q = diagnostics.get("quality_stats") if isinstance(diagnostics.get("quality_stats"), dict) else {}
    hard = audit.get("hard_violations") if isinstance(audit.get("hard_violations"), list) else []
    must = audit.get("must_visit_missing") if isinstance(audit.get("must_visit_missing"), list) else []
    return {
        "hardViolations": len(hard),
        "mustVisitMissing": len(must),
        "missing": int(q.get("missing", 0) or 0),
        "repeats": int(q.get("repeats", 0) or 0),
        "overT1": int(q.get("overT1", 0) or 0),
        "overT2": int(q.get("overT2", 0) or 0),
        "requiredMissing": int(q.get("requiredMissing", 0) or 0),
        "assignmentsOutput": len(optimized.get("assignments", []) or []),
        "finalScore": int(diagnostics.get("final_score", 0) or 0),
        "improvements": int(diagnostics.get("improvements", 0) or 0),
        "engine": str(optimized.get("engine", "")),
    }


def _rank_key(metrics: Dict[str, Any]) -> Tuple[int, int, int, int, int, int]:
    # Lexicographic ranking across profiles:
    # 1) hard must be 0, 2) must-visit missing as low as possible,
    # 3) no repeats (absolute requirement),
    # 4) avoid overload beyond thresholds (overT2, then overT1),
    # 5) then (optionally) fill middle-day slots (missing).
    return (
        int(metrics.get("hardViolations", 999999) or 0),
        int(metrics.get("mustVisitMissing", 999999) or 0),
        int(metrics.get("repeats", 999999) or 0),
        int(metrics.get("overT2", 999999) or 0),
        int(metrics.get("overT1", 999999) or 0),
        int(metrics.get("missing", 999999) or 0),
    )


def _parse_profiles(raw_payload: Dict[str, Any], *, enabled: bool, max_candidates: int) -> List[Dict[str, Any]]:
    """Return a list of profiles: [{id,label,overrides}]. Always includes baseline as first entry."""
    profiles: List[Dict[str, Any]] = [
        {"id": "baseline", "label": "Baseline (as-is)", "overrides": {}}
    ]

    rules = raw_payload.get("rules") if isinstance(raw_payload.get("rules"), dict) else {}
    from_input = rules.get("scoringProfiles")
    if isinstance(from_input, list):
        for row in from_input:
            if not isinstance(row, dict):
                continue
            pid = str(row.get("id") or "").strip()
            if not pid or pid == "baseline":
                continue
            label = str(row.get("label") or pid).strip() or pid
            overrides = row.get("overrides") if isinstance(row.get("overrides"), dict) else {}
            profiles.append({"id": pid, "label": label, "overrides": dict(overrides)})

    # If explicitly enabled but no profiles provided, use built-in defaults.
    if enabled and len(profiles) == 1:
        profiles.extend(
            [
                # Same rules, different random seeds -> different feasible plans users can choose from.
                {"id": "alt_a", "label": "Alt A (same rules)", "overrides": {}},
                {"id": "alt_b", "label": "Alt B (same rules)", "overrides": {}},
                {"id": "alt_c", "label": "Alt C (same rules)", "overrides": {}},
                {
                    "id": "fill_first",
                    "label": "Fill-first (reduce empty middle-day slots; may increase overload)",
                    "overrides": {"weightMissing": 2000, "weightBalanceT1": 0, "weightBalanceT2": 0},
                },
                {
                    "id": "load_strict",
                    "label": "Load-strict (minimize overload; allow empty slots)",
                    "overrides": {"weightMissing": 0, "weightBalanceT1": 5, "weightBalanceT2": 20},
                },
            ]
        )

    max_candidates = max(1, int(max_candidates))
    return profiles[:max_candidates]


def _allocate_times(total_sec: int, n: int) -> List[int]:
    total_sec = max(1, int(total_sec))
    n = max(1, int(n))
    if n == 1:
        return [total_sec]
    # Give baseline more time, but keep other profiles viable.
    baseline = max(10, int(total_sec * 0.5))
    remaining = max(0, total_sec - baseline)
    each = max(8, remaining // (n - 1))
    times = [baseline] + [each] * (n - 1)
    times[0] += total_sec - sum(times)
    if sum(times) != total_sec:
        times[0] += total_sec - sum(times)
    return times


def _solve_once(raw_payload: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    started_at = time.time()
    normalized = normalize_input(raw_payload)
    precheck = run_precheck(normalized)
    phase1 = solve_feasible(normalized, config, precheck)
    optimized = optimize_with_lns(normalized, phase1, config, started_at)
    audit = validate_solution(normalized, optimized["assignments"])
    elapsed_ms = int((time.time() - started_at) * 1000)
    return {
        "normalized": normalized,
        "precheck": precheck,
        "phase1": phase1,
        "optimized": optimized,
        "audit": audit,
        "elapsed_ms": elapsed_ms,
        "config": config,
    }


def main() -> int:
    args = _parse_args()
    input_path = os.path.abspath(args.input_path)
    output_path = os.path.abspath(args.output_path)
    report_path = os.path.abspath(args.report_path) if args.report_path else ""
    candidates_path = os.path.abspath(args.candidates_path) if args.candidates_path else ""

    raw_payload = _read_json(input_path)

    base_config = {
        "seed": int(args.seed),
        "time_limit_sec": max(1, int(args.time)),
        "workers": max(1, int(args.workers)),
        "phase1_ratio": min(0.9, max(0.05, float(args.phase1_ratio))),
        "auto_budget": bool(getattr(args, "auto_budget", True)),
    }

    rules = raw_payload.get("rules") if isinstance(raw_payload.get("rules"), dict) else {}
    has_input_profiles = isinstance(rules.get("scoringProfiles"), list) and bool(rules.get("scoringProfiles"))
    multi_enabled = bool(args.multi or candidates_path or has_input_profiles)

    profiles = _parse_profiles(
        raw_payload,
        enabled=multi_enabled,
        max_candidates=int(args.candidates_max),
    )
    multi_mode = len(profiles) > 1
    times = _allocate_times(int(base_config["time_limit_sec"]), len(profiles))

    runs: List[Dict[str, Any]] = []
    for idx, profile in enumerate(profiles):
        variant = copy.deepcopy(raw_payload)
        if not isinstance(variant.get("rules"), dict):
            variant["rules"] = {}
        overrides = profile.get("overrides") if isinstance(profile.get("overrides"), dict) else {}
        for k, v in overrides.items():
            variant["rules"][str(k)] = v

        run_config = dict(base_config)
        run_config["seed"] = int(base_config["seed"]) + idx * 1000
        run_config["time_limit_sec"] = max(1, int(times[idx]))

        run = _solve_once(variant, run_config)
        optimized = run["optimized"]
        audit = run["audit"]
        metrics = _extract_candidate_metrics(optimized, audit)

        result_payload = build_result_payload(
            normalized=run["normalized"],
            assignments=optimized["assignments"],
            config=run_config,
            diagnostics=optimized.get("diagnostics", {}),
            elapsed_ms=int(run["elapsed_ms"]),
        )
        result_payload.setdefault("meta", {})
        if isinstance(result_payload["meta"], dict) and multi_enabled:
            result_payload["meta"]["profileId"] = profile.get("id")
            result_payload["meta"]["profileLabel"] = profile.get("label")
            result_payload["meta"]["rulesOverrides"] = overrides
            if multi_mode:
                result_payload["meta"]["hasAlternatives"] = True

        runs.append(
            {
                "profile": {"id": profile.get("id"), "label": profile.get("label"), "overrides": overrides},
                "config": run_config,
                "normalized": run["normalized"],
                "precheck": run["precheck"],
                "phase1": run["phase1"],
                "optimized": optimized,
                "audit": audit,
                "elapsed_ms": int(run["elapsed_ms"]),
                "metrics": metrics,
                "result_payload": result_payload,
            }
        )

        if multi_mode:
            print(
                f"[multi] profile={profile.get('id')} time={run_config['time_limit_sec']}s "
                f"missing={metrics['missing']} repeats={metrics['repeats']} mustVisitMissing={metrics['mustVisitMissing']} "
                f"hardViolations={metrics['hardViolations']} assignmentsOut={metrics['assignmentsOutput']}"
            )

    primary = sorted(runs, key=lambda r: _rank_key(r.get("metrics", {})))[0]

    _write_json(output_path, primary["result_payload"])

    report_candidates = None
    if multi_mode:
        report_candidates = [
            {
                "profile": r["profile"],
                "config": {
                    "seed": int(r["config"]["seed"]),
                    "timeLimitSec": int(r["config"]["time_limit_sec"]),
                    "workers": int(r["config"]["workers"]),
                    "phase1Ratio": float(r["config"]["phase1_ratio"]),
                    "autoBudget": bool(r["config"]["auto_budget"]),
                },
                "metrics": r["metrics"],
                "result": r["result_payload"],
            }
            for r in runs
        ]

    if report_path:
        report_payload = build_report_payload(
            normalized=primary["normalized"],
            precheck=primary["precheck"],
            phase1=primary["phase1"],
            optimized=primary["optimized"],
            audit=primary["audit"],
            elapsed_ms=int(primary["elapsed_ms"]),
            candidates=report_candidates,
        )
        _write_json(report_path, report_payload)

    if candidates_path and multi_mode:
        _write_json(
            candidates_path,
            {
                "schema": "ec-planning-candidates@1",
                "primaryProfileId": primary["profile"].get("id"),
                "candidates": report_candidates or [],
            },
        )

    print(f"Wrote result: {output_path}")
    if report_path:
        print(f"Wrote report: {report_path}")
    if candidates_path and multi_mode:
        print(f"Wrote candidates: {candidates_path}")

    audit = primary["audit"]
    print(
        "Hard violations: "
        f"{len(audit['hard_violations'])}, Must-visit missing: {len(audit['must_visit_missing'])}"
    )
    curve_tail = primary["optimized"].get("diagnostics", {}).get("curve_tail_zh", [])
    if isinstance(curve_tail, list) and curve_tail:
        print("Optimization trace (ZH):")
        for note in curve_tail:
            if isinstance(note, str) and note.strip():
                print(f"- {note}")

    # Exit code policy:
    # - hard violations => non-zero (caller should treat as failure)
    # - must-visit missing => warn but still exit 0 (so Studio can surface details without blocking)
    if audit["hard_violations"]:
        return 2
    if audit["must_visit_missing"]:
        print("WARNING: Must-visit missing detected (see report.audit.mustVisitMissingGroups).")
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
