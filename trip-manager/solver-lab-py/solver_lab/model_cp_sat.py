from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from .constraints import make_usage_key

try:
    from ortools.sat.python import cp_model  # type: ignore

    ORTOOLS_AVAILABLE = True
except Exception:  # pragma: no cover - runtime availability
    cp_model = None  # type: ignore
    ORTOOLS_AVAILABLE = False


def is_cp_sat_available() -> bool:
    return ORTOOLS_AVAILABLE


def build_cp_model(
    normalized: Dict[str, Any],
    task_space: Dict[str, Any],
    *,
    fixed_tasks: Optional[Dict[str, int]] = None,
    with_objective: bool = True,
):
    if not ORTOOLS_AVAILABLE:
        return None

    model = cp_model.CpModel()
    tasks: List[Dict[str, Any]] = task_space["tasks"]
    required_by_group = normalized["required_by_group"]
    locations_by_id = normalized["locations_by_id"]
    cluster_location_ids = set(normalized.get("cluster_location_ids", set()))
    cluster_day_penalty = int(normalized.get("cluster_day_penalty", 40) or 40)
    if cluster_day_penalty < 0:
        cluster_day_penalty = 0

    quality = normalized.get("quality") or {}
    quality_weights = (quality.get("weights") if isinstance(quality.get("weights"), dict) else {}) or {}
    w_repeat = int(quality_weights.get("repeat", 1000) or 1000)
    w_balance_t1 = int(quality_weights.get("balance_t1", 1) or 1)
    w_balance_t2 = int(quality_weights.get("balance_t2", 3) or 3)
    w_missing = int(quality_weights.get("missing", 5) or 5)
    w_required = int(quality_weights.get("required", 2000) or 2000)
    if w_repeat < 0:
        w_repeat = 0
    if w_balance_t1 < 0:
        w_balance_t1 = 0
    if w_balance_t2 < 0:
        w_balance_t2 = 0
    if w_missing < 0:
        w_missing = 0
    if w_required < 0:
        w_required = 0

    balance_t1 = float(quality.get("balance_threshold_1", 0.7) or 0.7)
    balance_t2 = float(quality.get("balance_threshold_2", 0.9) or 0.9)

    location_prefs = quality.get("location_prefs") if isinstance(quality.get("location_prefs"), dict) else {}

    var_map: Dict[Tuple[int, int], Any] = {}
    task_var_map: Dict[str, List[Any]] = {}
    task_loc_to_var: Dict[Tuple[str, int], Any] = {}
    cluster_day_candidate_vars: Dict[Tuple[int, str], List[Any]] = {}

    # Derived vars for quality/business rules.
    slot_used_var: Dict[str, Any] = {}  # task_key -> BoolVar
    missing_var: Dict[str, Any] = {}  # task_key -> BoolVar (only for middle-day MORNING/AFTERNOON)
    required_missing_vars: List[Any] = []  # BoolVar flags for missing required coverage (must-visit)

    fixed_tasks = fixed_tasks or {}

    for task_index, task in enumerate(tasks):
        task_key = task["key"]
        vars_for_task: List[Any] = []
        candidates = list(task["candidate_location_ids"])
        for location_id in candidates:
            var = model.NewBoolVar(f"x_{task_index}_{location_id}")
            var_map[(task_index, location_id)] = var
            task_loc_to_var[(task_key, location_id)] = var
            vars_for_task.append(var)
            if location_id in cluster_location_ids:
                cluster_day_key = (int(location_id), str(task["date"]))
                cluster_day_candidate_vars.setdefault(cluster_day_key, []).append(var)
        task_var_map[task_key] = vars_for_task
        if vars_for_task:
            model.Add(sum(vars_for_task) <= 1)
            used = model.NewBoolVar(f"used_{task_index}")
            model.Add(used == sum(vars_for_task))
            slot_used_var[task_key] = used
        else:
            # No candidates => forced empty slot.
            used = model.NewBoolVar(f"used_{task_index}")
            model.Add(used == 0)
            slot_used_var[task_key] = used

        fixed_location_id = fixed_tasks.get(task_key)
        if fixed_location_id is not None and vars_for_task:
            has_fixed_candidate = False
            for location_id in candidates:
                var = task_loc_to_var[(task_key, location_id)]
                if location_id == fixed_location_id:
                    model.Add(var == 1)
                    has_fixed_candidate = True
                else:
                    model.Add(var == 0)
            if not has_fixed_candidate:
                # impossible fixed assignment; make model infeasible quickly
                model.Add(0 == 1)

    groups_by_id = normalized["groups_by_id"]

    def _is_middle_day(group_id: int, date_text: str) -> bool:
        group = groups_by_id.get(int(group_id))
        if not group:
            return False
        start = str(group.get("start_date"))
        end = str(group.get("end_date"))
        return start < str(date_text) < end

    def _is_forbidden_slot(group_id: int, date_text: str, slot_key: str) -> bool:
        group = groups_by_id.get(int(group_id))
        if not group:
            return False
        start = str(group.get("start_date"))
        end = str(group.get("end_date"))
        is_single = start == end
        if str(date_text) == start and str(slot_key) == "MORNING":
            return True
        if (not is_single) and str(date_text) == end and str(slot_key) == "AFTERNOON":
            return True
        return False

    # Business rule (hard): a group must not visit the same location more than once across the trip
    # (MORNING/AFTERNOON only; aligns with repeats metric).
    # For each (group, location): Σ x_{task,loc} <= 1
    group_location_vars_hard: Dict[Tuple[int, int], List[Any]] = {}
    for task_index, task in enumerate(tasks):
        slot = str(task["time_slot"]).upper()
        if slot not in {"MORNING", "AFTERNOON"}:
            continue
        group_id = int(task["group_id"])
        for location_id in task["candidate_location_ids"]:
            group_location_vars_hard.setdefault((group_id, int(location_id)), []).append(
                var_map[(task_index, int(location_id))]
            )
    for (_, _), vars_for_pair in group_location_vars_hard.items():
        if not vars_for_pair:
            continue
        model.Add(sum(vars_for_pair) <= 1)

    # Business rule (soft): for middle days, MORNING/AFTERNOON should be filled (quality-first => allow missing).
    if w_missing > 0:
        for task in tasks:
            slot = str(task["time_slot"]).upper()
            if slot not in {"MORNING", "AFTERNOON"}:
                continue
            group_id = int(task["group_id"])
            date_text = str(task["date"])
            if not _is_middle_day(group_id, date_text):
                continue
            if _is_forbidden_slot(group_id, date_text, slot):
                continue
            task_key = str(task["key"])
            missing = model.NewBoolVar(f"missing_{task_key.replace('|','_')}")
            model.Add(slot_used_var[task_key] + missing == 1)
            missing_var[task_key] = missing

    # Business rule (hard): same-day MORNING and AFTERNOON cannot be the same location (per group).
    # For each group/date/location: x_m + x_a <= 1
    for group_id, group_tasks in task_space["tasks_by_group"].items():
        by_date: Dict[str, Dict[str, str]] = {}
        for t in group_tasks:
            by_date.setdefault(str(t["date"]), {})[str(t["time_slot"]).upper()] = str(t["key"])
        for date_text, slot_to_key in by_date.items():
            m_key = slot_to_key.get("MORNING")
            a_key = slot_to_key.get("AFTERNOON")
            if not m_key or not a_key:
                continue
            # If either slot is forbidden, we still keep the constraint; it will be trivially satisfied.
            for location in normalized["locations"]:
                loc_id = int(location["id"])
                vm = task_loc_to_var.get((m_key, loc_id))
                va = task_loc_to_var.get((a_key, loc_id))
                if vm is None or va is None:
                    continue
                model.Add(vm + va <= 1)

    # Required coverage (must-visit): soften into a penalty term rather than a hard UNSAT constraint.
    for group_id, required_set in required_by_group.items():
        group_tasks = task_space["tasks_by_group"].get(group_id, [])
        for location_id in required_set:
            required_vars: List[Any] = []
            for task in group_tasks:
                var = task_loc_to_var.get((task["key"], location_id))
                if var is not None:
                    required_vars.append(var)
            miss_req = model.NewBoolVar(f"miss_req_g{int(group_id)}_l{int(location_id)}")
            if required_vars:
                # Either cover the required location at least once, or pay a penalty (miss_req=1).
                model.Add(sum(required_vars) + miss_req >= 1)
            else:
                # No feasible slot can ever cover this required location for this group.
                # Force missing and rely on penalty + audit/report to surface it.
                model.Add(miss_req == 1)
            required_missing_vars.append(miss_req)

    # capacity constraints
    usage_vars: Dict[str, List[Tuple[int, Any]]] = {}
    for task_index, task in enumerate(tasks):
        slot = str(task["time_slot"]).upper()
        if slot not in {"MORNING", "AFTERNOON", "EVENING"}:
            continue
        participants = int(task["participant_count"])
        for location_id in task["candidate_location_ids"]:
            key = make_usage_key(task["date"], task["time_slot"], location_id)
            var = var_map[(task_index, location_id)]
            usage_vars.setdefault(key, []).append((participants, var))

    # Include existing assignments in capacity usage.
    existing_usage: Dict[str, int] = {}
    for row in normalized.get("existing_assignments", []):
        slot = str(row.get("time_slot", "")).upper()
        if slot not in {"MORNING", "AFTERNOON", "EVENING"}:
            continue
        key = make_usage_key(str(row["date"]), str(row["time_slot"]), int(row["location_id"]))
        existing_usage[key] = int(existing_usage.get(key, 0)) + int(row.get("participant_count", 1) or 1)

    for usage_key, entries in usage_vars.items():
        _, _, location_id_text = usage_key.split("|")
        location_id = int(location_id_text)
        location = locations_by_id.get(location_id)
        if not location:
            continue
        capacity = int(location.get("capacity", 0) or 0)
        if capacity <= 0:
            continue
        base = int(existing_usage.get(usage_key, 0))
        model.Add(base + sum(weight * var for weight, var in entries) <= capacity)

    if with_objective:
        objective_terms: List[Any] = []

        # A) Repeat penalty (MORNING/AFTERNOON only): penalize additional visits to same location per group.
        if w_repeat > 0:
            group_location_vars: Dict[Tuple[int, int], List[Any]] = {}
            for task_index, task in enumerate(tasks):
                slot = str(task["time_slot"]).upper()
                if slot not in {"MORNING", "AFTERNOON"}:
                    continue
                group_id = int(task["group_id"])
                for location_id in task["candidate_location_ids"]:
                    group_location_vars.setdefault((group_id, int(location_id)), []).append(var_map[(task_index, location_id)])

            for (group_id, location_id), vars_for_pair in group_location_vars.items():
                if not vars_for_pair:
                    continue
                count = model.NewIntVar(0, len(vars_for_pair), f"cnt_g{group_id}_l{location_id}")
                model.Add(count == sum(vars_for_pair))
                repeat = model.NewIntVar(0, max(0, len(vars_for_pair) - 1), f"rep_g{group_id}_l{location_id}")
                # repeat = max(0, count - 1)
                model.AddMaxEquality(repeat, [0, count - 1])
                objective_terms.append(-w_repeat * repeat)

        # C) Load balancing penalty (MORNING/AFTERNOON only): penalize occupancy beyond thresholds.
        if (w_balance_t1 > 0 or w_balance_t2 > 0) and usage_vars:
            for usage_key, entries in usage_vars.items():
                date_text, slot_key, location_id_text = usage_key.split("|")
                slot_key = str(slot_key).upper()
                if slot_key not in {"MORNING", "AFTERNOON"}:
                    continue
                location_id = int(location_id_text)
                location = locations_by_id.get(location_id)
                if not location:
                    continue
                capacity = int(location.get("capacity", 0) or 0)
                if capacity <= 0:
                    continue
                base = int(existing_usage.get(usage_key, 0))
                # load = base + Σ participants*var
                max_load = base + sum(int(weight) for weight, _ in entries)
                load = model.NewIntVar(0, max_load, f"load_{date_text.replace('-','')}_{slot_key}_{location_id}")
                model.Add(load == base + sum(weight * var for weight, var in entries))

                t1 = int(capacity * balance_t1)
                t2 = int(capacity * balance_t2)
                if t1 < 0:
                    t1 = 0
                if t2 < 0:
                    t2 = 0
                if t2 < t1:
                    t2 = t1

                if w_balance_t1 > 0:
                    over1 = model.NewIntVar(0, max(0, max_load - t1), f"over1_{date_text.replace('-','')}_{slot_key}_{location_id}")
                    model.AddMaxEquality(over1, [0, load - t1])
                    objective_terms.append(-w_balance_t1 * over1)

                if w_balance_t2 > 0:
                    over2 = model.NewIntVar(0, max(0, max_load - t2), f"over2_{date_text.replace('-','')}_{slot_key}_{location_id}")
                    model.AddMaxEquality(over2, [0, load - t2])
                    objective_terms.append(-w_balance_t2 * over2)

        # Soft: middle-day fill missing (quality-first => low weight)
        if w_missing > 0 and missing_var:
            objective_terms.append(-w_missing * sum(missing_var.values()))

        # Soft: required (must-visit) coverage. Penalize each missing required location per group.
        if w_required > 0 and required_missing_vars:
            objective_terms.append(-w_required * sum(required_missing_vars))

        # Location slot consolidation / preferred slot (optional, per-location weights).
        # Supports BY_DAY consolidation with SOFT target slot preference.
        if location_prefs:
            # Build index: (date, slot, loc_id) -> list[x-vars]
            loc_slot_vars: Dict[Tuple[str, str, int], List[Any]] = {}
            for task_index, task in enumerate(tasks):
                slot_key = str(task["time_slot"]).upper()
                if slot_key not in {"MORNING", "AFTERNOON"}:
                    continue
                date_text = str(task["date"])
                for loc_id in task["candidate_location_ids"]:
                    loc_id = int(loc_id)
                    if loc_id not in location_prefs:
                        continue
                    loc_slot_vars.setdefault((date_text, slot_key, loc_id), []).append(var_map[(task_index, loc_id)])

            # For each preferred location and date: compute usedM/usedA and apply penalties.
            dates = sorted({str(t["date"]) for t in tasks})
            for loc_id_raw, pref in location_prefs.items():
                try:
                    loc_id = int(loc_id_raw)
                except (TypeError, ValueError):
                    continue
                if not isinstance(pref, dict):
                    continue
                mode = str(pref.get("consolidate_mode", "NONE")).upper()
                target_slot = str(pref.get("target_slot", "")).upper()
                target_mode = str(pref.get("target_slot_mode", "SOFT")).upper()
                consolidate_weight = int(pref.get("consolidate_weight", 0) or 0)
                wrong_slot_penalty = int(pref.get("wrong_slot_penalty", 0) or 0)
                if consolidate_weight < 0:
                    consolidate_weight = 0
                if wrong_slot_penalty < 0:
                    wrong_slot_penalty = 0

                for date_text in dates:
                    xs_m = loc_slot_vars.get((date_text, "MORNING", loc_id), [])
                    xs_a = loc_slot_vars.get((date_text, "AFTERNOON", loc_id), [])
                    if not xs_m and not xs_a:
                        continue

                    used_m = model.NewBoolVar(f"used_{loc_id}_{date_text.replace('-','')}_M")
                    used_a = model.NewBoolVar(f"used_{loc_id}_{date_text.replace('-','')}_A")
                    if xs_m:
                        model.AddMaxEquality(used_m, xs_m)
                    else:
                        model.Add(used_m == 0)
                    if xs_a:
                        model.AddMaxEquality(used_a, xs_a)
                    else:
                        model.Add(used_a == 0)

                    # BY_DAY consolidation: penalize using both slots on same day.
                    if mode == "BY_DAY" and consolidate_weight > 0:
                        both_used = model.NewBoolVar(f"both_{loc_id}_{date_text.replace('-','')}")
                        model.Add(both_used <= used_m)
                        model.Add(both_used <= used_a)
                        model.Add(both_used >= used_m + used_a - 1)
                        objective_terms.append(-consolidate_weight * both_used)

                    # Target slot preference.
                    if target_slot in {"MORNING", "AFTERNOON"}:
                        other_used = used_a if target_slot == "MORNING" else used_m
                        if target_mode == "HARD":
                            model.Add(other_used == 0)
                        else:
                            if wrong_slot_penalty > 0:
                                objective_terms.append(-wrong_slot_penalty * other_used)

        # Optional: keep required coverage is already hard; keep existing is neutral by default.
        # Keep cluster prefer-same-day penalty if configured.
        if cluster_day_penalty > 0:
            for (location_id, date_text), vars_for_day in cluster_day_candidate_vars.items():
                if not vars_for_day:
                    continue
                safe_date = date_text.replace("-", "")
                day_used = model.NewBoolVar(f"cluster_day_{location_id}_{safe_date}")
                for var in vars_for_day:
                    model.Add(day_used >= var)
                model.Add(day_used <= sum(vars_for_day))
                objective_terms.append(-cluster_day_penalty * day_used)

        if objective_terms:
            model.Maximize(sum(objective_terms))

    return {
        "model": model,
        "tasks": tasks,
        "task_space": task_space,
        "task_loc_to_var": task_loc_to_var,
    }


