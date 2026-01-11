# Education Connect（研学行程管理系统）

面向研学团组的多团组行程排期与日历管理系统，支持团组管理、行程资源、日历详情与统计报表。V2 以“团组信息 + 日历详情 + 详细日程”为核心流程，并提供 AI 多团组宏观排期能力。

## 核心功能
- 多团组排期：行程设计器按日期/时段快速排期，冲突提示
- 团组管理 V2：列表式管理、团组信息、日历详情、详细日程
- 行程资源与行程方案：资源库 + 方案组合，日历中拖拽排期
- AI 多团组生成：按场地容量、开放/禁用时段生成最少冲突的全局安排，并自动生成团组方案
- 统计报表：团组与资源使用概览

## 技术栈
- 前端：React 18 + Vite + Ant Design + FullCalendar
- 后端：Node.js + Express + better-sqlite3
- 认证：HTTP Basic Auth（开发默认 admin/admin123）
- 数据库：SQLite（`trip-manager/backend/db/trip.db`）

## 快速开始
前置：Node.js 16+、npm（或 yarn）

1) 启动后端
```bash
cd trip-manager/backend
npm install
npm run start
```

2) 启动前端（新终端）
```bash
cd trip-manager/frontend
npm install
npm run dev
```

3) 访问系统
- 前端：http://localhost:5173
- 后端：http://localhost:3001
- 默认账号：`admin` / `admin123`

## AI 多团组生成（行程设计器）
入口：`行程设计器` → `AI 多团组生成`

流程：
1. 选择团组与日期范围
2. 预览冲突与分配结果
3. 生成并保存（写入行程方案并绑定团组）

AI 使用：
- 环境变量：`AI_api_key`
- 提供方：`AI_PROVIDER`（`openai`/`gemini`，默认 `openai`）
- 可选模型：`AI_MODEL`（默认 `gpt-4.1`）
- 未配置 Key 时自动走规则引擎（不调用 AI）

PowerShell 示例：
```bash
$env:AI_api_key="YOUR_API_KEY"
$env:AI_MODEL="gpt-4.1"
```

Gemini 示例：
```bash
$env:AI_api_key="YOUR_GEMINI_KEY"
$env:AI_PROVIDER="gemini"
$env:AI_MODEL="gemini-1.5-pro-latest"
```

也可以在 `trip-manager/backend/.env` 中配置（参考 `trip-manager/backend/.env.example`），然后重启后端即可生效。

## 场地可用性配置（locations）
AI 生成依赖以下字段（均可为空）：
- `capacity`：场地容量
- `blocked_weekdays`：周几不可用，例如 `3,4` 表示周三/周四不可用
- `open_hours`：JSON 字符串，按星期/默认开放时段
- `closed_dates`：JSON 数组，禁用日期列表
- `target_groups`：适用团组类型（`primary`/`secondary`/`all`）

`open_hours` 示例：
```json
{
  "default": [{"start": 9, "end": 17}],
  "3": [{"start": 9, "end": 12}, {"start": 14, "end": 17}]
}
```

`closed_dates` 示例：
```json
["2025-01-01", "2025-05-01"]
```

## API 端点（核心）
- 认证：HTTP Basic Auth（开发默认 admin/admin123）
- 团组：`GET /api/groups`、`GET /api/groups/:id`、`POST /api/groups`、`PUT /api/groups/:id`、`DELETE /api/groups/:id`
- 场地：`GET /api/locations`、`GET /api/locations/:id`、`POST /api/locations`、`PUT /api/locations/:id`、`DELETE /api/locations/:id`
- 行程活动（排期汇总）：`GET /api/activities`、`GET /api/activities/raw`、`POST /api/activities`、`PUT /api/activities/:id`、`DELETE /api/activities/:id`
- 日程（团组日历详情）：`GET /api/groups/:groupId/schedules`、`GET /api/schedules`、`POST /api/groups/:groupId/schedules/batch`
- 行程方案：`GET /api/itinerary-plans`、`GET /api/itinerary-plans/:id`、`POST /api/itinerary-plans`、`PUT /api/itinerary-plans/:id`、`DELETE /api/itinerary-plans/:id`
- AI 多团组排期：`POST /api/ai/plan/global`（`groupIds`/`startDate`/`endDate`/`timeSlots`/`planNamePrefix`/`replaceExisting`/`dryRun`/`useAI`）
- 编辑锁：`GET /api/lock/status`、`POST /api/lock/acquire`、`POST /api/lock/release`、`POST /api/lock/renew`
- 统计与导出：`GET /api/statistics`、`GET /api/statistics/export?format=csv`

## 数据库结构（核心表）
- `users`：账号、密码哈希、角色（admin/viewer）
- `groups`：名称、类型、人数、起止日期、`itinerary_plan_id`
- `locations`：名称、容量、`blocked_weekdays`、`open_hours`、`closed_dates`、`target_groups`、`is_active`
- `activities`：`group_id`、`location_id`、`activity_date`、`time_slot`、`participant_count`、`schedule_id`
- `schedules`：团组日程详情（日期、起止时间、标题、`location_id`、`is_from_resource`）
- `itinerary_plans` / `itinerary_plan_items`：方案与地点组合/排序
- `edit_lock`：编辑锁（当前占用人/过期时间）
- `system_config`：系统配置项
- 视图 `calendar_view`：日历导出/统计视图
- 结构定义：`trip-manager/backend/db/init.sql`

## 目录结构
```
education-connect/
├── trip-manager/                 # 主应用（前端 + 后端）
├── V2/                           # V2 需求方案文档
├── future/                       # 未来规划
├── Studio_Field_架构设计/         # 架构设计资料
├── calendar/                     # 日历相关试验
├── .claude/                      # Claude 命令与配置
├── CLAUDE.md                     # 项目概览
├── 项目架构和运行原理详解.md
├── 项目前后端交互详解.md
└── CALENDAR_TECHNICAL_GUIDE.md
```

## 版本记录
### V2.0
- 行程设计器新增「AI 多团组生成」入口，支持预览/一键保存
- 后端新增全局排期与保存逻辑（容量 + 开放/禁用时段约束）
- 场地支持 `open_hours`/`closed_dates` 字段（JSON 格式）用于时间窗限制
