# 系统架构

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

## 核心模块
- 前端：React 页面 + Ant Design UI
- 后端：Express 路由 + SQLite 数据访问
- 数据：SQLite（`trip-manager/backend/db/trip.db`）

## 前后端通信
- 前端 `axios` 基础地址：`/api`
- Vite 代理配置：`trip-manager/frontend/vite.config.js`

## 认证与权限
- HTTP Basic Auth
- 仅 `admin` 可获取/续期编辑锁
- 需要编辑锁的接口由 `requireEditLock` 中间件保护

## 编辑锁机制
- 表：`edit_lock`（单行 id=1）
- 获取：`POST /api/lock/acquire`
- 续期：`POST /api/lock/renew`
- 释放：`POST /api/lock/release`
- 中间件逻辑：若锁空闲且用户为 admin，会自动获取 5 分钟锁

## 关键同步关系
- `schedules` ↔ `activities`（通过 `activities.schedule_id` 关联）
- `schedules` 批量保存后，同步更新 `activities`
- `activities` 变更时，同步更新 `schedules`

## 数据视图
- `calendar_view`：聚合团组、地点与活动信息，用于日历与统计
