from __future__ import annotations

import random
import time
from typing import Any, Dict, List, Set, Tuple

from .constraints import make_group_slot_key, make_usage_key
from .model_cp_sat import build_cp_model, is_cp_sat_available, solve_cp_model


def _assignment_index(assignments: List[Dict[str, Any]]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for row in assignments:
        key = make_group_slot_key(row["group_id"], row["date"], row["time_slot"])
        out[key] = int(row["location_id"])
    return out


def _score_solution(normalized: Dict[str, Any], assignments: List[Dict[str, Any]]) -> int:
    required_by_group = normalized["required_by_group"]
    cluster_location_ids = set(normalized.get("cluster_location_ids", set()))
    cluster_day_penalty = int(normalized.get("cluster_day_penalty", 40) or 40)
    if cluster_day_penalty < 0:
        cluster_day_penalty = 0
    existing = {
        make_group_slot_key(row["group_id"], row["date"], row["time_slot"]): row["location_id"]
        for row in normalized["existing_assignments"]
    }
    coverage = set()
    clustered_days: Dict[int, Set[str]] = {}
    score = 0
    for row in assignments:
        key = make_group_slot_key(row["group_id"], row["date"], row["time_slot"])
        score += 1
        if existing.get(key) == row["location_id"]:
            score += 60
        if row["location_id"] in required_by_group.get(row["group_id"], set()):
            coverage.add((row["group_id"], row["location_id"]))
            score += 20
        location_id = int(row["location_id"])
        if location_id in cluster_location_ids:
            clustered_days.setdefault(location_id, set()).add(str(row["date"]))
    required_count = sum(len(v) for v in required_by_group.values())
    score += len(coverage) * 200
    score -= (required_count - len(coverage)) * 400
    if cluster_day_penalty > 0 and clustered_days:
        score -= sum(len(days) for days in clustered_days.values()) * cluster_day_penalty
    return score


def _build_existing_index(normalized: Dict[str, Any]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for row in normalized["existing_assignments"]:
        key = make_group_slot_key(row["group_id"], row["date"], row["time_slot"])
        out[key] = int(row["location_id"])
    return out


def _build_group_location_task_index(task_space: Dict[str, Any]) -> Dict[Tuple[int, int], List[str]]:
    index: Dict[Tuple[int, int], List[str]] = {}
    for task in task_space["tasks"]:
        group_id = int(task["group_id"])
        task_key = str(task["key"])
        for location_id in task["candidate_location_ids"]:
            index.setdefault((group_id, int(location_id)), []).append(task_key)
    return index


def _find_missing_required_pairs(
    normalized: Dict[str, Any],
    task_space: Dict[str, Any],
    incumbent: Dict[str, int],
) -> List[Tuple[int, int]]:
    covered: Set[Tuple[int, int]] = set()
    required_by_group = normalized["required_by_group"]

    for group_id, tasks in task_space["tasks_by_group"].items():
        required_set = required_by_group.get(group_id, set())
        if not required_set:
            continue
        for task in tasks:
            location_id = incumbent.get(task["key"])
            if location_id is None:
                continue
            if location_id in required_set:
                covered.add((group_id, location_id))

    missing: List[Tuple[int, int]] = []
    for group_id, required_set in required_by_group.items():
        for location_id in required_set:
            pair = (int(group_id), int(location_id))
            if pair not in covered:
                missing.append(pair)
    return missing


def _find_overloaded_usage(
    normalized: Dict[str, Any],
    task_space: Dict[str, Any],
    incumbent: Dict[str, int],
) -> Tuple[List[str], Dict[str, List[str]]]:
    usage_people: Dict[str, int] = {}
    usage_tasks: Dict[str, List[str]] = {}
    locations_by_id = normalized["locations_by_id"]

    for task in task_space["tasks"]:
        task_key = str(task["key"])
        location_id = incumbent.get(task_key)
        if location_id is None:
            continue
        usage_key = make_usage_key(task["date"], task["time_slot"], int(location_id))
        usage_people[usage_key] = usage_people.get(usage_key, 0) + int(task["participant_count"])
        usage_tasks.setdefault(usage_key, []).append(task_key)

    overloaded: List[Tuple[int, str]] = []
    for usage_key, people in usage_people.items():
        _, _, location_id_text = usage_key.split("|")
        location = locations_by_id.get(int(location_id_text))
        if not location:
            continue
        capacity = int(location.get("capacity", 0) or 0)
        if capacity > 0 and people > capacity:
            overloaded.append((people - capacity, usage_key))
    overloaded.sort(key=lambda row: row[0], reverse=True)

    return [row[1] for row in overloaded], usage_tasks


def _find_displaced_existing_keys(existing: Dict[str, int], incumbent: Dict[str, int]) -> List[str]:
    displaced: List[str] = []
    for task_key, existing_location_id in existing.items():
        current_location_id = incumbent.get(task_key)
        if current_location_id is None:
            continue
        if int(current_location_id) != int(existing_location_id):
            displaced.append(task_key)
    return displaced


def _release_mode_name_zh(mode: str) -> str:
    mapping = {
        "phase1": "初始解",
        "base_optimize": "基础优化",
        "missing_required": "必去点优先",
        "overloaded_capacity": "容量热点",
        "displaced_existing": "偏离原排程",
        "random": "随机探索",
        "mixed": "混合策略",
        "final": "最终结果",
        "none": "无",
    }
    return mapping.get(str(mode), str(mode))


def _build_curve_note_zh(point: Dict[str, Any]) -> str:
    iter_value = point.get("iter")
    iter_score = point.get("iterScore")
    best_score = point.get("bestScore")
    released_count = int(point.get("releasedCount", 0) or 0)
    release_mode = _release_mode_name_zh(str(point.get("releaseMode", "unknown")))
    accepted = bool(point.get("accepted", False))
    release_ratio = point.get("releaseRatio")

    if iter_value == 0:
        return f"初始可行解得分 {best_score}。"
    if iter_value == "base":
        if accepted:
            return f"基础优化后得分提升到 {best_score}。"
        return f"基础优化得分 {iter_score}，未超过当前最优 {best_score}。"
    if iter_value == "final":
        return f"优化结束，最终得分 {best_score}。"

    ratio_text = ""
    if isinstance(release_ratio, (float, int)):
        ratio_text = f"，释放比例 {float(release_ratio) * 100:.0f}%"

    if accepted:
        return (
            f"第 {iter_value} 轮：释放 {released_count} 个任务（{release_mode}{ratio_text}），"
            f"得分 {iter_score}，刷新最优到 {best_score}。"
        )
    return (
        f"第 {iter_value} 轮：释放 {released_count} 个任务（{release_mode}{ratio_text}），"
        f"得分 {iter_score}，最优保持 {best_score}。"
    )


def _append_curve_point(curve: List[Dict[str, Any]], point: Dict[str, Any], max_points: int = 500) -> None:
    if "note_zh" not in point:
        point["note_zh"] = _build_curve_note_zh(point)
    curve.append(point)
    if len(curve) > max_points:
        # Keep phase1 baseline point while limiting report size.
        del curve[1]


def _pick_release_keys(
    *,
    normalized: Dict[str, Any],
    task_space: Dict[str, Any],
    incumbent: Dict[str, int],
    all_task_keys: List[str],
    group_location_tasks: Dict[Tuple[int, int], List[str]],
    existing_index: Dict[str, int],
    rng: random.Random,
    iteration: int,
) -> Dict[str, Any]:
    task_count = len(all_task_keys)
    if task_count <= 1:
        return {
            "release_keys": set(),
            "release_mode": "none",
            "release_ratio": 0.0,
            "sources": {
                "missing_required": 0,
                "overloaded_capacity": 0,
                "displaced_existing": 0,
                "random": 0,
            },
        }

    missing_required = _find_missing_required_pairs(normalized, task_space, incumbent)
    overloaded_usage, usage_tasks = _find_overloaded_usage(normalized, task_space, incumbent)
    displaced_existing = _find_displaced_existing_keys(existing_index, incumbent)

    release_ratio = 0.15
    if missing_required or overloaded_usage:
        release_ratio = 0.30
    elif iteration % 40 == 0:
        # Periodic shake-up to avoid local minima.
        release_ratio = 0.25

    release_target = int(max(2, min(task_count - 1, round(task_count * release_ratio))))
    release_keys: Set[str] = set()
    source_counts = {
        "missing_required": 0,
        "overloaded_capacity": 0,
        "displaced_existing": 0,
        "random": 0,
    }

    def take_keys(keys: List[str], source_key: str) -> None:
        for task_key in keys:
            if len(release_keys) >= release_target:
                return
            if task_key in release_keys:
                continue
            release_keys.add(task_key)
            source_counts[source_key] += 1

    for group_id, location_id in missing_required:
        candidate_keys = list(group_location_tasks.get((group_id, location_id), []))
        rng.shuffle(candidate_keys)
        take_keys(candidate_keys, "missing_required")
        if len(release_keys) >= release_target:
            break

    if len(release_keys) < release_target:
        for usage_key in overloaded_usage:
            keys = list(usage_tasks.get(usage_key, []))
            rng.shuffle(keys)
            take_keys(keys, "overloaded_capacity")
            if len(release_keys) >= release_target:
                break

    if len(release_keys) < release_target and displaced_existing:
        keys = list(displaced_existing)
        rng.shuffle(keys)
        take_keys(keys, "displaced_existing")

    if len(release_keys) < release_target:
        keys = [key for key in all_task_keys if key not in release_keys]
        rng.shuffle(keys)
        take_keys(keys, "random")

    if source_counts["missing_required"] > 0:
        release_mode = "missing_required"
    elif source_counts["overloaded_capacity"] > 0:
        release_mode = "overloaded_capacity"
    elif source_counts["displaced_existing"] > 0:
        release_mode = "displaced_existing"
    else:
        release_mode = "random"

    non_zero_sources = sum(1 for count in source_counts.values() if count > 0)
    if non_zero_sources > 1:
        release_mode = "mixed"

    return {
        "release_keys": release_keys,
        "release_mode": release_mode,
        "release_ratio": release_ratio,
        "sources": source_counts,
    }


def optimize_with_lns(
    normalized: Dict[str, Any],
    phase1: Dict[str, Any],
    config: Dict[str, Any],
    started_at: float,
) -> Dict[str, Any]:
    best_assignments = list(phase1["assignments"])
    best_score = _score_solution(normalized, best_assignments)
    diagnostics = {
        "phase1_engine": phase1.get("engine"),
        "phase1_status": phase1.get("status"),
        "phase1_score": best_score,
        "lns_iterations": 0,
        "improvements": 0,
        "cp_sat_used": False,
        "release_strategy": "hotspot_lns_v2",
        "curve": [],
        "hotspot_totals": {
            "missing_required": 0,
            "overloaded_capacity": 0,
            "displaced_existing": 0,
            "random": 0,
        },
    }
    _append_curve_point(
        diagnostics["curve"],
        {
            "iter": 0,
            "iterScore": best_score,
            "bestScore": best_score,
            "accepted": True,
            "releasedCount": 0,
            "releaseMode": "phase1",
        },
    )

    if not is_cp_sat_available():
        diagnostics["reason"] = "ortools_not_available"
        return {
            "engine": f"{phase1.get('engine')}+no_lns",
            "assignments": best_assignments,
            "diagnostics": diagnostics,
        }

    total_sec = int(config["time_limit_sec"])
    elapsed_sec = max(0.0, time.time() - started_at)
    remaining_sec = max(0, total_sec - int(elapsed_sec))
    if remaining_sec <= 2:
        diagnostics["reason"] = "no_time_remaining"
        return {
            "engine": f"{phase1.get('engine')}+no_lns",
            "assignments": best_assignments,
            "diagnostics": diagnostics,
        }

    diagnostics["cp_sat_used"] = True

    from .task_space import build_task_space

    task_space = build_task_space(normalized)
    all_task_keys = [row["key"] for row in task_space["tasks"]]
    group_location_tasks = _build_group_location_task_index(task_space)
    existing_index = _build_existing_index(normalized)
    rng = random.Random(int(config["seed"]))
    incumbent = _assignment_index(best_assignments)

    # Small first optimize run with incumbent hints.
    base_bundle = build_cp_model(normalized, task_space, with_objective=True)
    if base_bundle is not None:
        base_result = solve_cp_model(
            base_bundle,
            time_limit_sec=max(1, min(remaining_sec // 3, 20)),
            workers=config["workers"],
            seed=config["seed"],
            stop_after_first=False,
            hints=incumbent,
        )
        if base_result["assignments"]:
            base_score = _score_solution(normalized, base_result["assignments"])
            base_accepted = False
            if base_score > best_score:
                best_assignments = base_result["assignments"]
                best_score = base_score
                incumbent = _assignment_index(best_assignments)
                diagnostics["improvements"] += 1
                base_accepted = True
            _append_curve_point(
                diagnostics["curve"],
                {
                    "iter": "base",
                    "iterScore": base_score,
                    "bestScore": best_score,
                    "accepted": base_accepted,
                    "releasedCount": 0,
                    "releaseMode": "base_optimize",
                },
            )

    loop_deadline = started_at + total_sec
    checkpoint_every = 50
    while time.time() + 1.0 < loop_deadline:
        diagnostics["lns_iterations"] += 1
        task_count = len(all_task_keys)
        if task_count == 0:
            break

        release_data = _pick_release_keys(
            normalized=normalized,
            task_space=task_space,
            incumbent=incumbent,
            all_task_keys=all_task_keys,
            group_location_tasks=group_location_tasks,
            existing_index=existing_index,
            rng=rng,
            iteration=int(diagnostics["lns_iterations"]),
        )
        release_keys = release_data["release_keys"]
        if not release_keys and task_count > 1:
            # Safety fallback: always release at least one task if possible.
            release_keys = {rng.choice(all_task_keys)}
            release_data["release_mode"] = "random"
            release_data["sources"]["random"] += 1

        for source_key, count in release_data["sources"].items():
            diagnostics["hotspot_totals"][source_key] += int(count)

        fixed_keys = set(all_task_keys) - set(release_keys)
        fixed_tasks: Dict[str, int] = {}
        for key in fixed_keys:
            location_id = incumbent.get(key)
            if location_id is not None:
                fixed_tasks[key] = int(location_id)

        bundle = build_cp_model(
            normalized=normalized,
            task_space=task_space,
            fixed_tasks=fixed_tasks,
            with_objective=True,
        )
        if bundle is None:
            break

        iter_time_sec = 2
        if len(release_keys) > max(4, task_count // 4):
            iter_time_sec = 3

        iter_result = solve_cp_model(
            bundle,
            time_limit_sec=iter_time_sec,
            workers=config["workers"],
            seed=config["seed"] + diagnostics["lns_iterations"],
            stop_after_first=False,
            hints=incumbent,
        )
        if not iter_result["assignments"]:
            continue

        iter_score = _score_solution(normalized, iter_result["assignments"])
        accepted = False
        if iter_score > best_score:
            best_assignments = iter_result["assignments"]
            best_score = iter_score
            incumbent = _assignment_index(best_assignments)
            diagnostics["improvements"] += 1
            accepted = True

        if accepted or diagnostics["lns_iterations"] % checkpoint_every == 0:
            _append_curve_point(
                diagnostics["curve"],
                {
                    "iter": int(diagnostics["lns_iterations"]),
                    "iterScore": int(iter_score),
                    "bestScore": int(best_score),
                    "accepted": bool(accepted),
                    "releasedCount": int(len(release_keys)),
                    "releaseMode": str(release_data["release_mode"]),
                    "releaseRatio": float(release_data["release_ratio"]),
                },
            )

    _append_curve_point(
        diagnostics["curve"],
        {
            "iter": "final",
            "iterScore": int(best_score),
            "bestScore": int(best_score),
            "accepted": True,
            "releasedCount": 0,
            "releaseMode": "final",
        },
    )
    diagnostics["curve_tail_zh"] = [str(row.get("note_zh", "")) for row in diagnostics["curve"][-12:]]
    diagnostics["final_score"] = best_score
    return {
        "engine": f"{phase1.get('engine')}+lns",
        "assignments": best_assignments,
        "diagnostics": diagnostics,
    }
