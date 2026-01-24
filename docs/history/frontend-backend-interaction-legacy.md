# 前后端交互说明（历史文档·已修订）

> 本文档为旧版交互说明的修订版，已对齐当前实现。

## 服务端口
- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`
- 代理：前端 `/api/*` → 后端 `/api/*`

## 启动流程（简化）
1. `npm run dev` 启动 Vite 开发服务器（5173）
2. `npm run start` 启动 Express 服务（3001）
3. 前端请求通过代理转发至后端

## 请求流程（示例）
```
浏览器 → /api/groups
  ↓ (Vite 代理)
Express /api/groups
  ↓
SQLite 查询
  ↓
JSON 返回
```

## 认证方式
- HTTP Basic Auth
- 用户来自 `users` 表，bcrypt 校验密码

## 数据结构（简要）
- 团组：`groups`
- 地点：`locations`
- 排期活动：`activities`
- 日程详情：`schedules`
