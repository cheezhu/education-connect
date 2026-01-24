# Education Connect（历史文档·已修订）

> 提示：本文档为历史版本整理，已按当前实现修订。权威入口请以 `README.md` 与 `docs/architecture/overview.md` 为准。

## 项目概述
Education Connect 是研学团组的行程排期与日历管理系统，支持团组管理、资源配置、日历排期与统计报表，并提供 AI 辅助排期能力。

## 当前实现要点
- 前端：React 18 + Vite + Ant Design + FullCalendar
- 后端：Node.js + Express + SQLite（better-sqlite3）
- 认证：HTTP Basic Auth（用户存储在 `users` 表，bcrypt 校验）
- 端口：前端 5173 / 后端 3001

## 目录结构（简化）
```
education-connect/
├── trip-manager/
│   ├── frontend/
│   └── backend/
└── docs/
```

## 主要页面路由（当前）
- `/groups`（团组管理）
- `/groups/v2`（团组管理，等同入口）
- `/groups/v2/new`（新建团组）
- `/groups/v2/edit/:id`（团组编辑）
- `/designer`（行程设计器）
- `/locations`（行程资源）
- `/statistics`（统计报表）

## 数据与模型（简要）
- 核心表：`groups`、`locations`、`activities`、`schedules`、`itinerary_plans`、`edit_lock`、`system_config`
- `activities.time_slot`：`MORNING`/`AFTERNOON`/`EVENING`
- `activities.schedule_id` 关联 `schedules.id`（详见 `docs/calendar/schedule-activity-sync.md`）

## 运行与初始化
```bash
cd trip-manager/backend
npm install
npm run init-db
npm run start
```
```bash
cd trip-manager/frontend
npm install
npm run dev
```

默认账号由 `init-db` 写入：`admin` / `admin123`

## AI 配置
- 环境变量：`AI_api_key`、`AI_PROVIDER`、`AI_MODEL`、`AI_TIMEOUT_MS`
- 未配置 `AI_api_key` 时，AI 排期退化为规则引擎
