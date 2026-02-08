# 配置、认证与编辑锁

## 环境变量（后端）

示例：`trip-manager/backend/.env.example`

- `PORT`
- `AI_API_KEY`：AI API Key（推荐）；兼容旧名 `AI_api_key`
- `AI_PROVIDER`：`openai` / `gemini`（默认 `openai`）
- `AI_MODEL`：默认 `gpt-4.1` 或 `gemini-1.5-pro-latest`
- `AI_TIMEOUT_MS`：默认 `25000`

说明：
- AI 配置目前主要用于“跨团组排程”规则读取与未来扩展；系统当前没有挂载 `/api/ai/*` 业务路由。

## 环境变量（前端，可选）

通过 Vite 注入（需 `VITE_` 前缀）：
- `VITE_API_BASIC_AUTH`：`user:pass` 或 Base64 字符串（不含 `Basic ` 前缀也可）
- `VITE_API_USER` / `VITE_API_PASSWORD`：单独指定用户名与密码

优先级（以 `trip-manager/frontend/src/services/auth.js` 为准）：
1. localStorage：`ec_basic_auth`
2. `VITE_API_BASIC_AUTH`
3. `VITE_API_USER` + `VITE_API_PASSWORD`
4. 都没有则为“未登录状态”，需要走 `/login` 登录

## 系统配置（system_config 表）

行程设计器：
- `itinerary_week_start`（周起始日期）
- `itinerary_time_slots`（显示时段）
- `itinerary_daily_focus`（每日关注开关）
- `itinerary_group_row_align`（团组行对齐开关）

排程/AI（用于 planning 导出/导入的规则与配置）：
- `ai_schedule_rules`（timeSlots、slotWindows、maxItemsPerGroup 等）
- `ai_provider` / `ai_model` / `ai_timeout_ms` / `ai_api_key`（若存在则优先生效）

其他默认项：
- `lock_timeout` / `auto_backup` / `backup_time` / `max_groups`

## 认证

- 认证方式：HTTP Basic Auth
- 用户来自 `users` 表（bcrypt 校验密码）
- 登录页：`/login`
  - 前端调用 `GET /api/users/me` 校验凭证
  - 校验成功后把 `Authorization`（Basic xxx）保存到 localStorage（key=`ec_basic_auth`）

## 编辑锁

- 目的：保护写入类接口（团组/地点/活动/日程/资源/食行卡片等）
- 数据表：`edit_lock`（固定单行 id=1）
- 写接口通常会挂 `requireEditLock`

自动获取规则（以 `trip-manager/backend/src/middleware/editLock.js` 为准）：
- 锁空闲时：`admin` / `editor` 会自动获取 5 分钟锁并继续写入
- 锁被占用时：非持有者写入会返回 403

手动锁接口（admin-only）：
- `GET /api/lock/status`
- `POST /api/lock/acquire`
- `POST /api/lock/release`
- `POST /api/lock/renew`
