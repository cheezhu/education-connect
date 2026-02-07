from __future__ import annotations

from typing import Any, Dict, List

from .task_space import build_task_space


def run_precheck(normalized: Dict[str, Any]) -> Dict[str, Any]:
    task_space = build_task_space(normalized)
    groups_by_id = normalized["groups_by_id"]
    locations_by_id = normalized["locations_by_id"]
    required_by_group = normalized["required_by_group"]

    blocking_errors: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []

    for group in normalized["groups"]:
        group_id = int(group["id"])
        tasks = task_space["tasks_by_group"].get(group_id, [])
        if not tasks:
            warnings.append(
                {
                    "type": "group_no_slots_in_scope",
                    "group_id": group_id,
                    "group_name": group["name"],
                }
            )

    for group_id, required_ids in required_by_group.items():
        group = groups_by_id.get(group_id)
        if group is None:
            blocking_errors.append(
                {
                    "type": "required_group_missing",
                    "group_id": group_id,
                    "message": f"group {group_id} not found but has required locations",
                }
            )
            continue

        group_tasks = task_space["tasks_by_group"].get(group_id, [])
        for location_id in sorted(required_ids):
            location = locations_by_id.get(location_id)
            if location is None:
                blocking_errors.append(
                    {
                        "type": "required_location_missing",
                        "group_id": group_id,
                        "group_name": group["name"],
                        "location_id": location_id,
                    }
                )
                continue

            candidate_exists = False
            for task in group_tasks:
                if location_id in task["candidate_location_ids"]:
                    candidate_exists = True
                    break
            if not candidate_exists:
                blocking_errors.append(
                    {
                        "type": "required_location_no_feasible_slot",
                        "group_id": group_id,
                        "group_name": group["name"],
                        "location_id": location_id,
                        "location_name": location["name"],
                    }
                )

    return {
        "task_space": task_space,
        "blocking_errors": blocking_errors,
        "warnings": warnings,
    }

