# API 端点清单（后端）

基础路径：`/api`
认证：HTTP Basic Auth（前端默认 admin/admin123）

## 团组 /groups
- GET `/groups`：获取全部团组
- GET `/groups/:id`：获取单个团组
- POST `/groups`（需编辑锁）：创建团组
  - 支持 camelCase 与 snake_case（部分字段）
- PUT `/groups/:id`（需编辑锁）：更新团组
  - 可更新字段：name、type、student_count、teacher_count、start_date、end_date、duration、color、contact_person、contact_phone、notes、itinerary_plan_id
- DELETE `/groups/:id`（需编辑锁）：删除团组（若无关联活动）

## 地点 /locations
- GET `/locations`：获取可用地点（is_active=1）
- GET `/locations/:id`：单个地点
- POST `/locations`（需编辑锁）：创建地点
- PUT `/locations/:id`（需编辑锁）：更新地点
- DELETE `/locations/:id`（需编辑锁）：软删除（is_active=0）

## 活动 /activities
- GET `/activities`：按日期/团组/地点筛选活动（返回 FullCalendar 事件结构）
- GET `/activities/raw`：原始活动列表（用于行程设计器）
- POST `/activities`（需编辑锁）：创建活动并同步 schedules
- PUT `/activities/:id`（需编辑锁）：更新活动并同步 schedules
- DELETE `/activities/:id`（需编辑锁）：删除活动并删除关联 schedule

## 日程 /schedules
- GET `/groups/:groupId/schedules`：获取团组日程详情
- GET `/schedules`：获取全部日程（调试用途）
- POST `/groups/:groupId/schedules/batch`（需编辑锁）：批量替换团组日程，并同步 activities

## 行程方案 /itinerary-plans
- GET `/itinerary-plans`：获取全部方案及其地点项
- GET `/itinerary-plans/:id`：获取单个方案
- POST `/itinerary-plans`（需编辑锁）：创建方案
- PUT `/itinerary-plans/:id`（需编辑锁）：更新方案
- DELETE `/itinerary-plans/:id`（需编辑锁）：删除方案

## 统计 /statistics
- GET `/statistics`：统计概览 + 各类使用统计
- GET `/statistics/export`：导出活动
  - 参数：format=json|csv, startDate, endDate

## 编辑锁 /lock
- GET `/lock/status`：查看锁状态
- POST `/lock/acquire`：获取锁（仅 admin）
- POST `/lock/release`：释放锁
- POST `/lock/renew`：续期锁

## 系统配置 /config
- GET `/config/itinerary-week-start`
- PUT `/config/itinerary-week-start`
- GET `/config/itinerary-time-slots`
- PUT `/config/itinerary-time-slots`
- GET `/config/itinerary-daily-focus`
- PUT `/config/itinerary-daily-focus`
- GET `/config/itinerary-group-row-align`
- PUT `/config/itinerary-group-row-align`
- GET `/config/all`：获取全量系统配置（含 AI 配置与规则）
- PUT `/config/all`：批量更新系统配置（行程设置 + AI 基础配置）

## AI 排期 /ai
- GET `/ai/rules`
- PUT `/ai/rules`（需编辑锁）
- GET `/ai/history`
- POST `/ai/plan/global`（多团组排期）
- POST `/ai/plan/itinerary`（单团组方案排期）

详见：`docs/ai/ai-planner.md`

## 排程输入包导出 /planning
- POST `/planning/export`：导出 planning_input.json（附件下载）
