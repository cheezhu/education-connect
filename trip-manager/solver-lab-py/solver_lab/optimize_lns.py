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


def _compute_quality_stats(normalized: Dict[str, Any], assignments: List[Dict[str, Any]], task_space: Dict[str, Any]) -> Dict[str, Any]:
    quality = normalized.get("quality") or {}
    balance_t1 = float(quality.get("balance_threshold_1", 0.7) or 0.7)
    balance_t2 = float(quality.get("balance_threshold_2", 0.9) or 0.9)

    required_by_group = normalized["required_by_group"]
    locations_by_id = normalized["locations_by_id"]
    groups_by_id = normalized["groups_by_id"]
    cluster_location_ids = set(normalized.get("cluster_location_ids", set()))
    cluster_day_penalty = int(normalized.get("cluster_day_penalty", 40) or 40)
    if cluster_day_penalty < 0:
        cluster_day_penalty = 0
    location_prefs = quality.get("location_prefs") if isinstance(quality.get("location_prefs"), dict) else {}

    current = {
        make_group_slot_key(row["group_id"], row["date"], row["time_slot"]): int(row["location_id"])
        for row in assignments
        if str(row.get("time_slot", "")).upper() in {"MORNING", "AFTERNOON", "EVENING"}
    }

    def forbidden_slot(group_id: int, date_text: str, slot_key: str) -> bool:
        g = groups_by_id.get(int(group_id))
        if not g:
            return False
        start = str(g.get("start_date"))
        end = str(g.get("end_date"))
        if str(date_text) == start and str(slot_key) == "MORNING":
            return True
        if (start != end) and str(date_text) == end and str(slot_key) == "AFTERNOON":
            return True
        return False

    def is_middle_day(group_id: int, date_text: str) -> bool:
        g = groups_by_id.get(int(group_id))
        if not g:
            return False
        start = str(g.get("start_date"))
        end = str(g.get("end_date"))
        return start < str(date_text) < end

    # repeats
    counts: Dict[Tuple[int, int], int] = {}
    for key, location_id in current.items():
        group_id_text, _, slot = key.split("|")
        slot = slot.upper()
        if slot not in {"MORNING", "AFTERNOON"}:
            continue
        group_id = int(group_id_text)
        counts[(group_id, int(location_id))] = counts.get((group_id, int(location_id)), 0) + 1
    repeats = sum(max(0, cnt - 1) for cnt in counts.values())

    # missing
    missing = 0
    for g in normalized.get("groups", []):
        gid = int(g["id"])
        for task in task_space.get("tasks_by_group", {}).get(gid, []):
            slot = str(task["time_slot"]).upper()
            if slot not in {"MORNING", "AFTERNOON"}:
                continue
            d = str(task["date"])
            if not is_middle_day(gid, d):
                continue
            if forbidden_slot(gid, d, slot):
                continue
            tkey = make_group_slot_key(gid, d, slot)
            if tkey not in current:
                missing += 1

    # load
    existing_usage: Dict[str, int] = {}
    for row in normalized.get("existing_assignments", []):
        slot = str(row.get("time_slot", "")).upper()
        if slot not in {"MORNING", "AFTERNOON"}:
            continue
        ukey = make_usage_key(str(row["date"]), str(row["time_slot"]), int(row["location_id"]))
        existing_usage[ukey] = existing_usage.get(ukey, 0) + int(row.get("participant_count", 1) or 1)

    usage: Dict[str, int] = dict(existing_usage)
    for row in assignments:
        slot = str(row.get("time_slot", "")).upper()
        if slot not in {"MORNING", "AFTERNOON"}:
            continue
        ukey = make_usage_key(str(row["date"]), str(row["time_slot"]), int(row["location_id"]))
        usage[ukey] = usage.get(ukey, 0) + int(row.get("participant_count", 1) or 1)

    over1_sum = 0
    over2_sum = 0
    for ukey, people in usage.items():
        _, slot_key, loc_text = ukey.split("|")
        slot_key = slot_key.upper()
        if slot_key not in {"MORNING", "AFTERNOON"}:
            continue
        location = locations_by_id.get(int(loc_text))
        if not location:
            continue
        cap = int(location.get("capacity", 0) or 0)
        if cap <= 0:
            continue
        t1 = int(cap * balance_t1)
        t2 = int(cap * balance_t2)
        if people > t1:
            over1_sum += people - t1
        if people > t2:
            over2_sum += people - t2

    covered = 0
    for row in assignments:
        if str(row.get("time_slot", "")).upper() not in {"MORNING", "AFTERNOON"}:
            continue
        if int(row["location_id"]) in required_by_group.get(int(row["group_id"]), set()):
            covered += 1

    incumbent = dict(current)
    missing_required_count = len(_find_missing_required_pairs(normalized, task_space, incumbent))

    # Location preferences penalties (global per-location per-day).
    consolidate_penalty = 0
    consolidate_both_days = 0
    wrong_slot_penalty = 0
    wrong_slot_days = 0
    if location_prefs:
        used_m: Set[Tuple[int, str]] = set()
        used_a: Set[Tuple[int, str]] = set()
        for row in assignments:
            slot = str(row.get("time_slot", "")).upper()
            if slot not in {"MORNING", "AFTERNOON"}:
                continue
            loc_id = int(row["location_id"])
            if loc_id not in location_prefs:
                continue
            dt = str(row["date"])
            if slot == "MORNING":
                used_m.add((loc_id, dt))
            else:
                used_a.add((loc_id, dt))

        by_loc_dates: Dict[int, Set[str]] = {}
        for loc_id, dt in used_m | used_a:
            by_loc_dates.setdefault(int(loc_id), set()).add(str(dt))

        for loc_id, dates in by_loc_dates.items():
            pref = location_prefs.get(int(loc_id)) or {}
            if not isinstance(pref, dict):
                continue
            mode = str(pref.get("consolidate_mode", "NONE")).upper()
            target_slot = str(pref.get("target_slot", "")).upper()
            target_mode = str(pref.get("target_slot_mode", "SOFT")).upper()
            consolidate_weight = int(pref.get("consolidate_weight", 0) or 0)
            wrong_slot_weight = int(pref.get("wrong_slot_penalty", 0) or 0)
            if consolidate_weight < 0:
                consolidate_weight = 0
            if wrong_slot_weight < 0:
                wrong_slot_weight = 0

            for dt in dates:
                um = (int(loc_id), dt) in used_m
                ua = (int(loc_id), dt) in used_a
                if mode == "BY_DAY" and consolidate_weight > 0 and um and ua:
                    consolidate_both_days += 1
                    consolidate_penalty += consolidate_weight

                if target_slot in {"MORNING", "AFTERNOON"} and target_mode != "HARD" and wrong_slot_weight > 0:
                    other_used = ua if target_slot == "MORNING" else um
                    if other_used:
                        wrong_slot_days += 1
                        wrong_slot_penalty += wrong_slot_weight

    # Cluster prefer-same-day penalty: penalize number of distinct days used per clustered location.
    cluster_days_used = 0
    cluster_penalty = 0
    if cluster_day_penalty > 0 and cluster_location_ids:
        used_days: Set[Tuple[int, str]] = set()
        for row in assignments:
            loc_id = int(row["location_id"])
            if loc_id not in cluster_location_ids:
                continue
            used_days.add((loc_id, str(row["date"])))
        cluster_days_used = len(used_days)
        cluster_penalty = cluster_day_penalty * cluster_days_used

    return {
        "repeats": int(repeats),
        "missing": int(missing),
        "overT1": int(over1_sum),
        "overT2": int(over2_sum),
        "mustVisitHits": int(covered),
        "requiredMissing": int(missing_required_count),
        "consolidatePenalty": int(consolidate_penalty),
        "consolidateBothDays": int(consolidate_both_days),
        "wrongSlotPenalty": int(wrong_slot_penalty),
        "wrongSlotDays": int(wrong_slot_days),
        "clusterPenalty": int(cluster_penalty),
        "clusterDaysUsed": int(cluster_days_used),
        "balanceT1": float(balance_t1),
        "balanceT2": float(balance_t2),
    }


