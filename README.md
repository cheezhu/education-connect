# Education Connect（研学行程管理系统）

Education Connect 面向研学团组的行程排期与日历管理，覆盖团组管理、资源配置、日历详情、行程设计器、统计报表，并提供 AI 辅助排程能力。

## 快速开始

**前置**：Node.js 16+、npm（或 yarn）

1) 初始化数据库（首次或需要重置默认数据时）
```bash
cd trip-manager/backend
npm install
npm run init-db
```
> 该命令会重建 `trip-manager/backend/db/trip.db`。

2) 启动后端
```bash
cd trip-manager/backend
npm run start
```

3) 启动前端（新终端）
```bash
cd trip-manager/frontend
npm install
npm run dev
```

4) 访问系统
- 前端：http://localhost:5173
- 后端：http://localhost:3001
- 默认账号：`admin` / `admin123`（由 `init-db` 写入）

> 也可使用根目录脚本：`start-dev.ps1`（前后端分窗口启动，输出错误）。

## AI 配置（后端）
后端支持以下环境变量：
- `AI_api_key`
- `AI_PROVIDER`（`openai` 或 `gemini`，未设置默认 `openai`）
- `AI_MODEL`
- `AI_TIMEOUT_MS`

未配置 `AI_api_key` 时，AI 排程退化为规则引擎（不调用外部 AI）。

PowerShell 示例：
```bash
$env:AI_api_key="YOUR_API_KEY"
$env:AI_PROVIDER="gemini"
$env:AI_MODEL="gemini-1.5-pro-latest"
```

也可在 `trip-manager/backend/.env` 中配置（参考 `trip-manager/backend/.env.example`），修改后重启后端生效。

## 数据与 API
- 数据库：`trip-manager/backend/db/trip.db`
- 表结构：`trip-manager/backend/db/init.sql`
- API 路由：`trip-manager/backend/src/routes/`
- 前端代理：`trip-manager/frontend/vite.config.js` 将 `/api` 代理到 `http://localhost:3001`

## 目录结构
```
education-connect/
├─ trip-manager/    # 主应用（前端 + 后端）
├─ docs/            # 文档中心
├─ .claude/         # Claude 指令与配置（可选）
└─ start-dev.ps1    # 开发启动脚本
```

## 文档索引
- 文档中心入口：`docs/README.md`
- 项目概览：`docs/overview/project-overview.md`
- 运行说明：`docs/runbook.md`
- 系统架构：`docs/architecture/overview.md`
- API 参考：`docs/api/api-reference.md`
- 数据库结构：`docs/database/database-schema.md`
- 日历详情索引：`docs/calendar/README.md`
- AI 调用方式（行程设计器/日历详情）：`docs/itinerary/ai-workflows/README.md`
- 前端页面说明：`docs/frontend/frontend-ui.md`
- 策略与规划：`docs/strategy/README.md`
- 历史与遗留文档：`docs/history/README.md`
