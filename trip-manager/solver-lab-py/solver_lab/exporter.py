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
    candidates: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    groups_by_id = normalized.get("groups_by_id", {})
    locations_by_id = normalized.get("locations_by_id", {})

    must_missing = audit.get("must_visit_missing", []) or []
    # Group missing required locations by group.
    must_missing_by_group = {}
    for row in must_missing:
        gid = int(row.get("group_id"))
        lid = int(row.get("location_id"))
        g = groups_by_id.get(gid) or {}
        l = locations_by_id.get(lid) or {}
        must_missing_by_group.setdefault(str(gid), []).append({
            "locationId": lid,
            "locationName": str(l.get("name", "")),
        })
        # also store group name for convenience (duplicated, tiny)
        must_missing_by_group[str(gid)] = sorted(must_missing_by_group[str(gid)], key=lambda x: x["locationId"])

    must_missing_groups = []
    for gid_text, locs in must_missing_by_group.items():
        gid = int(gid_text)
        g = groups_by_id.get(gid) or {}
        must_missing_groups.append({
            "groupId": gid,
            "groupName": str(g.get("name", "")),
            "missing": locs,
        })
    must_missing_groups.sort(key=lambda x: x["groupId"])

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
            **({"candidates": candidates} if candidates else {}),
        },
        "audit": {
            "hardViolations": audit.get("hard_violations", []),
            "mustVisitMissing": must_missing,
            "mustVisitMissingGroups": must_missing_groups,
        },
    }
