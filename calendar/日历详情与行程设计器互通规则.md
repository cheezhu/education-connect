## 日历详情与行程设计器互通规则

### 1) 数据模型与绑定

- **schedule**: 详细日程，精确到日期与开始/结束时间（date + startTime/endTime）。
- **activity**: 行程设计器活动，按时间段（MORNING/AFTERNOON/EVENING）。
- **绑定键**: `activities.schedule_id` 关联对应的 schedule，用于避免重复生成与互相覆盖。

### 2) schedule -> activity (日历详情同步到行程设计器)

- **触发点**: 日历详情保存（batch 保存 schedules）。
- **时间段映射**: 按 schedule.startTime 映射为 timeSlot。
  - 06:00-11:59 -> MORNING
  - 12:00-17:59 -> AFTERNOON
  - 18:00-23:59 -> EVENING
- **字段映射**:
  - schedule.id -> activity.schedule_id
  - schedule.group_id -> activity.group_id
  - schedule.location_id -> activity.location_id
  - schedule.activity_date -> activity.activity_date
  - timeSlot 由 startTime 推导
  - participantCount = group.student_count + group.teacher_count
- **增改逻辑**:
  - 若存在 activity.schedule_id = schedule.id -> 更新该 activity
  - 若不存在 -> 新建 activity
- **删除逻辑**:
  - 若 schedule 被删除，则删除关联的 activity

### 3) activity -> schedule (行程设计器同步到日历详情)

- **触发点**: 行程设计器创建/更新/删除 activity。
- **默认时间段**:
  - MORNING -> 09:00-11:30
  - AFTERNOON -> 14:00-17:00
  - EVENING -> 19:00-21:00
- **冲突处理**:
  - 若当日已有 schedule，则把新日程放到**当日最后一个活动之后**
  - 新日程时长固定为 **1 小时**
  - 允许超过当天结束时间（不自动换天）
- **字段映射**:
  - activity.schedule_id -> schedule.id (若已存在则更新)
  - activity.group_id -> schedule.group_id
  - activity.activity_date -> schedule.activity_date
  - timeSlot -> 默认起止时间（如发生冲突则用追加规则）
  - activity.location_id -> schedule.location_id
  - title 优先地点名，兜底为团组名或 "行程活动"
  - location 使用地点名
  - type 默认 "visit"
  - color 默认团组色
- **删除逻辑**:
  - 删除 activity 时，删除关联 schedule（若有 schedule_id）

### 4) 额外说明

- schedule 与 activity 的关系为 1:1（通过 schedule_id 绑定），但允许同一团组同一时间段存在多个 activity。
- 若 schedule.location_id 为空，activity 仍会创建，但地点为空，后续可在行程设计器补充。