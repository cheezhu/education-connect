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

    var_map: Dict[Tuple[int, int], Any] = {}
    task_var_map: Dict[str, List[Any]] = {}
    task_loc_to_var: Dict[Tuple[str, int], Any] = {}
    cluster_day_candidate_vars: Dict[Tuple[int, str], List[Any]] = {}

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

    # required coverage
    for group_id, required_set in required_by_group.items():
        group_tasks = task_space["tasks_by_group"].get(group_id, [])
        for location_id in required_set:
            required_vars: List[Any] = []
            for task in group_tasks:
                var = task_loc_to_var.get((task["key"], location_id))
                if var is not None:
                    required_vars.append(var)
            if not required_vars:
                # no candidate exists for a required location
                model.Add(0 == 1)
            else:
                model.Add(sum(required_vars) >= 1)

    # capacity constraints
    usage_vars: Dict[str, List[Tuple[int, Any]]] = {}
    for task_index, task in enumerate(tasks):
        participants = int(task["participant_count"])
        for location_id in task["candidate_location_ids"]:
            key = make_usage_key(task["date"], task["time_slot"], location_id)
            var = var_map[(task_index, location_id)]
            usage_vars.setdefault(key, []).append((participants, var))

    for usage_key, entries in usage_vars.items():
        _, _, location_id_text = usage_key.split("|")
        location_id = int(location_id_text)
        location = locations_by_id.get(location_id)
        if not location:
            continue
        capacity = int(location.get("capacity", 0) or 0)
        if capacity <= 0:
            continue
        model.Add(sum(weight * var for weight, var in entries) <= capacity)

    if with_objective:
        objective_terms: List[Any] = []
        for task_index, task in enumerate(tasks):
            required_set = required_by_group.get(task["group_id"], set())
            for location_id in task["candidate_location_ids"]:
                var = var_map[(task_index, location_id)]
                score = 1
                if task["existing_location_id"] == location_id:
                    score += 60
                if location_id in required_set:
                    score += 20
                objective_terms.append(score * var)

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
