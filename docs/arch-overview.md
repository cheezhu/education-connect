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

## 前后端共用 Domain（shared/）

为了避免“时间段定义、资源类型判定”等规则在前后端重复实现导致不一致，项目引入了一个轻量共享层：

- 事实来源：`trip-manager/shared/domain/*`
  - 前端使用 ESM：`.mjs`（浏览器/Vite）
  - 后端使用 CJS：`.cjs`（Node/Express）
- 前端保留稳定导入路径：`trip-manager/frontend/src/domain/*`
  - 这些文件大多是“薄转发”，把运行时真实实现指向 `trip-manager/shared/domain/*`
- 后端开发时自动重启：`trip-manager/backend/nodemon.json` 已加入对 `../shared` 的 watch

目前已共享的关键模块：
- `trip-manager/shared/domain/time.(mjs|cjs)`：时间段窗口与 `toMinutes/resolveTimeSlotByOverlap` 等
- `trip-manager/shared/domain/resourceId.(mjs|cjs)`：`resourceId` 分类（必去/食行/其他）

## 认证与权限
- HTTP Basic Auth（用户存储在 SQLite）
- `/api/lock/acquire` 为 admin-only；但写入接口在锁空闲时会为 `admin` / `editor` 自动获取 5 分钟编辑锁

## 编辑锁机制
- 表：`edit_lock`（单行 id=1）
- 获取：`POST /api/lock/acquire`
- 续期：`POST /api/lock/renew`
- 释放：`POST /api/lock/release`
- 若锁空闲且用户为 admin/editor，会自动获取 5 分钟锁（写入接口挂 `requireEditLock` 时触发）

## 关键同步关系
- `schedules` ↔ `activities`（通过 `activities.schedule_id` 关联）
- `schedules` 批量保存后，同步更新 `activities`
- `activities` 变更时，同步更新 `schedules`

## 数据视图
- `calendar_view`：聚合团组、地点与活动信息，用于日历与统计

## AI 配置优先级
- 环境变量：`AI_API_KEY`（推荐）/`AI_api_key`（兼容旧名）、`AI_PROVIDER`、`AI_MODEL`、`AI_TIMEOUT_MS`
- system_config（优先生效）：`ai_api_key`、`ai_provider`、`ai_model`、`ai_timeout_ms`
- 默认逻辑：未设置 `AI_PROVIDER` 时使用 `openai`，未设置 API Key 时不调用外部 AI
