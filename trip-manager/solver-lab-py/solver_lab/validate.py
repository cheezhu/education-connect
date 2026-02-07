from __future__ import annotations

from typing import Any, Dict, List, Set, Tuple

from .constraints import (
    has_capacity,
    is_location_available,
    make_group_slot_key,
    make_usage_key,
)


def validate_solution(normalized: Dict[str, Any], assignments: List[Dict[str, Any]]) -> Dict[str, Any]:
    groups_by_id = normalized["groups_by_id"]
    locations_by_id = normalized["locations_by_id"]
    slot_windows = normalized["slot_windows"]
    required_by_group = normalized["required_by_group"]
    scope = normalized["scope"]

    hard_violations: List[Dict[str, Any]] = []
    usage_map: Dict[str, int] = {}
    group_slots: Set[str] = set()
    required_coverage: Set[Tuple[int, int]] = set()

    for idx, row in enumerate(assignments):
        group_id = int(row["group_id"])
        location_id = int(row["location_id"])
        date = str(row["date"])
        slot = str(row["time_slot"]).upper()
        participants = int(row["participant_count"])

        group = groups_by_id.get(group_id)
        location = locations_by_id.get(location_id)
        if group is None:
            hard_violations.append(
                {"type": "missing_group", "index": idx, "group_id": group_id}
            )
            continue
        if location is None:
            hard_violations.append(
                {"type": "missing_location", "index": idx, "location_id": location_id}
            )
            continue

        if date < scope["start_date"] or date > scope["end_date"]:
            hard_violations.append(
                {"type": "out_of_scope", "index": idx, "date": date}
            )
            continue
        if date < group["start_date"] or date > group["end_date"]:
            hard_violations.append(
                {"type": "out_of_group_range", "index": idx, "group_id": group_id, "date": date}
            )
            continue
        if slot not in slot_windows:
            hard_violations.append(
                {"type": "invalid_slot", "index": idx, "time_slot": slot}
            )
            continue

        group_slot_key = make_group_slot_key(group_id, date, slot)
        if group_slot_key in group_slots:
            hard_violations.append(
                {
                    "type": "group_slot_conflict",
                    "index": idx,
                    "group_id": group_id,
                    "date": date,
                    "time_slot": slot,
                }
            )
            continue
        group_slots.add(group_slot_key)

        if not is_location_available(
            location=location,
            group=group,
            date=date,
            slot_window=slot_windows[slot],
        ):
            hard_violations.append(
                {
                    "type": "location_unavailable",
                    "index": idx,
                    "group_id": group_id,
                    "location_id": location_id,
                    "date": date,
                    "time_slot": slot,
                }
            )
            continue

        if not has_capacity(
            usage_map=usage_map,
            location=location,
            date=date,
            slot=slot,
            participants=participants,
        ):
            hard_violations.append(
                {
                    "type": "capacity",
                    "index": idx,
                    "location_id": location_id,
                    "date": date,
                    "time_slot": slot,
                }
            )
            continue

        usage_key = make_usage_key(date, slot, location_id)
        usage_map[usage_key] = int(usage_map.get(usage_key, 0)) + participants

        if location_id in required_by_group.get(group_id, set()):
            required_coverage.add((group_id, location_id))

    must_visit_missing: List[Dict[str, Any]] = []
    for group_id, required_set in required_by_group.items():
        for location_id in required_set:
            if (group_id, location_id) not in required_coverage:
                must_visit_missing.append(
                    {"group_id": group_id, "location_id": location_id}
                )

    return {
        "hard_violations": hard_violations,
        "must_visit_missing": must_visit_missing,
    }