def _score_solution(normalized: Dict[str, Any], assignments: List[Dict[str, Any]], task_space: Dict[str, Any]) -> int:
    """Higher is better.

    This score is intended to be comparable across LNS iterations and *consistent* with the
    CP-SAT objective in model_cp_sat.py (which maximizes a sum of negative penalty terms).

    Notes:
    - We score the same business signals as the CP model: repeats, balance overages, missing (middle-day),
      required (must-visit) missing (soft), location prefs penalties, and cluster-day penalties.
    - No extra heuristic bonuses: mismatches can cause LNS to reject true CP objective improvements.
    """

    quality = normalized.get("quality") or {}
    weights = (quality.get("weights") if isinstance(quality.get("weights"), dict) else {}) or {}
    w_repeat = int(weights.get("repeat", 1000) or 1000)
    w_balance_t1 = int(weights.get("balance_t1", 1) or 1)
    w_balance_t2 = int(weights.get("balance_t2", 3) or 3)
    w_missing = int(weights.get("missing", 5) or 5)
    # required weight is currently not normalized from input rules; keep the model's default fallback.
    w_required = int(weights.get("required", 2000) or 2000)

    stats = _compute_quality_stats(normalized, assignments, task_space)

    # model_cp_sat.py maximizes -penalty terms, so we return the same sign: higher is better.
    penalty = 0
    if w_repeat > 0:
        penalty += w_repeat * int(stats.get("repeats", 0))
    if w_balance_t1 > 0:
        penalty += w_balance_t1 * int(stats.get("overT1", 0))
    if w_balance_t2 > 0:
        penalty += w_balance_t2 * int(stats.get("overT2", 0))
    if w_missing > 0:
        penalty += w_missing * int(stats.get("missing", 0))
    if w_required > 0:
        penalty += w_required * int(stats.get("requiredMissing", 0))

    # These are already weighted penalties (per-location/per-day weights), matching the CP objective terms.
    penalty += int(stats.get("consolidatePenalty", 0) or 0)
    penalty += int(stats.get("wrongSlotPenalty", 0) or 0)
    penalty += int(stats.get("clusterPenalty", 0) or 0)

    return -int(penalty)


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
    from .task_space import build_task_space

    task_space = build_task_space(normalized)
    best_assignments = list(phase1["assignments"])
    best_score = _score_solution(normalized, best_assignments, task_space)

    print(f"[lns-debug] enter: tasks={len(task_space.get('tasks', []))} phase1_assignments={len(best_assignments)}")
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
        print("[lns-debug] exit: ortools_not_available")
        return {
            "engine": f"{phase1.get('engine')}+no_lns",
            "assignments": best_assignments,
            "diagnostics": diagnostics,
        }

    total_sec = int(config["time_limit_sec"])
    elapsed_sec = max(0.0, time.time() - started_at)
    remaining_sec = max(0, total_sec - int(elapsed_sec))
    print(f"[lns-debug] budget: total={total_sec}s elapsed={elapsed_sec:.1f}s remaining={remaining_sec}s")
    if remaining_sec <= 2:
        diagnostics["reason"] = "no_time_remaining"
        print("[lns-debug] exit: no_time_remaining")
        return {
            "engine": f"{phase1.get('engine')}+no_lns",
            "assignments": best_assignments,
            "diagnostics": diagnostics,
        }

    diagnostics["cp_sat_used"] = True

    all_task_keys = [row["key"] for row in task_space["tasks"]]
    group_location_tasks = _build_group_location_task_index(task_space)
    existing_index = _build_existing_index(normalized)
    rng = random.Random(int(config["seed"]))
    incumbent = _assignment_index(best_assignments)

    # Small first optimize run with incumbent hints.
    base_bundle = build_cp_model(normalized, task_space, with_objective=True)
    if base_bundle is None:
        diagnostics["reason"] = "base_bundle_none"
        print("[lns-debug] exit: base_bundle_none")
        return {
            "engine": f"{phase1.get('engine')}+no_lns",
            "assignments": best_assignments,
            "diagnostics": diagnostics,
        }

    base_result = solve_cp_model(
        base_bundle,
        time_limit_sec=max(1, min(remaining_sec // 3, 20)),
        workers=config["workers"],
        seed=config["seed"],
        stop_after_first=False,
        hints=incumbent,
    )
    if base_result["assignments"]:
        base_score = _score_solution(normalized, base_result["assignments"], task_space)
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
    else:
        print("[lns-debug] base_result: no assignments")

    # Auto-budget: staged time budgets with early stop/extend decisions.
    # - min: 120s, mid: 300s, max: total_sec (default 720s)
    auto_budget = bool(config.get("auto_budget", True))
    budgets = [120, 300, int(total_sec)] if auto_budget else [int(total_sec)]
    budgets = [b for b in budgets if b > 0]
    # Ensure non-decreasing and not above max.
    budgets = sorted(set(min(int(total_sec), int(b)) for b in budgets))
    current_budget_index = 0
    loop_deadline = started_at + budgets[current_budget_index]
    max_deadline = started_at + total_sec

    if auto_budget:
        print(f"[auto-budget] plan: min={budgets[0]}s mid={(budgets[1] if len(budgets)>1 else budgets[0])}s max={budgets[-1]}s")

    last_best_score = int(best_score)
    last_improve_at = time.time()

    def _budget_reason(missing_required_count: int, improved_recently: bool) -> str:
        if missing_required_count > 0:
            return f"must_visit_missing={missing_required_count}"
        if improved_recently:
            return "still_improving"
        return "converged"
    # How often to emit progress points into diagnostics.curve.
    # Lower value => more verbose optimization trace in CLI logs.
    checkpoint_every = 10
    no_assign_streak = 0

    while time.time() + 1.0 < loop_deadline:
        # Auto-budget checkpoint: decide extend/stop even if CP-SAT fails to return assignments.
        if auto_budget and time.time() + 0.2 >= loop_deadline and loop_deadline < max_deadline:
            missing_required_pairs = _find_missing_required_pairs(normalized, task_space, incumbent)
            missing_required_count = len(missing_required_pairs)
            improved_recently = (time.time() - last_improve_at) < 90.0
            reason = _budget_reason(missing_required_count, improved_recently)

            # Extend if still improving, or missing required exists.
            if missing_required_count > 0 or improved_recently:
                if current_budget_index + 1 < len(budgets):
                    current_budget_index += 1
                    loop_deadline = min(max_deadline, started_at + budgets[current_budget_index])
                    try:
                        stats_best = _compute_quality_stats(normalized, best_assignments, task_space)
                    except Exception:
                        stats_best = {}
                    print(
                        f"[auto-budget] t={int(time.time()-started_at)}s extend->{int(budgets[current_budget_index])}s "
                        f"reason={reason} recentImprove={'yes' if improved_recently else 'no'} "
                        f"bestScore={int(best_score)} improvements={int(diagnostics['improvements'])} "
                        f"repeats={int(stats_best.get('repeats',0))} overT2={int(stats_best.get('overT2',0))} missing={int(stats_best.get('missing',0))}"
                    )
                else:
                    loop_deadline = max_deadline
            else:
                try:
                    stats_best = _compute_quality_stats(normalized, best_assignments, task_space)
                except Exception:
                    stats_best = {}
                print(
                    f"[auto-budget] t={int(time.time()-started_at)}s stop-early "
                    f"reason={reason} recentImprove={'yes' if improved_recently else 'no'} "
                    f"bestScore={int(best_score)} improvements={int(diagnostics['improvements'])} "
                    f"repeats={int(stats_best.get('repeats',0))} overT2={int(stats_best.get('overT2',0))} missing={int(stats_best.get('missing',0))}"
                )
                break

        diagnostics["lns_iterations"] += 1
        task_count = len(all_task_keys)
        if task_count == 0:
            diagnostics["reason"] = "no_tasks"
            print("[lns-debug] break: no_tasks")
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

        # If CP-SAT frequently returns no assignments, increase exploration.
        if no_assign_streak >= 20:
            release_data["release_ratio"] = max(float(release_data.get("release_ratio", 0.15)), 0.50)
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
            diagnostics["reason"] = "iter_bundle_none"
            print(f"[lns-debug] break: iter_bundle_none at iter={int(diagnostics['lns_iterations'])}")
            break

        iter_time_sec = 2
        if len(release_keys) > max(4, task_count // 4):
            iter_time_sec = 3
        if no_assign_streak >= 20:
            iter_time_sec = max(iter_time_sec, 6)

        iter_result = solve_cp_model(
            bundle,
            time_limit_sec=iter_time_sec,
            workers=config["workers"],
            seed=config["seed"] + diagnostics["lns_iterations"],
            stop_after_first=False,
            hints=incumbent,
        )
        if not iter_result["assignments"]:
            no_assign_streak += 1
            if int(diagnostics["lns_iterations"]) % 10 == 0:
                print(f"[lns-debug] iter={int(diagnostics['lns_iterations'])} no assignments (streak={no_assign_streak})")
            if no_assign_streak >= 80:
                diagnostics["reason"] = "lns_no_assignments"
                print(f"[lns-debug] break: lns_no_assignments streak={no_assign_streak}")
                break
            continue

        no_assign_streak = 0

        iter_score = _score_solution(normalized, iter_result["assignments"], task_space)
        accepted = False
        if iter_score > best_score:
            best_assignments = iter_result["assignments"]
            best_score = iter_score
            incumbent = _assignment_index(best_assignments)
            diagnostics["improvements"] += 1
            accepted = True
            if int(best_score) > int(last_best_score):
                last_best_score = int(best_score)
                last_improve_at = time.time()

        # Human-readable explain logs (for Studio): every 5 iterations, and always when accepted.
        if accepted or diagnostics["lns_iterations"] % 5 == 0:
            try:
                stats_now = _compute_quality_stats(normalized, iter_result["assignments"], task_space)
                missing_required_pairs = _find_missing_required_pairs(normalized, task_space, incumbent)
                missing_required_count = len(missing_required_pairs)
                reason_parts = []
                reason_parts.append(f"mode={_release_mode_name_zh(str(release_data.get('release_mode'))) }")
                reason_parts.append(f"released={len(release_keys)}({int(float(release_data.get('release_ratio',0))*100)}%)")
                reason_parts.append(f"accepted={'YES' if accepted else 'NO'}")
                reason_parts.append(f"score={int(iter_score)} best={int(best_score)}")
                reason_parts.append(f"improvements={int(diagnostics['improvements'])}")
                print(
                    f"[LNS {int(diagnostics['lns_iterations'])}] " + " ".join(reason_parts)
                    + f" repeats={int(stats_now.get('repeats',0))}"
                    + f" overT1={int(stats_now.get('overT1',0))}"
                    + f" overT2={int(stats_now.get('overT2',0))}"
                    + f" missing={int(stats_now.get('missing',0))}"
                    + f" mustVisitHits={int(stats_now.get('mustVisitHits',0))}"
                    + f" mustVisitMissing={int(missing_required_count)}"
                )
            except Exception:
                pass

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

        # Auto-budget checkpoint: decide extend/stop when reaching the current budget.
        if auto_budget and time.time() + 0.2 >= loop_deadline and loop_deadline < max_deadline:
            missing_required_pairs = _find_missing_required_pairs(normalized, task_space, incumbent)
            missing_required_count = len(missing_required_pairs)
            improved_recently = (time.time() - last_improve_at) < 90.0
            reason = _budget_reason(missing_required_count, improved_recently)

            # Extend if still improving, or missing required exists.
            if missing_required_count > 0 or improved_recently:
                if current_budget_index + 1 < len(budgets):
                    current_budget_index += 1
                    loop_deadline = min(max_deadline, started_at + budgets[current_budget_index])
                    try:
                        stats_best = _compute_quality_stats(normalized, best_assignments, task_space)
                    except Exception:
                        stats_best = {}
                    print(
                        f"[auto-budget] t={int(time.time()-started_at)}s extend->{int(budgets[current_budget_index])}s "
                        f"reason={reason} recentImprove={'yes' if improved_recently else 'no'} "
                        f"bestScore={int(best_score)} improvements={int(diagnostics['improvements'])} "
                        f"repeats={int(stats_best.get('repeats',0))} overT2={int(stats_best.get('overT2',0))} missing={int(stats_best.get('missing',0))}"
                    )
                else:
                    # Already at max budget.
                    loop_deadline = max_deadline
            else:
                try:
                    stats_best = _compute_quality_stats(normalized, best_assignments, task_space)
                except Exception:
                    stats_best = {}
                print(
                    f"[auto-budget] t={int(time.time()-started_at)}s stop-early "
                    f"reason={reason} recentImprove={'yes' if improved_recently else 'no'} "
                    f"bestScore={int(best_score)} improvements={int(diagnostics['improvements'])} "
                    f"repeats={int(stats_best.get('repeats',0))} overT2={int(stats_best.get('overT2',0))} missing={int(stats_best.get('missing',0))}"
                )
                break

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
    diagnostics["quality_stats"] = _compute_quality_stats(normalized, best_assignments, task_space)
    return {
        "engine": f"{phase1.get('engine')}+lns",
        "assignments": best_assignments,
        "diagnostics": diagnostics,
    }
