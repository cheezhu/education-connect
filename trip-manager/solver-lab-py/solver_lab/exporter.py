from __future__ import annotations

import time
from typing import Any, Dict, List


def _to_result_assignments(assignments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in assignments:
        out.append(
            {
                "groupId": int(row["group_id"]),
                "locationId": int(row["location_id"]),
                "date": str(row["date"]),
                "timeSlot": str(row["time_slot"]),
                "participantCount": int(row["participant_count"]),
                "notes": str(row.get("notes", "solver")),
            }
        )
    return out


def build_result_payload(
    *,
    normalized: Dict[str, Any],
    assignments: List[Dict[str, Any]],
    config: Dict[str, Any],
    diagnostics: Dict[str, Any],
    elapsed_ms: int,
) -> Dict[str, Any]:
    return {
        "schema": "ec-planning-result@1",
        "snapshot_id": f"solver-py-{int(time.time() * 1000)}",
        "mode": "replaceExisting",
        "range": {
            "startDate": normalized["scope"]["start_date"],
            "endDate": normalized["scope"]["end_date"],
        },
        "rules": {
            "timeSlots": normalized["slot_keys"],
            "slotWindows": normalized["slot_windows"],
        },
        "assignments": _to_result_assignments(assignments),
        "unassigned": [],
        "meta": {
            "solver": "solver-lab-py@1",
            "seed": int(config["seed"]),
            "timeLimitSec": int(config["time_limit_sec"]),
            "elapsedMs": int(elapsed_ms),
            "engine": diagnostics.get("phase1_engine", "unknown"),
        },
    }


def build_report_payload(
    *,
    normalized: Dict[str, Any],
    precheck: Dict[str, Any],
    phase1: Dict[str, Any],
    optimized: Dict[str, Any],
    audit: Dict[str, Any],
    elapsed_ms: int,
) -> Dict[str, Any]:
    return {
        "summary": {
            "groups": len(normalized["groups"]),
            "locations": len(normalized["locations"]),
            "assignmentsInput": len(normalized["existing_assignments"]),
            "assignmentsOutput": len(optimized["assignments"]),
            "elapsedMs": int(elapsed_ms),
        },
        "precheck": {
            "blockingErrors": precheck.get("blocking_errors", []),
            "warnings": precheck.get("warnings", []),
        },
        "phase1": {
            "engine": phase1.get("engine"),
            "status": phase1.get("status"),
            "objective": phase1.get("objective"),
            "diagnostics": phase1.get("diagnostics", {}),
        },
        "optimize": {
            "engine": optimized.get("engine"),
            "diagnostics": optimized.get("diagnostics", {}),
        },
        "audit": {
            "hardViolations": audit.get("hard_violations", []),
            "mustVisitMissing": audit.get("must_visit_missing", []),
        },
    }

