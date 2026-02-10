#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class Profile:
    id: str
    label: str
    overrides: Dict[str, Any]  # applied to payload["rules"]


def _read_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: str, payload: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _extract_metrics(report: Dict[str, Any]) -> Dict[str, Any]:
    audit = report.get("audit") if isinstance(report.get("audit"), dict) else {}
    optimize = report.get("optimize") if isinstance(report.get("optimize"), dict) else {}
    diag = optimize.get("diagnostics") if isinstance(optimize.get("diagnostics"), dict) else {}
    q = diag.get("quality_stats") if isinstance(diag.get("quality_stats"), dict) else {}
    summary = report.get("summary") if isinstance(report.get("summary"), dict) else {}

    hard = audit.get("hardViolations") if isinstance(audit.get("hardViolations"), list) else []
    must = audit.get("mustVisitMissing") if isinstance(audit.get("mustVisitMissing"), list) else []

    return {
        "assignmentsOut": _as_int(summary.get("assignmentsOutput"), 0),
        "hardViolations": len(hard),
        "mustVisitMissing": len(must),
        "missing": _as_int(q.get("missing"), -1),
        "repeats": _as_int(q.get("repeats"), -1),
        "overT2": _as_int(q.get("overT2"), -1),
        "mustVisitHits": _as_int(q.get("mustVisitHits"), -1),
        "improvements": _as_int(diag.get("improvements"), 0),
        "finalScore": _as_int(diag.get("final_score"), 0),
        "phase1Engine": str(diag.get("phase1_engine") or ""),
    }


def _run_one(
    *,
    python_bin: str,
    cli_path: str,
    in_path: str,
    out_path: str,
    report_path: str,
    time_sec: int,
    workers: int,
    seed: int,
    cwd: str,
    log_path: Optional[str],
) -> None:
    cmd = [
        python_bin,
        "-u",
        cli_path,
        "--in",
        in_path,
        "--out",
        out_path,
        "--report",
        report_path,
        "--time",
        str(int(time_sec)),
        "--workers",
        str(int(workers)),
        "--seed",
        str(int(seed)),
    ]

    if log_path:
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, "w", encoding="utf-8") as log:
            subprocess.run(cmd, cwd=cwd, stdout=log, stderr=subprocess.STDOUT, check=True)
    else:
        subprocess.run(cmd, cwd=cwd, check=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="Run solver profiles and summarize metrics.")
    ap.add_argument("--in", dest="input_path", required=True, help="planning_input.json")
    ap.add_argument("--time", type=int, default=80, help="time limit per run (sec)")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--out-dir", default="/tmp/solver_profiles", help="directory for outputs")
    ap.add_argument("--seed", type=int, default=42, help="base seed (profiles add offsets)")
    ap.add_argument("--keep-inputs", action="store_true", help="keep generated input variants")
    args = ap.parse_args()

    root = os.path.abspath(os.getcwd())
    cli_path = os.path.join(root, "cli.py")
    if not os.path.exists(cli_path):
        print(f"ERROR: expected cli.py in cwd, got {cli_path}", file=sys.stderr)
        return 2

    base = _read_json(os.path.abspath(args.input_path))
    if not isinstance(base.get("rules"), dict):
        base["rules"] = {}

    profiles: List[Profile] = [
        Profile(
            id="baseline",
            label="Baseline (as-is)",
            overrides={},
        ),
        Profile(
            id="fill_first",
            label="Fill-first (reduce missing even if repeats increase)",
            overrides={
                # High missing reward (model_cp_sat uses -w_missing*missing => +w_missing*used).
                "weightMissing": 2000,
                # Reduce repeat penalty so filling does not get dominated.
                "weightRepeat": 600,
            },
        ),
        Profile(
            id="diversity_first",
            label="Diversity-first (avoid repeats, allow some missing)",
            overrides={
                "weightMissing": 500,
                "weightRepeat": 1500,
            },
        ),
    ]

    out_dir = os.path.abspath(args.out_dir)
    os.makedirs(out_dir, exist_ok=True)

    rows: List[Dict[str, Any]] = []
    for idx, prof in enumerate(profiles):
        payload = json.loads(json.dumps(base))  # deep copy
        rules = payload.setdefault("rules", {})
        for k, v in prof.overrides.items():
            rules[k] = v

        in_variant = os.path.join(out_dir, f"in_{prof.id}.json")
        out_path = os.path.join(out_dir, f"result_{prof.id}.json")
        report_path = os.path.join(out_dir, f"report_{prof.id}.json")
        log_path = os.path.join(out_dir, f"log_{prof.id}.txt")

        _write_json(in_variant, payload)
        _run_one(
            python_bin=sys.executable,
            cli_path=cli_path,
            in_path=in_variant,
            out_path=out_path,
            report_path=report_path,
            time_sec=int(args.time),
            workers=int(args.workers),
            seed=int(args.seed) + idx * 1000,
            cwd=root,
            log_path=log_path,
        )

        report = _read_json(report_path)
        metrics = _extract_metrics(report)
        metrics.update(
            {
                "profile": prof.id,
                "label": prof.label,
                "time": int(args.time),
                "seed": int(args.seed) + idx * 1000,
                "out": out_path,
                "report": report_path,
                "log": log_path,
            }
        )
        rows.append(metrics)

        if not args.keep_inputs:
            try:
                os.remove(in_variant)
            except OSError:
                pass

    # Print summary table (stable keys).
    print("profiles_summary:")
    header = [
        "profile",
        "missing",
        "repeats",
        "overT2",
        "mustVisitMissing",
        "hardViolations",
        "assignmentsOut",
        "improvements",
        "finalScore",
        "seed",
    ]
    print("  " + " | ".join(header))
    for r in rows:
        print(
            "  "
            + " | ".join(
                str(r.get(k, "")) for k in header
            )
        )

    print("\nartifacts:")
    for r in rows:
        print(f"  {r['profile']}: report={r['report']} result={r['out']} log={r['log']}")

    # Simple "satisfaction" heuristic: hard=0, must=0, then minimize missing, then repeats.
    def rank_key(r: Dict[str, Any]) -> Any:
        return (
            int(r.get("hardViolations", 999)),
            int(r.get("mustVisitMissing", 999)),
            int(r.get("missing", 999999)),
            int(r.get("repeats", 999999)),
        )

    best = sorted(rows, key=rank_key)[0] if rows else None
    if best:
        print("\nrecommended:")
        print(
            f"  profile={best['profile']} missing={best['missing']} repeats={best['repeats']} "
            f"mustVisitMissing={best['mustVisitMissing']} hardViolations={best['hardViolations']} "
            f"report={best['report']}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

