# Education Connect（研学行程管理系统）

Education Connect 是面向研学团组的行程排期与日历管理系统，支持团组管理、资源配置、日历排期与统计报表，并提供 AI 辅助的多团组排期能力。

## 快速开始
前置：Node.js 16+、npm（或 yarn）

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

## 配置（AI）
后端支持 `AI_api_key`、`AI_PROVIDER`、`AI_MODEL`、`AI_TIMEOUT_MS`。
- `AI_PROVIDER` 支持 `openai` 或 `gemini`；未设置时默认 `openai`
- 未配置 `AI_api_key` 时，AI 排期会退化为规则引擎（不调用外部 AI）

PowerShell 示例：
```bash
$env:AI_api_key="YOUR_API_KEY"
$env:AI_PROVIDER="gemini"
$env:AI_MODEL="gemini-1.5-pro-latest"
```

也可以在 `trip-manager/backend/.env` 中配置（参考 `trip-manager/backend/.env.example`），修改后重启后端生效。

## 数据与API
- 数据库：`trip-manager/backend/db/trip.db`
- 表结构定义：`trip-manager/backend/db/init.sql`
- API 路由实现：`trip-manager/backend/src/routes`
- 前端开发代理：`trip-manager/frontend/vite.config.js` 中将 `/api` 代理到 `http://localhost:3001`

## 目录结构
```
education-connect/
├── trip-manager/    # 主应用（前端 + 后端）
├── docs/            # 统一文档中心
├── .claude/         # Claude 命令与配置（可选）
└── .gitignore
```

## 文档索引
- 架构概览：`docs/architecture/overview.md`
- 日历技术细节：`docs/calendar/calendar-days-view.md`
- 日历/行程设计器互通：`docs/calendar/schedule-activity-sync.md`
- Studio/Field 与市场策略：`docs/strategy/README.md`
- 历史与遗留文档：`docs/history/README.md`
