from __future__ import annotations

from typing import Any, Dict, List

from .constraints import has_capacity, make_group_slot_key, make_usage_key
from .model_cp_sat import build_cp_model, is_cp_sat_available, solve_cp_model


def _solve_greedy_feasible(normalized: Dict[str, Any], task_space: Dict[str, Any]) -> Dict[str, Any]:
    groups_by_id = normalized["groups_by_id"]
    locations_by_id = normalized["locations_by_id"]
    required_by_group = normalized["required_by_group"]
    slot_map: Dict[str, Dict[str, Any]] = {}
    usage_map: Dict[str, int] = {}
    diagnostics = {
        "kept_existing": 0,
        "added_required": 0,
        "unplaced_required": [],
    }

    # keep existing assignments if still valid and conflict-free
    for row in normalized["existing_assignments"]:
        group = groups_by_id.get(row["group_id"])
        location = locations_by_id.get(row["location_id"])
        if group is None or location is None:
            continue
        task_key = make_group_slot_key(row["group_id"], row["date"], row["time_slot"])
        if task_key in slot_map:
            continue
        if row["location_id"] not in task_space["tasks_by_key"].get(task_key, {}).get(
            "candidate_location_ids", []
        ):
            continue
        if not has_capacity(
            usage_map=usage_map,
            location=location,
            date=row["date"],
            slot=row["time_slot"],
            participants=int(row["participant_count"]),
        ):
            continue
        slot_map[task_key] = dict(row)
        usage_key = make_usage_key(row["date"], row["time_slot"], row["location_id"])
        usage_map[usage_key] = int(usage_map.get(usage_key, 0)) + int(row["participant_count"])
        diagnostics["kept_existing"] += 1

    def has_required(group_id: int, location_id: int) -> bool:
        for assignment in slot_map.values():
            if assignment["group_id"] == group_id and assignment["location_id"] == location_id:
                return True
        return False

    # force required locations
    for group_id, required_set in required_by_group.items():
        tasks = task_space["tasks_by_group"].get(group_id, [])
        group = groups_by_id.get(group_id)
        if group is None:
            continue
        for location_id in sorted(required_set):
            if has_required(group_id, location_id):
                continue
            location = locations_by_id.get(location_id)
            if location is None:
                diagnostics["unplaced_required"].append(
                    {"group_id": group_id, "location_id": location_id, "reason": "location_missing"}
                )
                continue
            placed = False
            for task in tasks:
                if location_id not in task["candidate_location_ids"]:
                    continue
                task_key = task["key"]
                if task_key in slot_map:
                    continue
                if not has_capacity(
                    usage_map=usage_map,
                    location=location,
                    date=task["date"],
                    slot=task["time_slot"],
                    participants=int(group["participant_count"]),
                ):
                    continue
                assignment = {
                    "group_id": group_id,
                    "location_id": location_id,
                    "date": task["date"],
                    "time_slot": task["time_slot"],
                    "participant_count": int(group["participant_count"]),
                }
                slot_map[task_key] = assignment
                usage_key = make_usage_key(task["date"], task["time_slot"], location_id)
                usage_map[usage_key] = int(usage_map.get(usage_key, 0)) + int(group["participant_count"])
                diagnostics["added_required"] += 1
                placed = True
                break
            if not placed:
                diagnostics["unplaced_required"].append(
                    {"group_id": group_id, "location_id": location_id, "reason": "no_slot"}
                )

    assignments = list(slot_map.values())
    assignments.sort(
        key=lambda row: (row["group_id"], row["date"], normalized["slot_keys"].index(row["time_slot"]))
    )
    return {
        "engine": "greedy_feasible",
        "status": "feasible",
        "assignments": assignments,
        "objective": None,
        "diagnostics": diagnostics,
    }


def solve_feasible(
    normalized: Dict[str, Any],
    config: Dict[str, Any],
    precheck: Dict[str, Any],
) -> Dict[str, Any]:
    task_space = precheck["task_space"]
    phase1_sec = max(1, int(config["time_limit_sec"] * config["phase1_ratio"]))

    if is_cp_sat_available():
        cp_bundle = build_cp_model(
            normalized=normalized,
            task_space=task_space,
            with_objective=False,
        )
        if cp_bundle is not None:
            cp_result = solve_cp_model(
                cp_bundle,
                time_limit_sec=phase1_sec,
                workers=config["workers"],
                seed=config["seed"],
                stop_after_first=True,
            )
            if cp_result["assignments"]:
                return {
                    "engine": "cp_sat_feasible",
                    "status": cp_result["status"],
                    "assignments": cp_result["assignments"],
                    "objective": cp_result.get("objective"),
                    "diagnostics": {
                        "phase1_time_sec": phase1_sec,
                        "best_bound": cp_result.get("best_bound"),
                    },
                }

    fallback = _solve_greedy_feasible(normalized, task_space)
    fallback["diagnostics"]["phase1_time_sec"] = phase1_sec
    return fallback

