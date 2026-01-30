# 用户角色权限系统记录

记录日期：2026-01-30

## 1. 目标
- 保留现有 Basic Auth 认证方式
- 基于 users.role 控制功能访问
- 前后端一致的权限规则

## 2. 角色定义
- admin：管理员，拥有全部权限
- editor：编辑者，除行程设计器外可编辑
- viewer：查看者，只读

## 3. 权限矩阵
| 功能 | admin | editor | viewer |
| --- | --- | --- | --- |
| 行程设计器 | 访问 | 禁止 | 禁止 |
| 团组管理 | 读写 | 读写 | 只读 |
| 地点管理 | 读写 | 读写 | 只读 |
| 统计报表 | 只读 | 只读 | 只读 |
| 用户管理 | 读写 | 禁止 | 禁止 |
| 系统设置 | 访问 | 禁止 | 禁止 |

## 4. 后端实现要点
- 认证方式：HTTP Basic Auth（express-basic-auth）
- 用户表：`users` 含 `role` 字段（admin / editor / viewer）
- 权限中间件：`backend/src/middleware/permission.js`
  - `requireRole()`：角色白名单
  - `requireAccess()`：区分读/写（GET 为读，其余为写）
- 编辑锁：`editLock` 允许 admin 与 editor 获取

## 5. 后端路由权限映射
- 仅 admin：
  - `/api/activities`
  - `/api/lock`
  - `/api/ai`
  - `/api/planning`
  - `/api/config`
  - `/api/users`（用户管理）
- 读写（admin/editor）、只读（viewer）：
  - `/api/groups`
  - `/api/locations`
  - `/api/itinerary-plans`
  - `/api/groups/:id/schedules`
  - `/api/groups/:id/members`
- 只读（所有角色）：
  - `/api/statistics`

## 6. 用户管理 API
- `GET /api/users`：用户列表（不返回密码）
- `POST /api/users`：创建用户
- `PUT /api/users/:id`：更新用户信息
- `DELETE /api/users/:id`：删除用户
- `GET /api/users/me`：返回当前登录用户

## 7. 前端实现要点
- 认证服务：`frontend/src/services/auth.js`
  - 登录成功后保存 Basic Auth 凭证到 `localStorage`
  - axios 请求自动附加 Authorization 头
- 权限 Hook：`frontend/src/hooks/useAuth.js`
  - `canAccess(feature, action)` 用于页面与按钮控制
- 登录页：`/login`
- 用户管理页：`/users`
- 路由保护：未登录跳转 `/login`，无权限显示 403
- 导航栏：根据角色动态显示菜单

## 8. 行为说明
- viewer 只能查看，不允许写入
- editor 可编辑团组/地点/行程相关数据，但不可进入行程设计器
- admin 全部可用

## 9. 测试建议
1. admin 登录 → 可访问全部页面
2. editor 登录 → 无法访问行程设计器 / 用户管理 / 设置
3. viewer 登录 → 只能查看，写入请求应返回 403
4. 未登录 → 跳转至 `/login`

---

如需补充“权限细化规则”或“角色扩展说明”，可在本文追加更新。
