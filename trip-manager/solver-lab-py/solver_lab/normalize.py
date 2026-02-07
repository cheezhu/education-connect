from __future__ import annotations

from typing import Any, Dict, List, Tuple

from .constraints import (
    is_valid_date,
    normalize_slot_windows,
    parse_blocked_weekdays,
    parse_closed_dates,
    uniq_ints,
)

DEFAULT_SLOT_WINDOWS = {
    "MORNING": {"start": 6.0, "end": 12.0},
    "AFTERNOON": {"start": 12.0, "end": 18.0},
    "EVENING": {"start": 18.0, "end": 20.75},
}


def _as_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _as_bool(value: Any, fallback: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return int(value) != 0
    if isinstance(value, str):
        token = value.strip().lower()
        if token in {"1", "true", "yes", "y", "on"}:
            return True
        if token in {"0", "false", "no", "n", "off"}:
            return False
    return fallback


def _extract_schema_view(payload: Dict[str, Any]) -> Tuple[str, Dict[str, Any], Dict[str, Any]]:
    schema = str(payload.get("schema") or "").strip()
    if schema == "ec-planning-input@2":
        scope = payload.get("scope", {})
        if not isinstance(scope, dict):
            scope = {}
        view = payload.get("data", {})
        if not isinstance(view, dict):
            view = {}
        return schema, scope, view

    if schema == "ec-planning-input@1":
        scope = payload.get("range", {})
        if not isinstance(scope, dict):
            scope = {}
        existing = payload.get("existing", {})
        if not isinstance(existing, dict):
            existing = {}
        view = {
            "groups": payload.get("groups", []),
            "locations": payload.get("locations", []),
            "requiredLocationsByGroup": payload.get("must_visit_by_group", {}),
            "legacyPlanItemsByGroup": payload.get("plan_items_by_group", {}),
            "existingAssignments": existing.get("activities", []),
        }
        return schema, scope, view

    raise ValueError(f"Unsupported schema: {schema or 'unknown'}")


def normalize_input(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Input payload must be an object")
    schema, scope, data = _extract_schema_view(payload)

    start_date = str(scope.get("startDate", "")).strip()
    end_date = str(scope.get("endDate", "")).strip()
    if not is_valid_date(start_date) or not is_valid_date(end_date) or start_date > end_date:
        raise ValueError("Invalid scope date range")

    rules = payload.get("rules", {})
    if not isinstance(rules, dict):
        rules = {}
    cluster_day_penalty = _as_int(rules.get("clusterDayPenalty", 40), 40)
    if cluster_day_penalty <= 0:
        cluster_day_penalty = 40
    slot_windows = normalize_slot_windows(rules.get("slotWindows"), DEFAULT_SLOT_WINDOWS)
    raw_slots = rules.get("timeSlots")
    if not isinstance(raw_slots, list):
        raw_slots = list(slot_windows.keys())
    slot_keys: List[str] = []
    for value in raw_slots:
        slot = str(value).upper().strip()
        if slot in slot_windows and slot not in slot_keys:
            slot_keys.append(slot)
    if not slot_keys:
        slot_keys = ["MORNING", "AFTERNOON"]

    groups: List[Dict[str, Any]] = []
    for row in data.get("groups", []):
        if not isinstance(row, dict):
            continue
        group_id = _as_int(row.get("id"))
        if group_id <= 0:
            continue
        group_start = str(row.get("startDate", row.get("start_date", ""))).strip()
        group_end = str(row.get("endDate", row.get("end_date", ""))).strip()
        if not is_valid_date(group_start) or not is_valid_date(group_end) or group_start > group_end:
            continue
        student_count = max(0, _as_int(row.get("studentCount", row.get("student_count", 0)), 0))
        teacher_count = max(0, _as_int(row.get("teacherCount", row.get("teacher_count", 0)), 0))
        participant_count = _as_int(
            row.get("participantCount", student_count + teacher_count),
            student_count + teacher_count,
        )
        if participant_count <= 0:
            participant_count = max(1, student_count + teacher_count)
        groups.append(
            {
                "id": group_id,
                "name": str(row.get("name", "")).strip() or f"#{group_id}",
                "type": str(row.get("type", "all")).strip() or "all",
                "start_date": group_start,
                "end_date": group_end,
                "participant_count": participant_count,
            }
        )

    locations: List[Dict[str, Any]] = []
    for row in data.get("locations", []):
        if not isinstance(row, dict):
            continue
        location_id = _as_int(row.get("id"))
        if location_id <= 0:
            continue
        capacity = _as_int(row.get("capacity"), 0)
        if capacity < 0:
            capacity = 0
        locations.append(
            {
                "id": location_id,
                "name": str(row.get("name", "")).strip() or f"#{location_id}",
                "target_groups": str(row.get("targetGroups", row.get("target_groups", "all"))).strip() or "all",
                "is_active": bool(row.get("isActive", row.get("is_active", False))),
                "capacity": capacity,
                "cluster_prefer_same_day": _as_bool(
                    row.get(
                        "clusterPreferSameDay",
                        row.get(
                            "cluster_prefer_same_day",
                            row.get("clusterSameDay", False),
                        ),
                    )
                ),
                "blocked_weekdays": parse_blocked_weekdays(
                    row.get("blockedWeekdays", row.get("blocked_weekdays"))
                ),
                "closed_dates": parse_closed_dates(row.get("closedDates", row.get("closed_dates"))),
                "open_hours": (
                    row.get("openHours")
                    if isinstance(row.get("openHours"), dict)
                    else (row.get("open_hours") if isinstance(row.get("open_hours"), dict) else None)
                ),
            }
        )

    required_by_group: Dict[int, set] = {}
    required_raw = data.get("requiredLocationsByGroup", {})
    if not isinstance(required_raw, dict):
        required_raw = {}
    for group_key, row in required_raw.items():
        try:
            group_id = int(group_key)
        except (TypeError, ValueError):
            continue
        if not isinstance(row, dict):
            continue
        ids = row.get("locationIds")
        if not isinstance(ids, list):
            ids = []
        if not ids:
            # v1 fallback: must_visit_by_group entries may be [{location_id,...}]
            legacy_rows = row.get("locations")
            if isinstance(legacy_rows, list):
                ids = [item.get("locationId") for item in legacy_rows if isinstance(item, dict)]
            else:
                ids = [row.get("location_id")]
        normalized_ids = uniq_ints(ids)
        required_by_group[group_id] = normalized_ids

    # v1 fallback: plan_items_by_group if required map is empty for some group
    legacy_plan_items = data.get("legacyPlanItemsByGroup", {})
    if isinstance(legacy_plan_items, dict):
        for group_key, entries in legacy_plan_items.items():
            try:
                group_id = int(group_key)
            except (TypeError, ValueError):
                continue
            if group_id in required_by_group and required_by_group[group_id]:
                continue
            if not isinstance(entries, list):
                continue
            ids = uniq_ints(
                [
                    item.get("location_id")
                    for item in entries
                    if isinstance(item, dict)
                ]
            )
            if ids:
                required_by_group[group_id] = ids

    existing_assignments: List[Dict[str, Any]] = []
    for row in data.get("existingAssignments", []):
        if not isinstance(row, dict):
            continue
        group_id = _as_int(row.get("groupId", row.get("group_id")))
        location_id = _as_int(row.get("locationId", row.get("location_id")))
        date = str(row.get("date", row.get("activity_date", ""))).strip()
        slot = str(row.get("timeSlot", row.get("time_slot", ""))).upper().strip()
        participant_count = max(1, _as_int(row.get("participantCount", row.get("participant_count", 1)), 1))
        if group_id <= 0 or location_id <= 0:
            continue
        if not is_valid_date(date):
            continue
        if slot not in slot_keys:
            continue
        existing_assignments.append(
            {
                "group_id": group_id,
                "location_id": location_id,
                "date": date,
                "time_slot": slot,
                "participant_count": participant_count,
            }
        )

    return {
        "raw": payload,
        "schema": schema,
        "scope": {"start_date": start_date, "end_date": end_date},
        "slot_keys": slot_keys,
        "slot_windows": slot_windows,
        "cluster_day_penalty": cluster_day_penalty,
        "groups": groups,
        "locations": locations,
        "groups_by_id": {row["id"]: row for row in groups},
        "locations_by_id": {row["id"]: row for row in locations},
        "cluster_location_ids": {
            row["id"] for row in locations if bool(row.get("cluster_prefer_same_day", False))
        },
        "required_by_group": required_by_group,
        "existing_assignments": existing_assignments,
    }
