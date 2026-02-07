from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Iterable, Iterator, Optional, Set


def is_valid_date(value: str) -> bool:
    if not isinstance(value, str):
        return False
    try:
        datetime.strptime(value.strip(), "%Y-%m-%d")
        return True
    except ValueError:
        return False


def parse_date(value: str) -> Optional[datetime]:
    if not is_valid_date(value):
        return None
    return datetime.strptime(value.strip(), "%Y-%m-%d")


def format_date(value: datetime) -> str:
    return value.strftime("%Y-%m-%d")


def iter_dates(start_date: str, end_date: str) -> Iterator[str]:
    start = parse_date(start_date)
    end = parse_date(end_date)
    if start is None or end is None or start > end:
        return
    cursor = start
    while cursor <= end:
        yield format_date(cursor)
        cursor += timedelta(days=1)


def clamp_range(
    left_start: str, left_end: str, right_start: str, right_end: str
) -> Optional[Dict[str, str]]:
    start = max(left_start, right_start)
    end = min(left_end, right_end)
    if start > end:
        return None
    return {"start_date": start, "end_date": end}


def get_weekday(date_text: str) -> int:
    date_obj = parse_date(date_text)
    if date_obj is None:
        return -1
    # Python weekday: Monday=0..Sunday=6, convert to Sunday=0..Saturday=6
    return (date_obj.weekday() + 1) % 7


def parse_blocked_weekdays(value: object) -> Set[int]:
    if isinstance(value, list):
        return {
            int(item)
            for item in value
            if isinstance(item, int) and 0 <= item <= 6
        }
    if not isinstance(value, str):
        return set()
    result: Set[int] = set()
    for token in value.split(","):
        token = token.strip()
        if not token:
            continue
        try:
            day = int(token)
        except ValueError:
            continue
        if 0 <= day <= 6:
            result.add(day)
    return result


def parse_closed_dates(value: object) -> Set[str]:
    if isinstance(value, list):
        return {item for item in value if isinstance(item, str) and is_valid_date(item)}
    if not isinstance(value, str):
        return set()
    separators = [",", "，", "、", ";", "|"]
    text = value
    for sep in separators[1:]:
        text = text.replace(sep, separators[0])
    return {item.strip() for item in text.split(",") if is_valid_date(item.strip())}


def make_group_slot_key(group_id: int, date: str, slot: str) -> str:
    return f"{group_id}|{date}|{slot}"


def make_usage_key(date: str, slot: str, location_id: int) -> str:
    return f"{date}|{slot}|{location_id}"


def is_group_type_allowed(location: Dict[str, object], group: Dict[str, object]) -> bool:
    target = str(location.get("target_groups", "all"))
    if target == "all":
        return True
    return target == str(group.get("type", ""))


def is_within_open_hours(
    open_hours: Optional[Dict[str, object]], date: str, slot_window: Dict[str, float]
) -> bool:
    if not isinstance(open_hours, dict):
        return True
    weekday = get_weekday(date)
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
        if slot_window["start"] >= start and slot_window["end"] <= end:
            return True
    return False


def is_location_available(
    *,
    location: Dict[str, object],
    group: Dict[str, object],
    date: str,
    slot_window: Dict[str, float],
) -> bool:
    if not bool(location.get("is_active", False)):
        return False
    if not is_group_type_allowed(location, group):
        return False
    weekday = get_weekday(date)
    if weekday < 0:
        return False
    if weekday in location.get("blocked_weekdays", set()):
        return False
    if date in location.get("closed_dates", set()):
        return False
    if not is_within_open_hours(location.get("open_hours"), date, slot_window):
        return False
    return True


def has_capacity(
    *,
    usage_map: Dict[str, int],
    location: Dict[str, object],
    date: str,
    slot: str,
    participants: int,
    replacing_participants: int = 0,
) -> bool:
    capacity = int(location.get("capacity", 0) or 0)
    if capacity <= 0:
        return True
    key = make_usage_key(date, slot, int(location["id"]))
    used = int(usage_map.get(key, 0))
    return used - replacing_participants + participants <= capacity


def normalize_slot_windows(slot_windows: object, defaults: Dict[str, Dict[str, float]]) -> Dict[str, Dict[str, float]]:
    normalized: Dict[str, Dict[str, float]] = {}
    source = slot_windows if isinstance(slot_windows, dict) else {}
    for slot_key, default_window in defaults.items():
        row = source.get(slot_key, {})
        if not isinstance(row, dict):
            row = {}
        start = row.get("start", default_window["start"])
        end = row.get("end", default_window["end"])
        if not isinstance(start, (int, float)):
            start = default_window["start"]
        if not isinstance(end, (int, float)):
            end = default_window["end"]
        normalized[slot_key] = {"start": float(start), "end": float(end)}
    return normalized


def uniq_ints(values: Iterable[object]) -> Set[int]:
    out: Set[int] = set()
    for value in values:
        try:
            number = int(value)
        except (TypeError, ValueError):
            continue
        if number > 0:
            out.add(number)
    return out

