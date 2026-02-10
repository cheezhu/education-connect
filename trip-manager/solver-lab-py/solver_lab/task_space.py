from __future__ import annotations

from typing import Any, Dict, List

from .constraints import clamp_range, is_location_available, iter_dates, make_group_slot_key


def build_task_space(normalized: Dict[str, Any]) -> Dict[str, Any]:
    tasks: List[Dict[str, Any]] = []
    tasks_by_key: Dict[str, Dict[str, Any]] = {}
    tasks_by_group: Dict[int, List[Dict[str, Any]]] = {}

    groups = normalized["groups"]
    locations = normalized["locations"]
    scope = normalized["scope"]
    slot_keys = normalized["slot_keys"]
    slot_windows = normalized["slot_windows"]

    existing_by_task: Dict[str, Dict[str, Any]] = {}
    for row in normalized["existing_assignments"]:
        key = make_group_slot_key(row["group_id"], row["date"], row["time_slot"])
        if key not in existing_by_task:
            existing_by_task[key] = row

    for group in groups:
        overlap = clamp_range(
            scope["start_date"],
            scope["end_date"],
            group["start_date"],
            group["end_date"],
        )
        if overlap is None:
            tasks_by_group[group["id"]] = []
            continue
        group_tasks: List[Dict[str, Any]] = []
        group_start = str(group["start_date"])
        group_end = str(group["end_date"])
        is_single_day = group_start == group_end

        for date in iter_dates(overlap["start_date"], overlap["end_date"]):
            for slot in slot_keys:
                key = make_group_slot_key(group["id"], date, slot)

                # Business rule: no visit points on the first day MORNING.
                if date == group_start and slot == "MORNING":
                    candidates = []
                # Business rule: for multi-day groups only, no visit points on the last day AFTERNOON.
                elif (not is_single_day) and date == group_end and slot == "AFTERNOON":
                    candidates = []
                else:
                    candidates = []
                    for location in locations:
                        if is_location_available(
                            location=location,
                            group=group,
                            date=date,
                            slot_window=slot_windows[slot],
                        ):
                            candidates.append(int(location["id"]))
                task = {
                    "key": key,
                    "group_id": int(group["id"]),
                    "date": date,
                    "time_slot": slot,
                    "participant_count": int(group["participant_count"]),
                    "candidate_location_ids": candidates,
                    "existing_location_id": int(existing_by_task[key]["location_id"])
                    if key in existing_by_task
                    else None,
                }
                tasks.append(task)
                group_tasks.append(task)
                tasks_by_key[key] = task
        tasks_by_group[group["id"]] = group_tasks

    return {
        "tasks": tasks,
        "tasks_by_key": tasks_by_key,
        "tasks_by_group": tasks_by_group,
    }

