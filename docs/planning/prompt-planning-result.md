你将收到一个 `planning_input.json`（schema=`ec-planning-input@2`）。
请把它重排成一个 **`planning_result.json`**（schema=`ec-planning-result@1`）。

要求：**只输出 JSON，不要任何解释、不要 Markdown、不要代码块。**

========================
1) 输出格式（必须严格一致）
========================

输出必须是一个 JSON 对象，且包含以下字段：

- `schema` 固定为 `"ec-planning-result@1"`
- `snapshot_id` 必须与输入一致：
  - 优先取 `input.meta.snapshotId`
  - 若不存在，再取 `input.snapshot_id`
- `mode` 固定为 `"replaceExisting"`
- `assignments` 数组（核心）
- `unassigned` 数组（可选，但建议输出，便于人工排查必去点排不进去的原因）

示例（结构示例，不代表真实数据）：

{
  "schema": "ec-planning-result@1",
  "snapshot_id": "...",
  "mode": "replaceExisting",
  "assignments": [
    { "groupId": 1, "date": "YYYY-MM-DD", "timeSlot": "MORNING", "locationId": 10, "participantCount": 48, "notes": "solver" }
  ],
  "unassigned": [
    { "groupId": 1, "locationId": 11, "reason": "NO_SLOT" }
  ]
}

========================
2) 输入字段说明（v2）
========================

你需要用到这些字段：

- 全局范围：`input.scope.startDate` ~ `input.scope.endDate`
- 时段与时间窗：`input.rules.timeSlots`、`input.rules.slotWindows`
- 团组列表：`input.data.groups[]`
- 地点列表：`input.data.locations[]`
- 必去点（硬约束）：`input.data.requiredLocationsByGroup[groupId].locationIds`
- 已有占用（硬占用参考）：`input.data.existingAssignments[]`

========================
3) 必须遵守的硬规则（Hard Constraints）
========================

你在输出之前必须先做校验，确保 0 个硬冲突：

### 1) 只使用输入里的 timeSlots

- `timeSlot` 只能取 `input.rules.timeSlots` 里的值。

### 2) 日期范围必须取交集

对每条 assignment：

- `date` 必须在 `input.scope.startDate ~ input.scope.endDate` 内
- 且必须在该团 `group.startDate ~ group.endDate` 内

否则不能安排，放入 `unassigned`，reason=`OUT_OF_RANGE`。

### 3) 同团同日同时段最多 1 个

同一个 `groupId`，同一天同一个 `timeSlot` 只能出现一次。

额外要求：如果 `input.data.existingAssignments` 里已经存在同团同日同时段占用，也视为“已占用”，不要再排第二个。

### 4) 团组类型限制（targetGroups）

- 若 `location.targetGroups` 缺失或为 `"all"`：任何团可用
- 若为 `"primary"` 或 `"secondary"`：必须与 `group.type` 完全一致
  - 注：若 `group.type = "vip"`，则视为匹配（等同 `"all"`）

不一致则不能安排，reason=`GROUP_TYPE`。

### 5) 地点可用性（blockedWeekdays / closedDates / openHours）

- `blockedWeekdays` 是一个逗号分隔字符串（如 `"3,4"`），含义为 **JS weekday**：0=周日…6=周六
- 若 `date` 的 weekday 在 blockedWeekdays 中：不可用，reason=`BLOCKED_WEEKDAY`
- 若 `date` 在 `closedDates` 列表里：不可用，reason=`CLOSED_DATE`
- `openHours`：
  - 若为 null/缺失：视为可用
  - 若存在：当天（键 `"0"`~`"6"` 或 `default`）的窗口必须完全覆盖该 `timeSlot` 的 `slotWindow`（按小时 start/end）
  - 不满足则 reason=`OPEN_HOURS`

### 6) 容量 capacity

对每个 (date, timeSlot, locationId)：

- 先计算该团人数：`participantCount = group.participantCount`（若缺失，用 `studentCount + teacherCount`）
- 总占用 = `input.data.existingAssignments` 中同 (date,timeSlot,locationId) 的 `participantCount` 之和 + 你新增 assignments 的 participantCount 之和
- 总占用不得超过 `location.capacity`（capacity <=0 或缺失视为无限）

超过则不可用，reason=`CAPACITY`。

========================
4) 必去点覆盖（强约束）
========================

对每个团组（groupId）：

- 读取 `requiredIds = input.data.requiredLocationsByGroup[groupId].locationIds`（可能为空）
- 对 `requiredIds`：
  - **尽量把每个 locationId 安排 1 次**（每个地点最多 1 次）
  - 安排不了则放入 `unassigned`，reason=`NO_SLOT`（或更具体的原因）

注意：不要因为“想排满”而把必去点重复安排多次。

========================
5) 可选填充（弱约束，可不做）
========================

如果你想让结果更“饱满”，可以在排完必去点后补充一些非必去地点：

- 每团总条目不超过：
  - `input.rules.maxItemsPerGroup`
  - 以及 `availableSlots = 天数 * input.rules.timeSlots.length`
- 优先选择不同地点（避免重复）
- 仍必须满足全部硬规则

========================
6) 输出排序（方便 diff）
========================

`assignments` 按以下顺序排序：

1) groupId 升序
2) date 升序
3) timeSlot 按 `input.rules.timeSlots` 的顺序

========================
7) reason 枚举（建议）
========================

`unassigned[].reason` 建议从以下值里选（不强制）：

OUT_OF_RANGE | GROUP_TYPE | BLOCKED_WEEKDAY | CLOSED_DATE | OPEN_HOURS | CAPACITY | GROUP_TIME_CONFLICT | NO_SLOT

========================
BEGIN_PLANNING_INPUT
<把 planning_input.json 原样粘贴在这里>
END_PLANNING_INPUT
