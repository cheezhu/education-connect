# 架构概览（当前实现）

本项目当前可运行系统位于 `trip-manager/`，前后端共用 SQLite 数据库。

## 组件
- 前端（React + Vite）：`trip-manager/frontend`
  - 启动端口：5173
  - 开发代理：`/api` -> `http://localhost:3001`
- 后端（Node.js + Express）：`trip-manager/backend`
  - 启动端口：3001
  - 认证：HTTP Basic Auth（用户存于 SQLite）
  - 路由模块：`trip-manager/backend/src/routes/*`
- 数据库（SQLite）：`trip-manager/backend/db/trip.db`
  - 初始化脚本：`trip-manager/backend/db/init.sql`
  - 重置命令：`npm run init-db`（会删除并重建数据库）

## 主要API模块
- `groups` / `locations` / `activities` / `schedules`
- `itinerary-plans` / `ai` / `statistics` / `lock` / `config`

## 数据流（开发态）
浏览器 → Vite 开发服务器（5173）→ 代理 `/api` → Express 服务（3001）→ SQLite

## AI 配置
- 变量：`AI_api_key`、`AI_PROVIDER`、`AI_MODEL`、`AI_TIMEOUT_MS`
- system_config：`ai_api_key`、`ai_provider`、`ai_model`、`ai_timeout_ms`（优先于环境变量）
- 默认逻辑：未设置 `AI_PROVIDER` 时使用 `openai`；未设置 `AI_api_key` 时不调用外部 AI
