# Education Connect 数据库设计

## 概述

- **数据库类型**: SQLite
- **数据库文件**: `trip-manager/backend/db/trip.db`
- **ORM库**: better-sqlite3
- **外键约束**: 启用 (`PRAGMA foreign_keys = ON`)

---

## ER 图

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│   users     │       │    groups       │       │  locations  │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id          │◄──────│ id              │──────►│ id          │
│ username    │       │ name            │       │ name        │
│ password    │       │ type            │       │ capacity    │
│ display_name│       │ student_count   │       │ open_hours  │
│ role        │       │ teacher_count   │       │ closed_dates│
│ created_at  │       │ start_date      │       │ ...         │
└─────────────┘       │ end_date        │       └─────────────┘
                      │ itinerary_plan_id│
                      └────────┬────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
      ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
      │  activities │  │  schedules  │  │ itinerary_plans │
      ├─────────────┤  ├─────────────┤  ├─────────────────┤
      │ id          │  │ id          │  │ id              │
      │ group_id    │◄─│ group_id    │  │ name            │
      │ location_id │◄──│ location_id │  │ description     │
      │ activity_date│  │ activity_date│ └─────────────────┘
      │ time_slot   │  │ start_time  │          │
      │ schedule_id │◄──│ end_time    │          ▼
      └─────────────┘  │ type        │  ┌─────────────────┐
                       │ title       │  │itinerary_plan_  │
                       └─────────────┘  │    items        │
                                        ├─────────────────┤
                                        │ id              │
                                        │ plan_id         │◄──┐
                                        │ location_id     │◄──┤
                                        │ sort_order      │   │
                                        └─────────────────┘   │
                                                               │
                      ┌─────────────────────────┐             │
                      │       edit_lock         │             │
                      ├─────────────────────────┤             │
                      │ id (PK, 固定=1)         │             │
                      │ locked_by               │             │
                      │ locked_at               │             │
                      │ expires_at              │             │
                      └─────────────────────────┘             │

                      ┌─────────────────────────┐             │
                      │     system_config       │             │
                      ├─────────────────────────┤             │
                      │ key (PK)                │             │
                      │ value                   │             │
                      │ description             │             │
                      └─────────────────────────┘             │
