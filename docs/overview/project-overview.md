# 项目概览

## 项目定位
Education Connect 是面向研学团组的行程排期与日历管理系统，覆盖团组管理、地点资源、日历详情、行程设计器、统计与导出，并提供 AI 辅助排期能力。

## 当前功能清单（基于代码）
- 团组管理（列表/筛选/创建/编辑/绑定行程方案）
- 行程资源（地点管理 + 行程方案管理）
- 日历详情（CalendarDaysView：拖拽创建/编辑/删除活动）
- 行程设计器（多团组 7 日时间轴 + AI 多团组排期）
- 统计报表与导出（CSV/JSON）
- 基础认证与编辑锁
- 系统设置（行程设计器与 AI 配置）

## 技术栈
- 前端：React 18 + Vite + Ant Design + FullCalendar + Day.js
- 后端：Node.js + Express + SQLite（better-sqlite3）
- 认证：HTTP Basic Auth（bcrypt 校验）

## 运行形态
- 前端端口：5173（Vite dev server）
- 后端端口：3001（Express）
- 数据库：`trip-manager/backend/db/trip.db`

## 当前路由入口
- `/groups`、`/groups/v2`：团组管理
- `/groups/v2/new`：新建团组
- `/groups/v2/edit/:id`：团组编辑（含日历详情/详细日程）
- `/designer`：行程设计器
- `/locations`：行程资源
- `/statistics`：统计报表

## 数据模型核心
- `groups`、`locations`、`activities`、`schedules`
- `itinerary_plans`、`itinerary_plan_items`
- `edit_lock`、`system_config`
- `calendar_view`（视图）

## 关键流程
1) 日历详情（schedules）与行程设计器（activities）双向同步
2) AI 多团组排期可生成行程方案、写入 schedules/activities
3) 统计/导出通过 `calendar_view` 聚合数据
