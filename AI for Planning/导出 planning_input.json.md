你是资深全栈工程师。请在我当前仓库（Education Connect / trip-manager）中实现“导出排程输入包 planning_input.json 并下载为 JSON 文件”的功能。要求尽量小改动，不重构，不引入新依赖，不泄露任何 .env / 密钥 / 真实隐私数据。

========================
1) 功能目标（必须完成）
========================
A. 后端新增一个聚合导出接口：
- Method: POST
- Path: /api/planning/export
- Request body:
  {
    "groupIds": [1,2,3],
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "includeExistingActivities": true,
    "includeExistingSchedules": true,
    "includePlanItemsByGroup": true
  }

- Response:
  返回 JSON，同时支持浏览器“下载文件”的方式（Content-Disposition attachment）。
  文件名示例：planning_input_2026-01-24T10-00-00Z_abc123.json

B. 前端在 ItineraryDesigner 页面右上角新增按钮：
- 按钮名：“导出排程输入包(JSON)”
- 点击后：弹窗选择团组 + 日期范围（如果页面已有团组选择和日期范围，就复用现有 UI）
- 调用 /api/planning/export 下载 JSON 文件到本地（axios responseType=blob）
- 导出成功/失败给出 message 提示

========================
2) 输出 JSON 合同（必须严格遵守）
========================
导出文件内容结构为 planning_input.json（字段名统一 snake_case）：

{
  "schema": "ec-planning-input@1",
  "snapshot_id": "<server_generated>",
  "exported_at": "<ISO string>",
  "range": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" },

  "rules": {
    "timeSlots": ["MORNING","AFTERNOON","EVENING"],
    "slotWindows": {
      "MORNING":   {"start":9,"end":12},
      "AFTERNOON": {"start":14,"end":17},
      "EVENING":   {"start":19,"end":21}
    },
    "requireAllPlanItems": false,
    "maxItemsPerGroup": 8
  },

  "groups": [
    {
      "id": 1, "name": "...", "type": "primary|secondary",
      "student_count": 44, "teacher_count": 4,
      "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD",
      "itinerary_plan_id": 12
    }
  ],

  "locations": [
    {
      "id": 10, "name": "...", "address": "...",
      "capacity": 200,
      "blocked_weekdays": "3,4",
      "closed_dates": ["YYYY-MM-DD"],
      "open_hours": {"default":[{"start":9,"end":17}]},
      "target_groups": "all|primary|secondary",
      "is_active": 1
    }
  ],

  "plan_items_by_group": {
    "1": [
      { "location_id": 10, "sort_order": 1 }
    ]
  },

  "existing": {
    "activities": [
      { "group_id": 1, "location_id": 10, "activity_date":"YYYY-MM-DD", "time_slot":"MORNING", "participant_count": 48 }
    ],
    "schedules": [
      { "group_id": 1, "activity_date":"YYYY-MM-DD", "start_time":"09:00", "end_time":"12:00", "is_from_resource":0, "location_id":10 }
    ]
  }
}

注意：
- open_hours、closed_dates 在数据库里是 JSON 字符串；导出时请解析成对象/数组（解析失败则给 null/[]）。
- blocked_weekdays 保持字符串形式（例如 "3,4"），不必转换。
- 只导出 locations.is_active=1。
- 现有安排 existing.activities：为了容量计算，建议导出“日期范围内所有活动”（不只选中团组），避免外部排程把其他团组占用的容量算丢；但 existing.schedules 建议只导出选中团组的（用于避免同团时间重叠）。

========================
3) 后端实现细节（请按仓库现状写）
========================
- 使用现有 Express + req.db（better-sqlite3），不要引入 ORM。
- 新建路由文件：trip-manager/backend/src/routes/planning.js（或同等命名）
- 在后端入口（server.js 或 routes index）挂载：app.use('/api/planning', planningRouter)
- 生成 snapshot_id：ISO时间戳 + 随机串（无需额外依赖，可用 Date.now + Math.random）。
- 返回时设置：
  Content-Type: application/json
  Content-Disposition: attachment; filename="planning_input_<...>.json"
- 错误返回统一 { error: "..." }，400 用于参数缺失/无效。

需要读取的数据（SQL）：
- groups：SELECT * FROM groups WHERE id IN (...)
- locations：SELECT * FROM locations WHERE is_active=1
- plan_items_by_group（可选）：对每个 group.itinerary_plan_id，查 itinerary_plan_items 并输出 location_id/sort_order
- existing.activities：SELECT group_id, location_id, activity_date, time_slot, participant_count FROM activities WHERE activity_date BETWEEN startDate AND endDate
- existing.schedules（只选中团组）：SELECT group_id, activity_date, start_time, end_time, is_from_resource, location_id FROM schedules WHERE group_id IN (...) AND activity_date BETWEEN startDate AND endDate

rules 的来源：
- 优先读取 system_config key='ai_schedule_rules'（复用 aiPlanner.js 的 normalizeAiRules/getAiRules 思路；可以抽函数或复制最小实现）
- 若无配置则用默认 timeSlots=MORNING/AFTERNOON，slotWindows=默认(9-12/14-17/19-21)

========================
4) 前端实现细节（尽量复用现有）
========================
- 修改 ItineraryDesigner 页面：在现有 “AI 多团组生成/导出” 附近加一个按钮。
- 点击后弹窗：选择 groupIds + startDate/endDate
- 调用 POST /api/planning/export，responseType='blob'，然后触发浏览器下载。
- 下载文件名从响应 header 的 Content-Disposition 读取；读不到就用默认命名。

========================
5) 验收标准（你输出给我，工程师照做）
========================
- 选 2 个团组 + 1 个日期范围，点击按钮能下载 planning_input.json 文件
- 文件能被 JSON.parse 解析
- groups/locations 字段齐全且为 snake_case
- open_hours/closed_dates 已解析为对象/数组（不是原始字符串）
- existing.activities 覆盖日期范围内活动
- 若 groupIds 为空 / 日期无效，返回 400 + error