```

---

## 数据表详解

### 1. users - 用户表

存储系统用户账号和认证信息。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 用户ID |
| username | VARCHAR(50) | UNIQUE, NOT NULL | - | 用户名 |
| password | VARCHAR(255) | NOT NULL | - |  bcrypt加密密码 |
| display_name | VARCHAR(100) | - | - | 显示名称 |
| role | VARCHAR(20) | CHECK | 'viewer' | 角色: admin / viewer |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 创建时间 |
| last_login | DATETIME | - | - | 最后登录时间 |

**默认用户**:
- `admin` / `admin123` (管理员)
- `viewer1` / `admin123` (查看用户)

---

### 2. groups - 团组表

存储研学团组的基本信息。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 团组ID |
| name | VARCHAR(200) | NOT NULL | - | 团组名称 |
| type | VARCHAR(20) | NOT NULL, CHECK | - | 类型: primary / secondary |
| student_count | INTEGER | - | 40 | 学生人数 |
| teacher_count | INTEGER | - | 4 | 老师人数 |
| start_date | DATE | NOT NULL | - | 开始日期 |
| end_date | DATE | NOT NULL | - | 结束日期 |
| duration | INTEGER | CHECK | 5 | 行程天数 |
| color | VARCHAR(7) | - | '#1890ff' | 日历显示颜色 |
| itinerary_plan_id | INTEGER | REFERENCES itinerary_plans(id) | - | 绑定的行程方案 |
| contact_person | VARCHAR(100) | - | - | 联系人 |
| contact_phone | VARCHAR(20) | - | - | 联系电话 |
| notes | TEXT | - | - | 备注 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | - | CURRENT_TIMESTAMP | 更新时间 |

**约束**:
- `duration` 必须大于 0
- `type` 只能是 'primary' (小学) 或 'secondary' (中学)

---

### 3. locations - 参访地点表

存储可参访的地点资源信息。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 地点ID |
| name | VARCHAR(200) | NOT NULL | - | 地点名称 |
| address | VARCHAR(500) | - | - | 地址 |
| capacity | INTEGER | - | 100 | 最大容量 |
| color | VARCHAR(20) | - | '#1890ff' | 展示颜色 |
| contact_person | VARCHAR(100) | - | - | 联系人 |
| contact_phone | VARCHAR(20) | - | - | 联系电话 |
| blocked_weekdays | VARCHAR(20) | - | - | 不可用星期，如 "3,4" |
| open_hours | TEXT | - | - | JSON: 开放时段配置 |
| closed_dates | TEXT | - | - | JSON: 禁用日期列表 |
| target_groups | VARCHAR(20) | - | 'all' | 适用团组: primary/secondary/all |
| notes | TEXT | - | - | 备注 |
| is_active | BOOLEAN | - | 1 | 是否启用 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 创建时间 |

**open_hours 格式示例**:
```json
{
  "default": [{"start": 9, "end": 17}],
  "3": [{"start": 9, "end": 12}, {"start": 14, "end": 17}]
}
```

**closed_dates 格式示例**:
```json
["2025-01-01", "2025-05-01"]
```

**blocked_weekdays 说明**:
- 逗号分隔的星期数字 (0=周日, 1=周一, ..., 6=周六)
- 例如: "3,4" 表示周三和周四不可用

---

### 4. activities - 活动安排表

存储团组的活动安排（按时间段）。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 活动ID |
| schedule_id | INTEGER | REFERENCES schedules(id) | - | 关联的日程详情ID |
| group_id | INTEGER | NOT NULL, REFERENCES groups(id) | - | 团组ID |
| location_id | INTEGER | REFERENCES locations(id) | - | 地点ID |
| activity_date | DATE | NOT NULL | - | 活动日期 |
| time_slot | VARCHAR(10) | NOT NULL, CHECK | - | 时段: MORNING/AFTERNOON/EVENING |
| participant_count | INTEGER | - | - | 参与人数 |
| notes | TEXT | - | - | 备注 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | - | CURRENT_TIMESTAMP | 更新时间 |

**约束**:
- `time_slot` 只能是 'MORNING'(上午)、'AFTERNOON'(下午)、'EVENING'(晚上)

**时间段定义**:
| 时段 | 开始时间 | 结束时间 |
|------|----------|----------|
| MORNING | 09:00 | 12:00 |
| AFTERNOON | 14:00 | 17:00 |
| EVENING | 19:00 | 21:00 |

---

### 5. schedules - 日程详情表

存储团组每日行程的详细安排（V2增强功能）。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 日程ID |
| group_id | INTEGER | NOT NULL, REFERENCES groups(id) | - | 团组ID |
| activity_date | DATE | NOT NULL | - | 活动日期 |
| start_time | TEXT | NOT NULL | - | 开始时间 (HH:mm) |
| end_time | TEXT | NOT NULL | - | 结束时间 (HH:mm) |
| type | VARCHAR(20) | NOT NULL | - | 类型: visit/transport/meal/custom... |
| title | VARCHAR(200) | - | - | 标题 |
| location | VARCHAR(200) | - | - | 地点名称 |
| description | TEXT | - | - | 描述 |
| color | VARCHAR(20) | - | - | 显示颜色 |
| resource_id | VARCHAR(100) | - | - | 资源ID |
| is_from_resource | BOOLEAN | - | 0 | 是否来自资源库 |
| location_id | INTEGER | REFERENCES locations(id) | - | 关联地点ID |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | - | CURRENT_TIMESTAMP | 更新时间 |

**索引**:
- `idx_schedules_group_date` ON (group_id, activity_date)

---

### 6. itinerary_plans - 行程方案表

存储可复用的行程方案模板。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 方案ID |
| name | VARCHAR(200) | NOT NULL | - | 方案名称 |
| description | TEXT | - | - | 方案描述 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | - | CURRENT_TIMESTAMP | 更新时间 |

### 6.1 itinerary_plan_items - 行程方案地点项表

存储方案中的地点组合和排序。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 项ID |
| plan_id | INTEGER | NOT NULL, REFERENCES itinerary_plans(id) | - | 所属方案ID |
| location_id | INTEGER | NOT NULL, REFERENCES locations(id) | - | 地点ID |
| sort_order | INTEGER | NOT NULL | 0 | 排序顺序 |

**索引**:
- `idx_itinerary_plan_items_plan` ON (plan_id)
- `idx_itinerary_plan_items_location` ON (location_id)

---

### 7. edit_lock - 编辑锁表

控制同一时间的编辑权限，防止冲突。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | INTEGER | PRIMARY KEY CHECK (id=1) | - | 单行锁 |
| locked_by | VARCHAR(50) | - | - | 锁定用户 |
| locked_at | DATETIME | - | - | 锁定时间 |
| expires_at | DATETIME | - | - | 过期时间 |
| auto_release_at | DATETIME | - | - | 自动释放时间 |

**说明**: 此表只有一行记录，用于实现编辑锁机制。

---

### 8. system_config - 系统配置表

存储系统级配置项。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| key | VARCHAR(50) | PRIMARY KEY | - | 配置键 |
| value | TEXT | - | - | 配置值 |
| description | TEXT | - | - | 配置说明 |
| updated_at | DATETIME | - | CURRENT_TIMESTAMP | 更新时间 |

**默认配置**:
| key | value | description |
|-----|-------|-------------|
| lock_timeout | 300 | 编辑锁超时时间（秒） |
| auto_backup | true | 是否自动备份 |
| backup_time | 02:00 | 自动备份时间 |
| max_groups | 100 | 最大团组数量 |
| itinerary_group_row_align | true | 行程设计器团组行对齐 |

---

## 视图

### calendar_view - 日历视图

整合团组、活动的日历展示视图。

```sql
CREATE VIEW calendar_view AS
SELECT
    a.id,
    a.activity_date,
    a.time_slot,
    a.participant_count,
    g.id as group_id,
    g.name as group_name,
    g.type as group_type,
    g.color as group_color,
    l.id as location_id,
    COALESCE(l.name, '') as location_name,
    COALESCE(l.capacity, 0) as location_capacity
