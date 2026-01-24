﻿﻿# 数据库结构（SQLite）

数据库文件：`trip-manager/backend/db/trip.db`
初始化脚本：`trip-manager/backend/db/init.sql`

## 表一览
### users
- id (PK)
- username (unique)
- password (bcrypt hash)
- display_name
- role: admin/viewer
- created_at, last_login

### groups
- id (PK)
- name
- type: primary/secondary
- student_count, teacher_count
- start_date, end_date, duration
- color
- itinerary_plan_id (可空)
- contact_person, contact_phone, notes
- created_at, updated_at

### locations
- id (PK)
- name, address
- capacity
- color
- contact_person, contact_phone
- blocked_weekdays (如 "3,4")
- open_hours (JSON 字符串)
- closed_dates (JSON 数组字符串)
- target_groups: primary/secondary/all
- notes
- is_active
- created_at

### activities
- id (PK)
- schedule_id (关联 schedules.id)
- group_id (FK groups)
- location_id (FK locations)
- activity_date
- time_slot: MORNING/AFTERNOON/EVENING
- participant_count
- notes
- created_at, updated_at

### schedules
- id (PK)
- group_id (FK groups)
- activity_date
- start_time, end_time
- type, title, location
- description, color
- resource_id
- is_from_resource (0/1)
- location_id
- created_at, updated_at

### itinerary_plans
- id (PK)
- name, description
- created_at, updated_at

### itinerary_plan_items
- id (PK)
- plan_id (FK itinerary_plans)
- location_id (FK locations)
- sort_order

### edit_lock
- id (固定 1)
- locked_by, locked_at, expires_at, auto_release_at

### system_config
- key (PK)
- value
- description
- updated_at

## 视图
### calendar_view
- 连接 activities、groups、locations
- 提供日期、时段、团组、地点、容量等聚合字段

## 默认数据
- users：`admin`、`viewer1`
- locations：香港科学馆、海洋公园等示例
- system_config：锁超时、自动备份等默认配置
