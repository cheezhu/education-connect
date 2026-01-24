# planning_result 导入实现级规范（Draft）

> 本文为实现级接口与字段映射规范，配合 `planning_result_import_design.md` 使用。

---

## 1) 后端接口设计

### 1.1 接口
- Method: POST
- Path: `/api/planning/import`
- Auth: HTTP Basic Auth（建议加 `requireEditLock`）

### 1.2 Request Body
```json
{
  "payload": { /* planning_result.json 原文 */ },
  "options": {
    "groupIds": [1,2],
    "replaceExisting": false,
    "skipConflicts": true,
    "createPlans": true,
    "dryRun": false
  }
}
```

**说明**：
- `payload` 是 planning_result 原始 JSON。
- `groupIds`：可选过滤，只导入选中团组。
- `replaceExisting`：是否删除日期范围内既有 activities/schedules（仅选中团组）。
- `skipConflicts`：若 true，遇到冲突条目跳过；否则直接 409 失败。
- `createPlans`：是否为每个团组创建行程方案并写入 `itinerary_plan_items`。
- `dryRun`：只校验不写库，返回冲突与统计。

### 1.3 Response
成功（200）
```json
{
  "summary": {
    "groups": 2,
    "assignments": 120,
    "inserted": 118,
    "skipped": 2,
    "conflicts": 2
  },
  "conflicts": [
    {
      "group_id": 1,
      "date": "2025-09-12",
      "time_slot": "MORNING",
      "location_id": 10,
      "reason": "capacity_exceeded"
    }
  ]
}
```

失败（400/409/500）
```json
{ "error": "..." }
```

---

## 2) payload 结构与字段映射

### 2.1 支持的 schema
- `ec-planning-result@1`

### 2.2 assignments 结构（最小）
```json
{
  "group_id": 1,
  "date": "YYYY-MM-DD",
  "time_slot": "MORNING|AFTERNOON|EVENING",
  "location_id": 10,
  "participant_count": 48
}
```

### 2.3 字段映射到 schedules
- `group_id` → schedules.group_id
- `date` → schedules.activity_date
- `time_slot` → schedules.start_time/end_time（按 slotWindows 生成）
- `location_id` → schedules.location_id
- `title` → location.name（若无 location，则 group.name）
- `location` → location.name
- `type` → "visit"（默认）
- `color` → group.color（默认）
- `resource_id` → `import-<snapshot_id>-loc-<location_id>`
- `is_from_resource` → 1

### 2.4 字段映射到 activities
- `group_id` → activities.group_id
- `location_id` → activities.location_id
- `date` → activities.activity_date
- `time_slot` → activities.time_slot
- `participant_count` → activities.participant_count
- `schedule_id` → schedules.id（插入后回写）

### 2.5 参与人数缺失处理
- 若 `participant_count` 缺失或非数值：
  - 默认 `group.student_count + group.teacher_count`

---

## 3) 规则与时间窗

### 3.1 时间窗来源
- 读取 `system_config` key=`ai_schedule_rules`（同 AI planner 规则）
- 若不存在，使用默认：
  - MORNING 9-12, AFTERNOON 14-17, EVENING 19-21

### 3.2 时间段映射
- `start_time = "{start}:00"`
- `end_time = "{end}:00"`

---

## 4) 校验与冲突策略

### 4.1 基础校验（400）
- schema 不匹配
- assignments 不存在或不是数组
- 日期格式错误
- group/location 不存在

### 4.2 业务冲突（可 skip 或 409）
- location.is_active=0
- blocked_weekdays 命中
- closed_dates 命中
- target_groups 不匹配
- capacity 超限（建议按活动表累计）
- 同团组同 date/time_slot 已有活动

### 4.3 冲突处理
- `skipConflicts=true`：跳过冲突项，继续导入
- `skipConflicts=false`：直接返回 409，并给出冲突详情

---

## 5) 写入事务流程（建议）

1) 解析 payload + options
2) 基础校验（schema、range、assignments）
3) 拉取 groups / locations 数据
4) 冲突预检（按 options）
5) `dryRun=true` 直接返回统计
6) 事务开始：
   - 若 `replaceExisting=true`：
     - 删除选中团组在 date range 内的 activities + schedules
   - 若 `createPlans=true`：
     - 为每个 group 创建 plan，写入 plan_items（按 assignments 中出现的 location_id 顺序）
     - 更新 groups.itinerary_plan_id
   - 插入 schedules + activities（保持 1:1 关联）
7) 返回 summary

---

## 6) 前端导入流程

- 解析 JSON → 显示预览
- 调用 `/api/planning/import`
- 成功后刷新行程设计器数据
- 若返回 conflicts：显示列表，提示跳过/回滚策略

---

## 7) 兼容与安全

- **必须禁止** 读取或导出 .env / 密钥 / 本地敏感信息
- 对输入 JSON 做 size 限制（例如 5–10MB）
- 日志只记录统计信息，不记录原始 payload 全量

---

## 8) 建议新增的前端提示

- “覆盖已有安排”会清空范围内所有活动
- “仅导入选中团组”可减少误操作
- 冲突处理策略提示清晰

---

## 9) 对齐当前系统能力

- activities 与 schedules 双写符合当前系统数据流
- 计划创建与绑定符合 `itinerary_plans` 结构
- 后端已有 edit_lock，可直接复用
