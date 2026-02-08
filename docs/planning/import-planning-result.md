# 导入排程结果：planning_result.json / CSV（ec-planning-result@1）

> 用途：把“外部排程结果”写回系统（行程设计器 + 日历详情）。  
> 入口：行程设计器（`/designer`）右上角 “导入”。

## 1) 支持的文件类型

1. JSON：`schema = "ec-planning-result@1"`
2. CSV：人工模板（由前端解析为 `ec-planning-result@1` 再导入）

## 2) planning_result.json 最小结构（建议）

后端导入接口要求：
- 顶层必须是对象
- `schema` 必须为 `ec-planning-result@1`
- `assignments` 必须是数组

其中 `assignments[]` 的字段名支持 camelCase 与 snake_case 混用：
- `groupId` / `group_id`
- `locationId` / `location_id`
- `timeSlot` / `time_slot`
- `participantCount` / `participant_count`（可选，不填则回退到团组人数）

示例（结构示例，不代表真实数据）：
```json
{
  "schema": "ec-planning-result@1",
  "snapshot_id": "2026-02-07T12:34:56.000Z_xxxxxx",
  "range": { "startDate": "2026-02-10", "endDate": "2026-02-16" },
  "mode": "replaceExisting",
  "assignments": [
    { "groupId": 1, "date": "2026-02-10", "timeSlot": "MORNING", "locationId": 10, "participantCount": 48, "notes": "solver" }
  ],
  "unassigned": [
    { "groupId": 1, "locationId": 11, "reason": "NO_SLOT" }
  ]
}
```

说明：
- `range` 可选：如果缺失，后端会从 assignments 推导日期范围。
- `mode` 可选：当未显式传 `options.replaceExisting` 时，后端会用它作为默认值。

## 3) 前端交互（当前实现）

组件：
- `trip-manager/frontend/src/pages/ItineraryDesigner/planning/PlanningImportModal.jsx`

流程（两步）：
1. 上传文件（JSON/CSV）并选择“导入日期范围（保护机制）”
2. 点击“校验” -> 查看冲突/统计 -> 点击“导入”

额外保护机制：
- “回滚最近导入”：如果上一次导入已产生快照，可一键回滚。

## 4) 后端接口（当前实现）

路由：
- `trip-manager/backend/src/routes/planning.js`

接口：
1. `POST /api/planning/import`
2. `POST /api/planning/import/rollback`

权限说明：
- `/api/planning/*` 目前为 admin-only（见 `trip-manager/backend/server.js`）。
- import/rollback 需要编辑锁（`requireEditLock`）。

## 5) import 参数（options）

`POST /api/planning/import` 支持：
- `dryRun`：只校验不落库（前端“校验”按钮使用）
- `replaceExisting`：覆盖日期范围内的既有安排（仅对选中团组生效）
- `startDate` / `endDate`：本次导入生效范围（与 payload range 取交集；用于“保护”避免误覆盖）
- `skipConflicts`：遇到冲突条目跳过继续（否则 409 失败）
- `groupIds`：仅导入指定团组（前端“仅导入已选团组”开关控制）

注意：
- 当前后端固定 `createPlans=false`：不会创建/修改 `itinerary_plans`（行程方案）。

## 6) 写入范围（落库行为）

导入会写入两份数据（保持一致）：
- `schedules`：日历详情的数据源（精确到时间段）
- `activities`：行程设计器的数据源（按 MORNING/AFTERNOON/EVENING）

## 7) 冲突/校验清单（后端为准）

后端会对每条 assignment 做冲突检测，常见原因包括：
- `INVALID_TIME_SLOT`：timeSlot 不在 `rules.timeSlots` 内
- `OUT_OF_RANGE`：不在导入范围或不在团组起止日期内
- `GROUP_TIME_CONFLICT`：同团同日同时段已有安排
- `INACTIVE_LOCATION`：地点停用
- `GROUP_TYPE`：地点 target_groups 与团组 type 不匹配
- `INVALID_DATE`：日期字符串无效（无法推导 weekday）
- `BLOCKED_WEEKDAY`：地点 blocked_weekdays 命中
- `CLOSED_DATE`：地点 closed_dates 命中
- `OPEN_HOURS`：营业时间不覆盖 slotWindow
- `CAPACITY`：容量超限（会合并考虑已有活动占用）

UI 展示：
- 校验（dryRun）会返回 `summary + conflicts`，前端按 reason 进行聚合筛选。

## 8) 回滚（import snapshot）

导入成功后会创建快照（snapshotToken），用于回滚：
- 备份选中团组、日期范围内的 activities + schedules
- 回滚会把数据恢复到导入前

适用场景：
- 外部模型输出明显不合理
- 误勾选 replaceExisting 导致覆盖

## 9) 给非技术同学的建议

1. 先导出 `planning_input.json`（见 `docs/planning/export-planning-input.md`），再交给大模型/求解器处理。
2. 不确定结果质量时，先“校验”，并保持 `skipConflicts=true`，避免整单失败。
3. 导入后发现不对，用“回滚最近导入”快速撤销，再重来。
