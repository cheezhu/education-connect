# 导出排程输入包：planning_input.json（ec-planning-input@2）

> 用途：从行程设计器导出一个“可被大模型/求解器消费”的输入包，用于跨团组资源调配。
> 这个输入包里包含：团组、地点、必去点（硬约束）以及已有占用（用于避免冲突）。

## 1) 从哪里导出

- 行程设计器（`/designer`）右上角：
  - `导出包`：下载 JSON（`planning_input_*.json`）
  - `导出CSV`：下载人工模板 CSV（`planning_template_*.csv`）

注意：如果你选择的团组里存在“必去行程点未配置”，导出会被拦截。
导出弹窗会出现“补齐必去行程点”区域，可以直接补齐；导出时会自动保存到团组字段，然后继续导出。

## 2) 必去行程点（导出强依赖）

- 存储字段：`groups.manual_must_visit_location_ids`（地点 id 数组）
- 后端导出强校验：
  - 每个选中团组至少 1 个 id
  - id 必须存在且 `locations.is_active = 1`
- 导出 JSON 对应字段：`data.requiredLocationsByGroup[groupId].locationIds`

重要：`groups.itineraryPlanId` 只是推荐方案/模板 id，不等同于“必去”。
方案可以在 UI 中用作“一键填充必去点”的快捷方式，但是否写入“必去点”以 `manual_must_visit_location_ids` 为准。

## 3) JSON 顶层结构（概览）

```json
{
  "schema": "ec-planning-input@2",
  "meta": {
    "snapshotId": "...",
    "exportedAt": "2026-02-07T12:34:56.000Z"
  },
  "scope": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "groupIds": [1, 2]
  },
  "rules": {
    "timeSlots": ["MORNING", "AFTERNOON"],
    "slotWindows": {
      "MORNING": { "start": 6, "end": 12 },
      "AFTERNOON": { "start": 12, "end": 18 }
    },
    "maxItemsPerGroup": 8
  },
  "data": {
    "groups": [],
    "locations": [],
    "requiredLocationsByGroup": {
      "1": { "locationIds": [10, 11] }
    },
    "existingAssignments": [],
    "existingSchedules": []
  }
}
```

> 注：`rules` 来自系统 AI 规则（`system_config`），不同环境可能会多/少字段；
> 但 `schema/meta/scope/data` 结构与 `requiredLocationsByGroup` 是稳定的。

## 4) 关键字段说明（说人话）

### 4.1 `data.groups`

每个团组一条记录，包含：
- `id/name/type`
- `studentCount/teacherCount/participantCount`
- `startDate/endDate`
- `itineraryPlanId`（仅用于“推荐方案”，不是必去点）

其中：`participantCount = studentCount + teacherCount`（导出时计算）。

说明：
- `type` 当前支持：`primary` / `secondary` / `vip`

### 4.2 `data.locations`

每个地点一条记录，包含：
- `capacity`：容量（用于容量冲突检测）
- `blockedWeekdays`：不可用星期（字符串，如 `"3,4"`，含义 0=周日..6=周六）
- `closedDates`：停用日期数组（`["YYYY-MM-DD"]`）
- `openHours`：营业时间对象（从数据库 JSON 解析而来）
- `targetGroups`：团组类型限制（`all/primary/secondary`）
  - `vip` 团组在导入冲突校验中会忽略该限制（等同 `all`）
- `isActive`：是否可用（导出时只会输出 active 地点）

### 4.3 `data.requiredLocationsByGroup`（必去点，硬约束）

- key 是 groupId 的字符串
- `locationIds` 是“必须被安排”的地点集合

给大模型/求解器的推荐策略：
- 每个 `locationId` 在该团组的 `assignments` 中最多出现 1 次（避免重复占用）
- 优先把必去点排完，再考虑填充可选点

### 4.4 `data.existingAssignments` / `data.existingSchedules`

导出里会带两份“已有占用”，用于让外部排程避开冲突：
- `existingAssignments`：活动占用（偏 ItineraryDesigner 视角，按 date+timeSlot）
- `existingSchedules`：日历占用（偏 Calendar Detail 视角，按精确时间段）

注意：导入时后端会做一轮冲突检测（同团同槽、地点容量、日期可用性、团组类型等）。

## 5) CSV 模板（给非技术同学）

- 文件名：`planning_template_*.csv`
- 适用：人工填表/交接 -> 再导入系统
- 行程设计器支持把 CSV 转为 `ec-planning-result@1` 并导入（不需要手写 JSON）

## 6) 与 planning_result.json 的关系

- 外部算法/大模型输出：`ec-planning-result@1`
- 最小输出：`assignments[]`（`unassigned[]` 可选）
- 行程设计器导入：`POST /api/planning/import`
  - 支持 dryRun 校验、冲突列表
  - 支持 replaceExisting（覆盖指定日期范围内、选中团组的既有安排）

## 7) 五条保护机制（已落地）

1. 导出前强校验必去点（缺失/无效/停用 -> 409 阻断）。
2. 导出只包含 `is_active=1` 的地点；必去点若引用停用地点会被拦截。
3. 导出包含 `existingAssignments/existingSchedules`，便于外部排程避开撞车。
4. 导入支持 `dryRun` + 冲突列表；可选择 `skipConflicts`（跳过冲突条目继续导入）。
5. 导入会创建快照（`planning_import_snapshots`），支持回滚（rollback）到导入前状态。
