# 求解器质量规则（Quality Rules）

> 本文档描述“跨团组排程求解器”的质量/业务规则补丁（在不破坏硬约束的前提下，让结果更符合运营直觉）。
>
> 适用对象：`ec-planning-input@2` → `ec-planning-result@1` 的 CP-SAT/LNS 求解流程。
>
> 相关文档：
> - 求解器工作流：`trip-manager/solver-lab-py/docs/solver-workflow.md`
> - 导出输入：`docs/planning/export-planning-input.md`
> - 导入结果：`docs/planning/import-planning-result.md`

---

## 1. 背景：什么是“硬约束”和“软目标”

- **硬约束（Hard Constraints）**：绝对不能违反；一旦违反即不可用（例如：容量超限、地点不开放、同团同槽冲突）。
- **软目标（Soft Objectives / Penalties）**：允许权衡；通过“扣分/罚分”让求解器更倾向于某类结果（例如：少重复地点、负载更均衡）。

本规则包中：
- “不排参访点”的规则属于 **硬约束**。
- “中间天早午必须满”在本轮设定为 **软约束**（因为用户偏好质量优先，允许空）。
- “少重复地点 / 更均衡”属于 **软目标**。

---

## 2. 时段范围

本规则仅约束：
- `MORNING`
- `AFTERNOON`

不约束：
- `EVENING`

---

## 3. 业务硬约束（不安排参访点）

### 3.1 第一日上午不安排参访点

对每个团组 `g`：
- 在 `group.startDate` 的 `MORNING` 槽位 **必须为空**。

形式化：
- `slot_used[g, startDate, MORNING] = 0`

### 3.2 最后一天下午不安排参访点（仅多日团）

对每个团组 `g`：
- 如果 `group.endDate > group.startDate`（团期至少 2 天游），则在 `group.endDate` 的 `AFTERNOON` 槽位 **必须为空**。
- 如果 `group.endDate == group.startDate`（单日团），则 **不强制** `AFTERNOON` 为空（允许排）。

形式化（多日团时）：
- `slot_used[g, endDate, AFTERNOON] = 0`

---

## 4. 业务硬约束（同日早午不重复地点）

对每个团组 `g`、日期 `d`、地点 `l`：
- 同一天的 `MORNING` 与 `AFTERNOON` **不能安排同一个地点**。

形式化：
- `x[g,d,MORNING,l] + x[g,d,AFTERNOON,l] <= 1`

说明：
- 该约束只要求“早午不同地点”。
- 不限制“早午任一槽位为空”的情况。

---

## 5. 中间天早午“尽量满”的软约束（允许空）

### 5.1 定义“中间天”

对每个团组 `g`：
- 中间天集合：`startDate < d < endDate`

若团期为 1~2 天，则不存在中间天。

### 5.2 软约束形式（missing 缺口变量）

对每个团组 `g`、中间天 `d`、时段 `s ∈ {MORNING, AFTERNOON}`：

- 定义 `slot_used[g,d,s] ∈ {0,1}` 表示该槽位是否被安排。
- 定义 `missing[g,d,s] ∈ {0,1}` 表示该槽位是否缺口。

约束：
- `slot_used[g,d,s] + missing[g,d,s] = 1`

含义：
- 要么该槽位排上一个地点（used=1），要么承认空槽（missing=1）。

### 5.3 权重策略（质量优先）

本轮偏好为：**质量优先（宁愿空，也不要为了填满而造成重复/拥挤）**。

因此在目标函数中：
- `missing` 的惩罚权重应 **低于** “重复地点惩罚（A）” 与 “负载均衡惩罚（C）”。

---

## 6. 质量目标 A：少重复地点（Repeat Penalty）

目标：同一团组在整个排程范围内，尽量不要多次参访同一地点。

### 6.1 计数与重复量

对每个团组 `g`、地点 `l`：

- `count[g,l] = Σ_{d,s∈{MORNING,AFTERNOON}} x[g,d,s,l]`
- `repeat[g,l] = max(0, count[g,l] - 1)`

### 6.2 目标函数项

- `Minimize  W_repeat * Σ_{g,l} repeat[g,l]`

说明：
- 第一访不罚，从第二次开始罚。
- 如需更强烈避免重复，可用递增罚分（例如重复越多罚越重），但第一版建议先用线性罚分。

---

## 7. 质量目标 C：更均衡（Load Balancing Penalty）

目标：在满足容量硬约束前提下，避免把同一时段的人流过度集中到少数地点。

