# API 端点清单（后端）

基础路径：`/api`

## 认证与权限（概览）

认证：
- HTTP Basic Auth（前端登录页会把凭证写入 localStorage，见 `docs/config-auth.md`）
- 初始化数据库后会有默认种子账号（见 `docs/ops-runbook.md`）

权限（以 `trip-manager/backend/server.js` 为准）：
- admin-only：`/api/lock/*`、`/api/activities/*`、`/api/planning/*`、`/api/config/*`、`/api/users/*`（除了 `GET /api/users/me`）
- admin/editor：可写 `groups/locations/itinerary-plans/schedules/logistics/resources/members`
- viewer：只读（GET）

编辑锁（写入保护）：
- 多数写接口要求编辑锁（`requireEditLock`）
- admin/editor 在锁空闲时会自动获取 5 分钟锁（无需先点“进入编辑模式”）

## 用户 /users
- GET `/users/me`：获取当前登录用户
- GET `/users`（仅 admin）：用户列表（不返回密码）
- POST `/users`（仅 admin）：创建用户
- PUT `/users/:id`（仅 admin）：更新用户（含重置密码）
- DELETE `/users/:id`（仅 admin）：删除用户

## 团组 /groups
- GET `/groups`：获取全部团组
- GET `/groups/:id`：获取单个团组
- POST `/groups`（需编辑锁）：创建团组
- PUT `/groups/:id`（需编辑锁）：更新团组
- DELETE `/groups/:id`（需编辑锁）：删除团组（若无关联活动）

## 地点 /locations
- GET `/locations`：获取可用地点（is_active=1）
- GET `/locations/:id`：单个地点
- POST `/locations`（需编辑锁）：创建地点
- PUT `/locations/:id`（需编辑锁）：更新地点
- DELETE `/locations/:id`（需编辑锁）：软删除（is_active=0）

## 行程方案 /itinerary-plans
- GET `/itinerary-plans`：获取全部方案及其地点项
- GET `/itinerary-plans/:id`：获取单个方案
- POST `/itinerary-plans`（需编辑锁）：创建方案
- PUT `/itinerary-plans/:id`（需编辑锁）：更新方案
- DELETE `/itinerary-plans/:id`（需编辑锁）：删除方案

## 日程 /schedules
- GET `/groups/:groupId/schedules`：获取团组日程详情（header: `x-schedule-revision`）
- GET `/schedules`：获取全部日程（调试用途）
- POST `/groups/:groupId/schedules/batch`（需编辑锁）：批量替换团组日程，并同步 activities（需携带 `revision`）

行程设计器同步（admin-only）：
- GET `/groups/:groupId/schedules/designer-source`：从行程设计器拉取可同步行程点
- POST `/groups/:groupId/schedules/push-to-designer`（需编辑锁）：把日历详情的行程点推送到行程设计器

## 食行卡片 /groups/:groupId/logistics
- GET `/groups/:groupId/logistics`：获取团组食行卡片
- POST `/groups/:groupId/logistics`（需编辑锁）：批量保存（替换该团组全部食行卡片数据）

## 团组成员 /groups/:groupId/members
- GET `/groups/:groupId/members`：成员列表
- POST `/groups/:groupId/members`（需编辑锁）：新增成员
- PUT `/groups/:groupId/members/:memberId`（需编辑锁）：更新成员
- DELETE `/groups/:groupId/members/:memberId`（需编辑锁）：删除成员

## 资源库 /resources/*
- GET `/resources/people`：人员资源（司机/导游/安保）
- POST `/resources/people`（需编辑锁）
- PUT `/resources/people/:id`（需编辑锁）
- DELETE `/resources/people/:id`（需编辑锁）
- GET `/resources/hotels`
- POST `/resources/hotels`（需编辑锁）
- PUT `/resources/hotels/:id`（需编辑锁）
- DELETE `/resources/hotels/:id`（需编辑锁）
- GET `/resources/vehicles`
- POST `/resources/vehicles`（需编辑锁）
- PUT `/resources/vehicles/:id`（需编辑锁）
- DELETE `/resources/vehicles/:id`（需编辑锁）

## 活动 /activities（admin-only）
- GET `/activities`：按日期/团组/地点筛选活动（返回 FullCalendar 事件结构）
- GET `/activities/raw`：原始活动列表（用于行程设计器）
- POST `/activities`（需编辑锁）：创建活动并同步 schedules
- PUT `/activities/:id`（需编辑锁）：更新活动并同步 schedules
- DELETE `/activities/:id`（需编辑锁）：删除活动并删除关联 schedule

## 排程（跨团组导出/导入）/planning（admin-only）
- POST `/planning/export`：导出 planning_input.json（附件下载，`ec-planning-input@2`）
- POST `/planning/import`：导入 planning_result.json（`ec-planning-result@1`，支持 dryRun/skipConflicts/replaceExisting/日期范围保护）
- POST `/planning/import/rollback`：回滚最近一次导入

详见：
- `docs/planning/export-planning-input.md`
- `docs/planning/import-planning-result.md`
- `docs/planning/prompt-planning-result.md`
- `trip-manager/solver-lab-py/docs/solver-workflow.md`

## 统计 /statistics
- GET `/statistics`：统计概览 + 各类使用统计
- GET `/statistics/export`：导出活动
  - 参数：format=json|csv, startDate, endDate

## 编辑锁 /lock（admin-only）
- GET `/lock/status`：查看锁状态
- POST `/lock/acquire`：获取锁
- POST `/lock/release`：释放锁
- POST `/lock/renew`：续期锁

## 系统配置 /config（admin-only）
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

## AI 排期 /ai（规划/未落地）

当前后端未挂载 `/api/ai/*` 路由；前端 Copilot 为静态 UI 预留入口。相关背景见：`docs/itinerary-designer-upgrade-review-2026-02-06.md`。
