﻿﻿# 账号与后台管理设计（Account Admin）

本说明用于定义本项目的账号体系与后台管理能力，作为实施与验收依据。

## 现状摘要（基于现有代码）
- 认证方式：HTTP Basic Auth（后端 `express-basic-auth`）
- 用户数据：SQLite `users` 表（bcrypt 密码）
- 默认账号：admin/admin123、viewer1/admin123
- 前端：无登录页，`api.js` 固定注入 Basic Auth
- 权限：主要靠编辑锁（admin 自动获取锁），缺少细粒度权限

## 目标
- 提供可用的登录/登出流程（前端可见）
- 支持账号管理（增删改、重置密码、禁用）
- 角色与权限可扩展（admin / editor / viewer 等）
- 兼容现有 Basic Auth（短期过渡）

## 角色与权限（建议）
| 角色 | 权限范围 |
| --- | --- |
| admin | 全量读写、账号管理、系统设置 |
| editor | 业务数据读写、不可管理账号/系统设置 |
| viewer | 只读 |

## 数据模型（建议）
### users
| 字段 | 说明 |
| --- | --- |
| id | 主键 |
| username | 唯一用户名 |
| password | bcrypt hash |
| display_name | 显示名 |
| role | admin/editor/viewer |
| is_active | 启用/禁用 |
| created_at / updated_at | 时间戳 |
| last_login | 最近登录 |

### sessions / tokens（任选其一）
1) **JWT**（无状态）
   - token 存本地
   - 过期时间 + refresh
2) **Session 表**（有状态）
   - `session_id` / `user_id` / `expires_at`
   - 服务端可强制失效

## 认证流程（建议）
1. `/auth/login` 传 username/password
2. 成功返回 token + user profile
3. 前端将 token 存储并随请求附带（Authorization: Bearer）
4. `/auth/logout` 或本地清除 token

> 过渡方案：保留 Basic Auth，新增 Bearer Auth，逐步迁移前端请求头。

## API 设计（建议）
### Auth
- POST `/api/auth/login`
- POST `/api/auth/logout`
- GET  `/api/auth/me`

### Users
- GET  `/api/users`（列表）
- POST `/api/users`（创建）
- PUT  `/api/users/:id`（更新）
- PUT  `/api/users/:id/password`（重置密码）
- PUT  `/api/users/:id/disable`（禁用/启用）

## 前端页面与交互（建议）
- `/login`：登录页
- `/settings`：账号管理 Tab（仅 admin）
  - 用户列表 + 新增/编辑/禁用
  - 重置密码
  - 角色切换

## 权限策略（建议）
- 后端路由中间件：
  - `requireAuth`：已登录
  - `requireRole('admin')`
- 前端 UI 按角色隐藏不可用功能

## 安全建议
- 强制密码最小长度、复杂度
- 登录失败节流（防暴力）
- 管理员操作审计（可选）
- 禁用账号立即失效 token/session

## 迁移与实施步骤（建议）
1. 增加 `is_active` 字段与索引
2. 新增 auth 路由与中间件
3. 前端登录页 + token 注入
4. 权限中间件替换当前“只要 Basic Auth 就可写”的策略
5. 移除或弱化 Basic Auth
