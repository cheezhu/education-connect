# 配置、认证与编辑锁

## 环境变量（后端）
- PORT
- AI_api_key
- AI_PROVIDER
- AI_MODEL
- AI_TIMEOUT_MS

示例：`trip-manager/backend/.env.example`

## 环境变量（前端）
通过 Vite 注入（需 `VITE_` 前缀）：
- `VITE_API_BASIC_AUTH`：`user:pass` 或 Base64 字符串
- `VITE_API_USER` / `VITE_API_PASSWORD`：单独指定用户名与密码

优先级：`VITE_API_BASIC_AUTH` > `VITE_API_USER/PASSWORD` > 默认 `admin/admin123`

## 系统配置（system_config 表）
- itinerary_week_start（行程设计器周起始日期）
- itinerary_time_slots（显示时间段）
- itinerary_daily_focus（每日关注开关）
- itinerary_group_row_align（团组行对齐开关）
- ai_schedule_rules（AI 规则）
- ai_itinerary_history（AI 历史记录）
- ai_provider / ai_model / ai_timeout_ms / ai_api_key（AI 运行配置，优先于环境变量）
- 其他默认项：lock_timeout/auto_backup/backup_time/max_groups

## 认证
- HTTP Basic Auth
- 用户来自 `users` 表
- bcrypt 校验密码

## 编辑锁
- 保护写入类接口（团组/地点/活动/日程/方案）
- 管理员可自动获取锁（5 分钟）
- 锁状态接口：`/api/lock/*`
