#!/usr/bin/env python3
"""
Analyze "middle-day missing slots" candidate availability from an ec-planning-input@2 payload.

This script is intentionally self-contained (stdlib only) and reads only the given input JSON.
It reconstructs tasks as (group_id, date, time_slot) across the scope overlap, then computes
candidate_location_ids using the same availability rules as the solver's task_space generation:
- location.isActive
- location.targetGroups vs group.type (or "all")
- blockedWeekdays / closedDates / openHours against the slot window

It then reports middle-day MORNING/AFTERNOON tasks (excluding forbidden boundary slots) and
their candidate count distribution, plus the first 30 tasks with candidate_count=0.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, Iterator, List, Optional, Set, Tuple


DEFAULT_SLOT_WINDOWS = {
    "MORNING": {"start": 6.0, "end": 12.0},
    "AFTERNOON": {"start": 12.0, "end": 18.0},
    "EVENING": {"start": 18.0, "end": 20.75},
}


def _is_valid_date(value: str) -> bool:
    if not isinstance(value, str):
        return False
    try:
        datetime.strptime(value.strip(), "%Y-%m-%d")
        return True
    except ValueError:
        return False


def _parse_date(value: str) -> Optional[datetime]:
    if not _is_valid_date(value):
        return None
    return datetime.strptime(value.strip(), "%Y-%m-%d")


def _iter_dates(start_date: str, end_date: str) -> Iterator[str]:
    start = _parse_date(start_date)
    end = _parse_date(end_date)
    if start is None or end is None or start > end:
        return
    cursor = start
    while cursor <= end:
        yield cursor.strftime("%Y-%m-%d")
        cursor += timedelta(days=1)


def _clamp_range(left_start: str, left_end: str, right_start: str, right_end: str) -> Optional[Tuple[str, str]]:
    start = max(left_start, right_start)
    end = min(left_end, right_end)
    if start > end:
        return None
    return start, end


def _get_weekday_sun0(date_text: str) -> int:
    """Return Sunday=0..Saturday=6; -1 on invalid date."""
    d = _parse_date(date_text)
    if d is None:
        return -1
    # Python weekday: Monday=0..Sunday=6; convert to Sunday=0..Saturday=6.
    return (d.weekday() + 1) % 7


def _parse_blocked_weekdays(value: object) -> Set[int]:
    if isinstance(value, list):
        return {int(item) for item in value if isinstance(item, int) and 0 <= item <= 6}
    if not isinstance(value, str):
        return set()
    out: Set[int] = set()
    for token in value.split(","):
        token = token.strip()
        if not token:
            continue
        try:
            day = int(token)
        except ValueError:
            continue
        if 0 <= day <= 6:
            out.add(day)
    return out


def _parse_closed_dates(value: object) -> Set[str]:
    if isinstance(value, list):
        return {item for item in value if isinstance(item, str) and _is_valid_date(item)}
    if not isinstance(value, str):
        return set()
    # Support common separators.
    separators = [",", "，", "、", ";", "|"]
    text = value
    for sep in separators[1:]:
        text = text.replace(sep, separators[0])
    return {item.strip() for item in text.split(",") if _is_valid_date(item.strip())}


def _is_group_type_allowed(location: Dict[str, Any], group: Dict[str, Any]) -> bool:
    target = str(location.get("target_groups", "all"))
    if target == "all":
        return True
    return target == str(group.get("type", ""))


def _is_within_open_hours(open_hours: object, date: str, slot_window: Dict[str, float]) -> bool:
    if not isinstance(open_hours, dict):
        return True
    weekday = _get_weekday_sun0(date)
    if weekday < 0:
        return False
    windows = open_hours.get(str(weekday)) or open_hours.get("default")
    if not isinstance(windows, list) or not windows:
        return False
    for window in windows:
        if not isinstance(window, dict):
            continue
        start = window.get("start")
        end = window.get("end")
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
            continue
        if slot_window["start"] >= float(start) and slot_window["end"] <= float(end):
            return True
    return False


def _is_location_available(*, location: Dict[str, Any], group: Dict[str, Any], date: str, slot_window: Dict[str, float]) -> bool:
    if not bool(location.get("is_active", False)):
        return False
    if not _is_group_type_allowed(location, group):
        return False
    weekday = _get_weekday_sun0(date)
    if weekday < 0:
        return False
    if weekday in (location.get("blocked_weekdays") or set()):
        return False
    if date in (location.get("closed_dates") or set()):
        return False
    if not _is_within_open_hours(location.get("open_hours"), date, slot_window):
        return False
    return True


def _forbidden_slot(group: Dict[str, Any], date_text: str, slot_key: str) -> bool:
    start = str(group.get("start_date"))
    end = str(group.get("end_date"))
    is_single = start == end
    slot_key = str(slot_key).upper()
    if date_text == start and slot_key == "MORNING":
        return True
    if (not is_single) and date_text == end and slot_key == "AFTERNOON":
        return True
    return False


def _make_task_key(group_id: int, date: str, slot: str) -> str:
    return f"{int(group_id)}|{str(date)}|{str(slot)}"


def _normalize_slot_windows(raw: object) -> Dict[str, Dict[str, float]]:
    source = raw if isinstance(raw, dict) else {}
    out: Dict[str, Dict[str, float]] = {}
    for slot_key, default_window in DEFAULT_SLOT_WINDOWS.items():
        row = source.get(slot_key, {})
        if not isinstance(row, dict):
            row = {}
        start = row.get("start", default_window["start"])
        end = row.get("end", default_window["end"])
        if not isinstance(start, (int, float)):
            start = default_window["start"]
        if not isinstance(end, (int, float)):
            end = default_window["end"]
        out[str(slot_key).upper()] = {"start": float(start), "end": float(end)}
    return out


def _load_input(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="planning_input.json (ec-planning-input@2)")
    args = ap.parse_args()

    payload = _load_input(args.input)
    schema = str(payload.get("schema") or "").strip()
    if schema != "ec-planning-input@2":
        raise SystemExit(f"Unsupported schema: {schema or 'unknown'} (expected ec-planning-input@2)")

    scope = payload.get("scope") if isinstance(payload.get("scope"), dict) else {}
    rules = payload.get("rules") if isinstance(payload.get("rules"), dict) else {}
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}

    scope_start = str(scope.get("startDate", "")).strip()
    scope_end = str(scope.get("endDate", "")).strip()
    if not _is_valid_date(scope_start) or not _is_valid_date(scope_end) or scope_start > scope_end:
        raise SystemExit("Invalid scope date range in input")

    scope_group_ids = set()
    if isinstance(scope.get("groupIds"), list):
        for v in scope["groupIds"]:
            try:
                n = int(v)
            except (TypeError, ValueError):
                continue
            if n > 0:
                scope_group_ids.add(n)

    slot_windows = _normalize_slot_windows(rules.get("slotWindows"))
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

    groups_in = data.get("groups", [])
    if not isinstance(groups_in, list):
        groups_in = []
    locations_in = data.get("locations", [])
    if not isinstance(locations_in, list):
        locations_in = []

    groups: List[Dict[str, Any]] = []
    for row in groups_in:
        if not isinstance(row, dict):
            continue
        try:
            gid = int(row.get("id"))
        except (TypeError, ValueError):
            continue
        if gid <= 0:
            continue
        if scope_group_ids and gid not in scope_group_ids:
            continue
        start = str(row.get("startDate") or row.get("start_date") or "").strip()
        end = str(row.get("endDate") or row.get("end_date") or "").strip()
        if not _is_valid_date(start) or not _is_valid_date(end) or start > end:
            continue
        groups.append(
            {
                "id": gid,
                "type": str(row.get("type") or "all"),
                "start_date": start,
                "end_date": end,
            }
        )

    locations: List[Dict[str, Any]] = []
    for row in locations_in:
        if not isinstance(row, dict):
            continue
        try:
            lid = int(row.get("id"))
        except (TypeError, ValueError):
            continue
        if lid <= 0:
            continue
        locations.append(
            {
                "id": lid,
                "is_active": bool(row.get("isActive") if "isActive" in row else row.get("is_active", False)),
                "target_groups": str(row.get("targetGroups") if "targetGroups" in row else row.get("target_groups", "all")),
                "blocked_weekdays": _parse_blocked_weekdays(row.get("blockedWeekdays") if "blockedWeekdays" in row else row.get("blocked_weekdays")),
                "closed_dates": _parse_closed_dates(row.get("closedDates") if "closedDates" in row else row.get("closed_dates")),
                "open_hours": row.get("openHours") if isinstance(row.get("openHours"), dict) else (row.get("open_hours") if isinstance(row.get("open_hours"), dict) else None),
            }
        )

    # Middle-day missing definition (match model_cp_sat.py):
    # - group.start_date < date < group.end_date
    # - time_slot in {MORNING, AFTERNOON}
    # - exclude forbidden boundary slots (start day MORNING, end day AFTERNOON for multi-day groups)
    total_middle = 0
    bucket_0 = 0
    bucket_1 = 0
    bucket_2_5 = 0
    bucket_6p = 0
    zero_candidates: List[Tuple[int, str, str, str]] = []

    for g in groups:
        gid = int(g["id"])
        clamp = _clamp_range(scope_start, scope_end, str(g["start_date"]), str(g["end_date"]))
        if clamp is None:
            continue
        overlap_start, overlap_end = clamp
        g_start = str(g["start_date"])
        g_end = str(g["end_date"])

        for date in _iter_dates(overlap_start, overlap_end):
            if not (g_start < date < g_end):
                continue
            for slot in slot_keys:
                slot = str(slot).upper()
                if slot not in {"MORNING", "AFTERNOON"}:
                    continue
                if _forbidden_slot(g, date, slot):
                    continue

                total_middle += 1
                window = slot_windows.get(slot, DEFAULT_SLOT_WINDOWS.get(slot, {"start": 0.0, "end": 24.0}))
                candidates = [
                    int(loc["id"])
                    for loc in locations
                    if _is_location_available(location=loc, group=g, date=date, slot_window=window)
                ]

                c = len(candidates)
                if c == 0:
                    bucket_0 += 1
                    zero_candidates.append((gid, date, slot, _make_task_key(gid, date, slot)))
                elif c == 1:
                    bucket_1 += 1
                elif 2 <= c <= 5:
                    bucket_2_5 += 1
                else:
                    bucket_6p += 1

    print(f"input: {args.input}")
    print(f"scope: {scope_start}..{scope_end} groups={len(groups)} locations={len(locations)} slots={slot_keys}")
    print("middle-day missing-task stats (MORNING/AFTERNOON, forbidden excluded):")
    print(f"- middle_total: {total_middle}")
    print(f"- candidate_count=0: {bucket_0}")
    print(f"- candidate_count=1: {bucket_1}")
    print(f"- candidate_count=2-5: {bucket_2_5}")
    print(f"- candidate_count>=6: {bucket_6p}")
    print("")
    print("candidate_count=0 tasks (first 30):")
    if not zero_candidates:
        print("(none)")
    else:
        for gid, date, slot, key in zero_candidates[:30]:
            print(f"{gid}\t{date}\t{slot}\t{key}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