FROM activities a
JOIN groups g ON a.group_id = g.id
LEFT JOIN locations l ON a.location_id = l.id
ORDER BY a.activity_date, a.time_slot;
```

---

## 索引汇总

| 索引名 | 表 | 字段 |
|--------|-----|------|
| idx_activities_date | activities | activity_date |
| idx_activities_group | activities | group_id |
| idx_activities_location | activities | location_id |
| idx_activities_schedule | activities | schedule_id |
| idx_schedules_group_date | schedules | group_id, activity_date |
| idx_groups_date_range | groups | start_date, end_date |
| idx_groups_itinerary_plan | groups | itinerary_plan_id |
| idx_itinerary_plan_items_plan | itinerary_plan_items | plan_id |
| idx_itinerary_plan_items_location | itinerary_plan_items | location_id |

---

## 数据关系

### 级联规则

| 父表 | 子表 | 级联操作 |
|------|------|----------|
| groups | activities | ON DELETE CASCADE |
| groups | schedules | ON DELETE CASCADE |
| itinerary_plans | itinerary_plan_items | ON DELETE CASCADE |

### 冲突检测规则

1. **容量冲突**: 同一地点同时段参与人数 > 容量
2. **星期限制**: 地点 `blocked_weekdays` 包含当前星期
3. **团组类型限制**: 地点 `target_groups` 不匹配团组类型

---

## API 端点

| 资源 | 端点 | 方法 | 说明 |
|------|------|------|------|
| 团组 | /api/groups | GET | 获取所有团组 |
| 团组 | /api/groups/:id | GET | 获取单个团组 |
| 团组 | /api/groups | POST | 创建团组 |
| 团组 | /api/groups/:id | PUT | 更新团组 |
| 团组 | /api/groups/:id | DELETE | 删除团组 |
| 地点 | /api/locations | GET | 获取所有地点 |
| 地点 | /api/locations/:id | GET | 获取单个地点 |
| 地点 | /api/locations | POST | 创建地点 |
| 地点 | /api/locations/:id | PUT | 更新地点 |
| 地点 | /api/locations/:id | DELETE | 删除/禁用地点 |
| 活动 | /api/activities | GET | 获取活动列表 |
| 活动 | /api/activities/raw | GET | 获取原始活动数据 |
| 活动 | /api/activities | POST | 创建活动 |
| 活动 | /api/activities/:id | PUT | 更新活动 |
| 活动 | /api/activities/:id | DELETE | 删除活动 |
| 日程 | /api/schedules | GET | 获取所有日程 |
| 日程 | /api/groups/:groupId/schedules | GET | 获取团组日程 |
| 日程 | /api/groups/:groupId/schedules/batch | POST | 批量保存日程 |
| 方案 | /api/itinerary-plans | GET | 获取方案列表 |
| 方案 | /api/itinerary-plans/:id | GET | 获取方案详情 |
| 方案 | /api/itinerary-plans | POST | 创建方案 |
| 方案 | /api/itinerary-plans/:id | PUT | 更新方案 |
| 方案 | /api/itinerary-plans/:id | DELETE | 删除方案 |
| 统计 | /api/statistics | GET | 获取统计数据 |
| 统计 | /api/statistics/export | GET | 导出数据 |
| 锁 | /api/lock/status | GET | 获取编辑锁状态 |
| 锁 | /api/lock/acquire | POST | 获取编辑锁 |
| 锁 | /api/lock/release | POST | 释放编辑锁 |
| 锁 | /api/lock/renew | POST | 续期编辑锁 |
| AI | /api/ai/plan/global | POST | AI全局排期 |
| 配置 | /api/config | GET | 获取系统配置 |

---

## 初始化数据

### 默认用户

| username | password | display_name | role |
|----------|----------|--------------|------|
| admin | admin123 | 系统管理员 | admin |
| viewer1 | admin123 | 查看用户1 | viewer |

### 默认地点

| name | capacity | blocked_weekdays | target_groups | address |
|------|----------|------------------|---------------|---------|
| 香港科学馆 | 200 | 4 | all | 尖沙咀科学馆道2号 |
| 香港警队博物馆 | 100 |  | primary | 山顶甘道27号 |
| 诺亚方舟 | 150 | 3 | all | 新界马湾珀欣路33号 |
| 香港海洋公园 | 500 |  | all | 香港仔黄竹坑道180号 |
| 西九文化区 | 300 |  | all | 西九龙文化区 |
| 香港太空馆 | 100 |  | all | 尖沙咀梳士巴利道10号 |
| 香港大学 | 150 |  | all | 薄扶林道 |
| 驻港部队展览中心 | 100 |  | secondary | 中环军营 |

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2025-01 | 初始版本，支持 V1 功能 |
| 2.0 | 2025-01 | 添加 schedules、itinerary_plans 表，支持 V2 功能 |

---

*文档生成时间: 2025-01-24*
*项目: Education Connect 研学行程管理系统*
