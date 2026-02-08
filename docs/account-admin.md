# 账号与权限（当前实现）

记录日期：2026-02-08

## 1) 认证方式（现在就是这么做的）

- HTTP Basic Auth
- 后端：从 SQLite `users` 表读取用户并用 bcrypt 校验密码（见 `trip-manager/backend/server.js`）
- 前端：`/login` 页面用 `GET /api/users/me` 校验凭证，成功后把 `Authorization`（Basic xxx）保存到 localStorage（key=`ec_basic_auth`）
- 每次请求：`trip-manager/frontend/src/services/api.js` 会自动注入 `Authorization`

## 2) 默认用户（仅本地 init-db 后存在）

`npm run init-db` 会写入默认用户（用于本地开发/演示）：

| username | password | role |
|---|---|---|
| admin | admin123 | admin |
| viewer1 | admin123 | viewer |

上线前必须处理：
- 删除默认用户或修改密码
- 避免把 `trip.db`（含明文敏感信息）直接拷贝到不可信环境

## 3) 角色定义

- admin：全量访问 + 全量写入 + 用户管理 + 系统设置
- editor：业务数据读写（团组/地点/日历/资源/成员/食行卡片），不可访问用户管理与系统设置
- viewer：只读

## 4) 前端权限矩阵（以 `useAuth.jsx` 为准）

| 功能 | admin | editor | viewer |
|---|---|---|---|
| 行程设计器（/designer） | 访问 | 禁止 | 禁止 |
| 团组管理（/groups） | 读写 | 读写 | 只读 |
| 行程资源（/locations） | 读写 | 读写 | 只读 |
| 统计（/statistics） | 只读 | 只读 | 只读 |
| 用户管理（/users） | 读写 | 禁止 | 禁止 |
| 系统设置（/settings） | 读写 | 禁止 | 禁止 |

实现位置：
- `trip-manager/frontend/src/hooks/useAuth.jsx`

## 5) 后端路由权限（概览）

以 `trip-manager/backend/server.js` 为准：

- admin-only：
  - `/api/lock/*`
  - `/api/activities/*`
  - `/api/planning/*`
  - `/api/config/*`
  - `/api/users/*`（除 `GET /api/users/me`）
- admin/editor 可写、viewer 只读：
  - `/api/groups`
  - `/api/locations`
  - `/api/itinerary-plans`
  - `/api/groups/:id/schedules`
  - `/api/groups/:id/logistics`
  - `/api/groups/:id/members`
  - `/api/resources/*`

备注：
- `/api/groups/:groupId/schedules/designer-source`、`/api/groups/:groupId/schedules/push-to-designer` 为 admin-only（写入/同步用）。

## 6) 编辑锁（写入保护）

- 许多写接口会挂 `requireEditLock`（见 `trip-manager/backend/src/middleware/editLock.js`）
- 自动获取：锁空闲时，admin/editor 会自动获取 5 分钟锁并继续写入
- 手动获取接口：`POST /api/lock/acquire` 为 admin-only（见 `trip-manager/backend/src/routes/lock.js`）

## 7) 如何重置密码（两种方式）

方式 A（推荐，走 UI）：
- 用 admin 登录 -> `/users` 用户管理页 -> 编辑用户 -> 重置密码

方式 B（走 API，仅 admin）：
- `PUT /api/users/:id`
- body 示例：
```json
{ "password": "newPassword123" }
```

## 8) 安全提示（别跳过）

- Basic Auth 凭证存 localStorage：一旦发生 XSS，会被直接窃取（详见 `docs/code-review-issues.md`）
- AI Key 可被写入 system_config 明文保存：需要按生产安全标准加固