### 7.1 定义负载（load）

对每个日期 `d`、时段 `s`、地点 `l`：

- `load[d,s,l] = existing_load[d,s,l] + Σ_g (participants[g] * x[g,d,s,l])`

其中：
- `existing_load` 来自输入 `existingAssignments`（同 d/s/l 的占用人数总和）。

### 7.2 分段惩罚（建议）

选择两个阈值（百分比）：
- `T1`：开始惩罚阈值（例如 70%）
- `T2`：重惩罚阈值（例如 90%）

对有容量的地点（`capacity > 0`）：
- `overT1 = max(0, load - T1 * capacity)`
- `overT2 = max(0, load - T2 * capacity)`

目标函数项：
- `Minimize  W_t1 * Σ overT1 + W_t2 * Σ overT2`

说明：
- 这不是硬约束，允许超过阈值，只是会被扣分。
- 对 `capacity <= 0` 或缺失的地点，不应用均衡惩罚。

---

## 8. 质量目标：地点-时段归集（Location Slot Consolidation，可选）

> 适用场景：某些地点存在“统一接待/安保”诉求，希望尽量集中在同一时段（例如：尽量都安排在 MORNING）。

### 8.1 按天归集（BY_DAY，推荐默认）

对地点 `l`、日期 `d`、时段 `s ∈ {MORNING, AFTERNOON}` 定义：

- `used[d,l,s] ∈ {0,1}`：该日该地点在该时段是否被任何团组使用
- `both_used[d,l] ∈ {0,1}`：该日该地点是否同时在 MORNING 与 AFTERNOON 被使用（归集违规）

目标函数项（软目标）：
- `Minimize Σ_{d,l} W_consolidate[l] * both_used[d,l]`

含义：
- 鼓励同一天把该地点的接待集中在一个时段完成（避免上午/下午都接待）。

### 8.2 指定目标时段（targetSlot，SOFT/HARD）

对地点 `l` 可配置目标时段：`targetSlot ∈ {MORNING, AFTERNOON}`。

- `targetSlotMode = SOFT`：允许落到非目标时段，但会被惩罚
- `targetSlotMode = HARD`：禁止落到非目标时段（更严格，可能导致 missing 增加或不可行）

SOFT 情况下的目标项示意：
- 若 `targetSlot=MORNING`，惩罚 `used[d,l,AFTERNOON]`

### 8.3 配置入口（输入侧）

短期建议放在 `input.rules.locationPreferences`（不改 DB 也能跑）：

```json
{
  "locationPreferences": {
    "8": {
      "consolidateMode": "BY_DAY",
      "targetSlot": "MORNING",
      "targetSlotMode": "SOFT",
      "consolidateWeight": 80,
      "wrongSlotPenalty": 30
    }
  }
}
```

---

## 9. 目标函数总览（推荐优先级）

由于本轮偏好是质量优先，推荐的目标函数加权顺序为：

1) A：少重复地点（W_repeat 高）
2) C：更均衡（W_t1 / W_t2 中）
3) 归集目标（W_consolidate / wrongSlotPenalty 视地点需求设定）
4) missing：中间天尽量满（W_missing 低）

示意：

```
Minimize =
  W_repeat * repeat_penalty
+ W_balance * load_penalty
+ W_consolidate * consolidation_penalty
+ W_missing * missing_penalty
```

---

## 9. 实现落点（代码位置）

- 建模与求解：`trip-manager/solver-lab-py/solver_lab/model_cp_sat.py`
  - 增加 missing 变量与对应约束
  - 增加“同日早午不同地点”硬约束
  - 增加 A/C 的 objective 项

- 报告输出：`trip-manager/solver-lab-py/solver_lab/exporter.py`
  - 输出 missing 清单（团/日期/时段）
  - 输出重复最多的团-地点 TopN
  - 输出最拥挤的日期-时段-地点 TopN

- LNS 优化：`trip-manager/solver-lab-py/solver_lab/optimize_lns.py`
  - 邻域优先围绕“重复/拥挤/缺口”区域打散重排，提高优化效率

---

## 10. 与现有导入/回滚机制的关系

- 求解结果仍以 `ec-planning-result@1` 的 `assignments[] / unassigned[]` 表达。
- 导入仍走 `/api/planning/import`（支持 dryRun/冲突列表/快照/回滚）。
- 本规则包不会改变导入语义，仅改变“求解器倾向输出什么样的 assignments”。
