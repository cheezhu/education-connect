# 架构说明（历史文档·已修订）

> 旧版 V1/V2 类比与路径已移除。本文件为当前实现的简化版架构说明。

## 架构概览
- 前端：`trip-manager/frontend`（React + Vite）
- 后端：`trip-manager/backend`（Express + SQLite）
- 数据库：`trip-manager/backend/db/trip.db`

## 数据流（开发态）
浏览器 → Vite 开发服务器（5173）→ 代理 `/api` → Express 服务（3001）→ SQLite

## 后端模块
- 认证：HTTP Basic Auth（基于 `users` 表）
- 路由：`trip-manager/backend/src/routes/*`
- 关键接口：`/api/groups`、`/api/locations`、`/api/activities`、`/api/schedules`、`/api/itinerary-plans`、`/api/ai`

## 初始化与运行
```bash
cd trip-manager/backend
npm run init-db
npm run start
```

```bash
cd trip-manager/frontend
npm run dev
```
