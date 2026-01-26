# 行程设计器 ↔ 日历详情 双向映射规则（最新）

> 适用范围：`ItineraryDesigner`（行程设计器） 与 `CalendarDaysView`（日历详情弹窗/团组日历）之间的双向同步。  
> 本文覆盖前端乐观更新 + 后端持久化同步的完整规则。

---

## 1. 数据模型与字段

### schedule（团组日历详情）
- **来源**：`/groups/:groupId/schedules`
- **字段**：
  - `id`
  - `groupId`
  - `date`（activity_date）
  - `startTime` / `endTime`
  - `resourceId`（资源来源，`plan-*` 表示方案行程点）
  - `locationId`、`title`、`description`

### activity（行程设计器）
- **来源**：`/activities/raw`
- **字段**：
  - `id`
  - `scheduleId`
  - `isPlanItem`（是否为方案行程点映射）
  - `groupId`
  - `date`（activity_date）
  - `timeSlot`（MORNING/AFTERNOON/EVENING）
  - `locationId`
  - `participantCount`

---

## 2. 时间窗口（统一口径）

> **边界按 `[start, end)` 处理**

- **MORNING**：06:00–12:00
- **AFTERNOON**：12:00–18:00
- **EVENING**：18:00–20:45

**timeSlot 取值规则**
- 计算 schedule 的时间段与三个窗口的**重叠分钟数**
- 选择重叠时间最长的窗口
- 如果没有有效重叠，按 `startTime` 兜底

---

## 3. 日历详情 → 行程设计器（schedule → activity）

### 3.1 触发点
- 前端：日历弹窗 `onUpdate(schedules)`（乐观更新）
- 后端：`POST /groups/:groupId/schedules/batch` 保存完成后

### 3.2 只同步“方案行程点”
> **只有 `resourceId` 以 `plan-` 开头的 schedule 才会映射成 activity**

- `resourceId = plan-*` ⇒ **映射到 activity**
- 其他日历活动（餐饮/交通/手动） ⇒ **不映射到行程设计器**

### 3.3 字段映射
- `schedule.id` → `activity.scheduleId`
- `schedule.groupId` → `activity.groupId`
- `schedule.locationId` → `activity.locationId`
- `schedule.date` → `activity.date`
- `timeSlot` ← 根据重叠规则计算
- `participantCount = group.student_count + group.teacher_count`
- `activity.isPlanItem = true`

### 3.4 增删更新规则
- **更新**：若存在 `activity.scheduleId == schedule.id` ⇒ 更新该 activity
- **新增**：无对应 activity ⇒ 新建
- **删除**：
  - batch 为空 ⇒ 删除该团组所有 `isPlanItem = true` 的 activity
  - batch 非空 ⇒ 删除该团组中 **不在本次 scheduleId 列表中的** `isPlanItem = true` 活动

### 3.5 临时 ID（前端乐观更新）
- 新建 schedule 可能没有真实 id
- 前端使用临时 id（或 `date+start+end+locationId+title` 的匹配键）
- 保存成功后，用服务端返回的 schedule 覆盖修正

---

## 4. 行程设计器 → 日历详情（activity → schedule）

### 4.1 触发点
- 行程设计器新增/更新/删除 activity：
  - `POST /activities`
  - `PUT /activities/:id`
  - `DELETE /activities/:id`

### 4.2 默认时间映射
- MORNING → 06:00–12:00
- AFTERNOON → 12:00–18:00
- EVENING → 18:00–20:45

### 4.3 同步规则
- activity 有 `scheduleId` ⇒ 更新对应 schedule
- activity 无 `scheduleId` ⇒ 新建 schedule，并写回 `activity.scheduleId`

### 4.4 删除规则
- 删除 activity 时，如存在 `scheduleId` ⇒ 同步删除对应 schedule

---

## 5. 后端同步控制（只同步方案行程点）

`schedules/batch` 保存后调用 `syncSchedulesToActivities`：
- 仅同步 `resource_id LIKE 'plan-%'`
- 活动写入时标记 `is_plan_item = 1`
- 非方案 schedule 不再生成 activity
- 若存在旧的非方案映射活动，会被清理

---

## 6. 重要约束

- 设计器只显示 “方案行程点” 的映射活动
- 日历中的餐饮/交通/自由活动 **不会进入行程设计器**
- `isPlanItem` 字段是前后端统一的过滤依据

---

## 7. 相关代码位置

- 前端映射：`trip-manager/frontend/src/pages/ItineraryDesigner.jsx`
- 日历详情组件：`trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.jsx`
- 后端同步：`trip-manager/backend/src/routes/schedules.js`
- 活动接口：`trip-manager/backend/src/routes/activities.js`
- DB schema：`trip-manager/backend/db/init.sql`

---

文档版本：1.0.0  
最后更新：2026-01-25
