# 架构概览（当前实现）

当前可运行系统位于 `trip-manager/`，前后端共用 SQLite 数据库。

## 架构总览
```
浏览器
  ↓
Vite Dev Server (5173)
  ↓  /api 代理
Express API (3001)
  ↓
SQLite (trip.db)
```

## 组件与运行形态
- 前端：React + Vite（`trip-manager/frontend`）
  - 开发端口：5173
  - 开发代理：`/api` -> `http://localhost:3001`
- 后端：Node.js + Express（`trip-manager/backend`）
  - 服务端口：3001
  - 路由模块：`trip-manager/backend/src/routes/*`
- 数据库：SQLite（`trip-manager/backend/db/trip.db`）
  - 初始化脚本：`trip-manager/backend/db/init.sql`
  - 重置命令：`npm run init-db`（会删除并重建数据库）

## 前后端通信
- 前端 `axios` 基础地址：`/api`
- 代理配置：`trip-manager/frontend/vite.config.js`

## 认证与权限
- HTTP Basic Auth（用户存储在 SQLite）
- 只有 `admin` 可获取/续期编辑锁

## 编辑锁机制
- 表：`edit_lock`（单行 id=1）
- 获取：`POST /api/lock/acquire`
- 续期：`POST /api/lock/renew`
- 释放：`POST /api/lock/release`
- 若锁空闲且用户为 admin，会自动获取 5 分钟锁

## 关键同步关系
- `schedules` ↔ `activities`（通过 `activities.schedule_id` 关联）
- `schedules` 批量保存后，同步更新 `activities`
- `activities` 变更时，同步更新 `schedules`

## 数据视图
- `calendar_view`：聚合团组、地点与活动信息，用于日历与统计

## AI 配置优先级
- 环境变量：`AI_api_key`、`AI_PROVIDER`、`AI_MODEL`、`AI_TIMEOUT_MS`
- system_config（优先生效）：`ai_api_key`、`ai_provider`、`ai_model`、`ai_timeout_ms`
- 默认逻辑：未设置 `AI_PROVIDER` 时使用 `openai`，未设置 `AI_api_key` 时不调用外部 AI