if ORTOOLS_AVAILABLE:
    class _StopAtFirstSolution(cp_model.CpSolverSolutionCallback):  # type: ignore
        def __init__(self) -> None:
            super().__init__()
            self.found = False

        def on_solution_callback(self) -> None:
            self.found = True
            self.StopSearch()
else:
    class _StopAtFirstSolution:  # pragma: no cover
        pass


def solve_cp_model(
    bundle: Dict[str, Any],
    *,
    time_limit_sec: int,
    workers: int,
    seed: int,
    stop_after_first: bool = False,
    hints: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    if not ORTOOLS_AVAILABLE:
        return {"status": "not_available", "assignments": [], "objective": None}

    model = bundle["model"]
    task_loc_to_var = bundle["task_loc_to_var"]

    hints = hints or {}
    for task_key, location_id in hints.items():
        var = task_loc_to_var.get((task_key, int(location_id)))
        if var is not None:
            model.AddHint(var, 1)

    solver = cp_model.CpSolver()  # type: ignore
    solver.parameters.max_time_in_seconds = max(1, int(time_limit_sec))
    solver.parameters.num_search_workers = max(1, int(workers))
    solver.parameters.random_seed = int(seed)
    solver.parameters.log_search_progress = False

    if stop_after_first:
        callback = _StopAtFirstSolution()
        status = solver.Solve(model, callback)
    else:
        status = solver.Solve(model)

    status_name = solver.StatusName(status)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):  # type: ignore
        return {"status": status_name, "assignments": [], "objective": None}

    assignments: List[Dict[str, Any]] = []
    for task in bundle["tasks"]:
        chosen_location = None
        for location_id in task["candidate_location_ids"]:
            var = task_loc_to_var.get((task["key"], location_id))
            if var is None:
                continue
            if solver.Value(var) == 1:
                chosen_location = int(location_id)
                break
        if chosen_location is None:
            continue
        assignments.append(
            {
                "group_id": int(task["group_id"]),
                "location_id": chosen_location,
                "date": task["date"],
                "time_slot": task["time_slot"],
                "participant_count": int(task["participant_count"]),
            }
        )

    objective = None
    try:
        objective = int(solver.ObjectiveValue())
    except Exception:
        objective = None

    return {
        "status": status_name,
        "assignments": assignments,
        "objective": objective,
        "best_bound": float(solver.BestObjectiveBound()),
    }
