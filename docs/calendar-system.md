# 日历系统完整设计文档

> 适用范围：行程设计器、日历详情、每日卡片 三大模块的数据同步与映射规则
> 状态：与代码对齐
> 日期：2026-02-01

---

## 1. 概述

本文档定义以下三个模块之间的数据映射与同步规则：

| 模块 | 说明 |
|------|------|
| **行程设计器** | ItineraryDesigner，按时间段（MORNING/AFTERNOON/EVENING）管理 |
| **日历详情** | CalendarDaysView，精确到时间的日程管理 |
| **每日卡片** | 团组管理中的三餐、接送机/站等固定内容 |

---

## 2. 数据模型

### 2.1 schedule（日历详情）

- **来源**：`GET /groups/:groupId/schedules`
- **字段**：
  - `id`
  - `groupId`
  - `date`（activity_date）
  - `startTime` / `endTime`
  - `type`（meal/visit/transport/rest/activity/free）
  - `title`
  - `location`
  - `description`
  - `resourceId`（资源来源标识）
  - `locationId`
  - `color`

### 2.2 activity（行程设计器）

- **来源**：`GET /activities/raw`
- **字段**：
  - `id`
  - `scheduleId`
  - `isPlanItem`（是否为方案行程点映射）
  - `groupId`
  - `date`（activity_date）
  - `timeSlot`（MORNING/AFTERNOON/EVENING）
  - `locationId`
  - `participantCount`

### 2.3 每日卡片字段

#### 三餐（含隐藏时间字段）
```
meals.breakfast / meals.breakfast_place / meals.breakfast_disabled
meals.breakfast_time     // 隐藏，用于存储日历时间
meals.breakfast_end      // 隐藏

meals.lunch / meals.lunch_place / meals.lunch_disabled
meals.lunch_time         // 隐藏
meals.lunch_end          // 隐藏

meals.dinner / meals.dinner_place / meals.dinner_disabled
meals.dinner_time        // 隐藏
meals.dinner_end         // 隐藏
```

#### 接送机/站
```
pickup.time / pickup.end_time / pickup.location
pickup.contact / pickup.flight_no / pickup.airline / pickup.terminal

dropoff.time / dropoff.end_time / dropoff.location
dropoff.contact / dropoff.flight_no / dropoff.airline / dropoff.terminal
```

---

## 3. 时间窗口（统一口径）

> 边界按 `[start, end)` 处理

| timeSlot | 时间范围 |
|----------|----------|
| MORNING | 06:00–12:00 |
| AFTERNOON | 12:00–18:00 |
| EVENING | 18:00–20:45 |

**timeSlot 取值规则**（schedule → activity）：
- 计算 schedule 的时间段与三个窗口的**重叠分钟数**
- 选择重叠时间最长的窗口
- 如果没有有效重叠，按 `startTime` 兜底推导

---

## 4. 资源库分类与 resource_id 约定

资源分为三类，区分来源与同步逻辑：

### 4.1 行程点（plan-*）

```
resource_id = plan-<planId>-loc-<locationId>
```

- 来源：行程方案（itinerary plan items）
- 同步：双向同步到行程设计器

### 4.2 每日卡片（daily:*）

```
daily:<date>:meal:breakfast
daily:<date>:meal:lunch
daily:<date>:meal:dinner
daily:<date>:pickup
daily:<date>:dropoff
```

- 来源：每日卡片的三餐、接送机/站
- 同步：每日卡片 ↔ 日历详情

### 4.3 自定义模板（custom:*）

```
resource_id = custom:<hash>
hash = hash(type + '|' + title + '|' + durationMinutes)
```

- 来源：日历中新建的自定义活动
- 同步：仅日历内使用，回写时不覆盖

---

## 5. 同步规则

### 5.1 每日卡片 ↔ 日历详情

#### 5.1.1 每日卡片 → 日历

**三餐映射**：
- 有填写且非"不安排" → 自动生成日历活动
- 不安排 → 完全不生成
- 日历中已存在同 resource_id → 仅更新文本（不覆盖时间）

映射字段：
```
type        = 'meal'
title       = 早餐/午餐/晚餐
location    = 餐饮地址
description = 餐饮安排
resource_id = daily:<date>:meal:<type>
is_from_resource = 1
startTime/endTime = 使用隐藏字段，若无则用默认时间
```

**默认时间**（仅在无隐藏时间时使用）：
- 早餐：07:30–08:30
- 午餐：12:00–13:00
- 晚餐：18:00–19:00

**接送机/站映射**：
- 开始 + 结束时间齐全 → 自动生成
- 只填开始时间 → 不生成，留在资源库

映射字段：
```
type        = 'transport'
title       = 接站 / 送站
location    = 接送地点
description = 航班号 / 航司 / 航站楼
resource_id = daily:<date>:pickup|dropoff
is_from_resource = 1
```

#### 5.1.2 日历 → 每日卡片（回写）

当日历活动的 `resource_id` 以 `daily:` 开头时，回写数据：

**三餐回写**：
```
meals.<meal>_time = startTime
meals.<meal>_end  = endTime
```

**接送回写**：
```
pickup.time / pickup.end_time
dropoff.time / dropoff.end_time
```

> 回写仅更新数据，UI 不显示时间字段。

#### 5.1.3 不覆盖原则

- 日历拖动/拉伸后，不应被默认时间覆盖
- 只有当该 resource_id 对应的活动不存在时，才会使用默认时间生成

#### 5.1.4 删除与回收

- 日历中删除活动，但每日卡片仍有内容 → 回到资源库（每日卡片栏目）
- 不安排 → 删除/不生成对应活动

---

### 5.2 行程设计器 ↔ 日历详情

#### 5.2.1 日历详情 → 行程设计器（schedule → activity）

**触发点**：
- 前端：日历弹窗 `onUpdate(schedules)`（乐观更新）
- 后端：`POST /groups/:groupId/schedules/batch` 保存完成后

**只同步"方案行程点"**：
- `resourceId = plan-*` → 映射到 activity
- 其他日历活动（餐饮/交通/手动） → 不映射到行程设计器

**字段映射**：
```
schedule.id          → activity.scheduleId
schedule.groupId     → activity.groupId
schedule.locationId  → activity.locationId
schedule.date        → activity.date
timeSlot             ← 根据重叠规则计算
participantCount     = group.student_count + group.teacher_count
activity.isPlanItem  = true
```

**增删更新规则**：
- 更新：若存在 `activity.scheduleId == schedule.id` ⇒ 更新该 activity
- 新增：无对应 activity ⇒ 新建
- 删除：
  - batch 为空 ⇒ 删除该团组所有 `isPlanItem = true` 的 activity
  - batch 非空 ⇒ 删除该团组中不在本次 scheduleId 列表中的 `isPlanItem = true` 活动

**临时 ID（前端乐观更新）**：
- 新建 schedule 可能没有真实 id
- 前端使用临时 id（或 `date+start+end+locationId+title` 的匹配键）
- 保存成功后，用服务端返回的 schedule 覆盖修正

#### 5.2.2 行程设计器 → 日历详情（activity → schedule）

**触发点**：
- 行程设计器新增/更新/删除 activity：
  - `POST /activities`
  - `PUT /activities/:id`
  - `DELETE /activities/:id`

**默认时间映射**：
- MORNING → 06:00–12:00
- AFTERNOON → 12:00–18:00
- EVENING → 18:00–20:45

**同步规则**：
- activity 有 `scheduleId` ⇒ 更新对应 schedule
- activity 无 `scheduleId` ⇒ 新建 schedule，并写回 `activity.scheduleId`

**删除规则**：
- 删除 activity 时，如存在 `scheduleId` ⇒ 同步删除对应 schedule

#### 5.2.3 冲突处理/排位规则（activity → schedule）

- 优先将新日程放入对应 `timeSlot` 窗口内的**最早可用空档**
- 若窗口内无空档，则放在**窗口结束时间之后**（仍在当日内）
- 新日程时长固定为 **1 小时**
- 允许超过当天结束时间（不自动换天）

**重定位条件**：
- 新建 activity 时一定重新计算起止时间
- 更新 activity 时，仅当 `date/timeSlot` 变更或缺少 `scheduleId` 才重新计算

#### 5.2.4 字段映射与保留

```
activity.date        → schedule.date
activity.locationId  → schedule.location_id
title               优先已有 title，否则地点名，兜底团组名或"行程活动"
location            使用地点名；若无地点则保留已有 location
type                默认 "visit"（已有类型优先）
color               默认团组色（已有颜色优先，缺省 #1890ff）
description/resource_id/is_from_resource 保留已有值
```

---

## 6. CalendarDaysView 组件技术实现

**组件路径**：`trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.jsx`

### 6.1 核心功能

- **网格布局**：CSS Grid 创建时间槽网格（06:00-20:45，每 15 分钟一格）
- **按团组日期范围**：日期列由 `groupData.start_date ~ end_date` 动态生成
- **拖拽系统**：支持活动拖拽、资源卡片拖拽、双向拖拽
- **资源管理**：行程方案资源 + 可重复活动（餐饮/交通/休息等）

### 6.2 关键状态

```javascript
const [activities, setActivities] = useState(schedules);
const [selectedPlanId, setSelectedPlanId] = useState(groupData?.itinerary_plan_id ?? null);
const [planResources, setPlanResources] = useState([]);
const [availablePlanResources, setAvailablePlanResources] = useState([]);
const [draggedActivity, setDraggedActivity] = useState(null);
const [draggedResource, setDraggedResource] = useState(null);
const [dropIndicator, setDropIndicator] = useState(null);
```

### 6.3 时间槽配置

```javascript
const START_HOUR = 6;
const END_HOUR = 20;
const SLOT_MINUTES = 15;
const HEADER_HEIGHT = 30;
const SLOT_HEIGHT = 10;
```

### 6.4 坐标系统

```
CSS Grid 布局：
- 列：第1列为时间列，第2..(N+1)列为日期列（N = 日期数）
- 行：第1行为头部，后续为时间槽（06:00-20:45，15分钟/格）

Grid定位公式：
gridColumn = dayIndex + 2    // 日期列索引
gridRow    = timeSlotIndex + 2  // 时间行索引
```

### 6.5 拖拽处理

```javascript
// 拖拽开始
handleDragStart(event, activity) {
  const offsetY = event.clientY - rect.top;
  dragOffsetRef.current = { x: offsetX, y: offsetY };
}

// 拖拽放置
handleDrop(event, targetDate, targetTime) {
  const targetSlotIndex = Math.round(adjustedY / slotHeight);
  // 更新活动时间...
}
```

### 6.6 资源卡片系统

**可重复活动预设**：
```javascript
const presetResourcesData = [
  { id: 'meal', type: 'meal', title: '早餐', isUnique: false },
  { id: 'lunch', type: 'meal', title: '午餐', isUnique: false },
  { id: 'dinner', type: 'meal', title: '晚餐', isUnique: false },
  { id: 'transport', type: 'transport', title: '大巴交通', isUnique: false },
  { id: 'rest', type: 'rest', title: '休息', isUnique: false },
  { id: 'free', type: 'free', title: '自由活动', isUnique: false }
];
```

### 6.7 活动类型颜色

```javascript
const activityTypes = {
  meal: { color: '#52c41a' },      // 绿色 - 餐饮
  visit: { color: '#1890ff' },     // 蓝色 - 参观
  transport: { color: '#fa8c16' }, // 橙色 - 交通
  rest: { color: '#8c8c8c' },      // 灰色 - 休息
  activity: { color: '#722ed1' },  // 紫色 - 活动
  free: { color: '#13c2c2' }       // 青色 - 自由活动
};
```

### 6.8 保存机制

- 由父组件批量提交 `POST /groups/:groupId/schedules/batch`
- 内部 `saveStatus` 仅作 UI 提示
- 500ms 防抖提交

---

## 7. 相关代码位置

| 功能 | 文件路径 |
|------|----------|
| 日历详情组件 | `trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.jsx` |
| 行程设计器 | `trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx` |
| 后端 schedule 路由 | `trip-manager/backend/src/routes/schedules.js` |
| 后端 activity 路由 | `trip-manager/backend/src/routes/activities.js` |
| 数据库初始化 | `trip-manager/backend/db/init.sql` |

---

## 8. 示例

### 示例 A：早餐从每日卡片同步到日历

```
日卡填写：早餐="校内餐厅"，地址="XX路12号"

日历活动：
  type=meal
  title=早餐
  location=XX路12号
  description=校内餐厅
  resource_id=daily:2025-09-12:meal:breakfast
  startTime=07:30 endTime=08:30
```

### 示例 B：接站（未填结束时间）

```
pickup.time=09:00，pickup.end_time=空
结果：不生成日历活动，资源库"每日卡片"中显示接站卡片
```

### 示例 C：日历拖动午餐回写每日卡片

```
午餐被拖到 13:00-14:00
回写：
  meals.lunch_time=13:00
  meals.lunch_end=14:00
```

### 示例 D：行程方案点同步

```
行程方案有：科学馆（locationId=1）

日历添加科学馆活动：
  resourceId=plan-5-loc-1（planId=5, locationId=1）

行程设计器自动生成 activity：
  isPlanItem=true
  scheduleId=<对应schedule的id>
  timeSlot=AFTERNOON（假设12:00-18:00）
```

---

## 9. 常见问题

### Q1：为什么餐饮活动没有同步到行程设计器？

A：只有 `resourceId` 以 `plan-` 开头的 schedule 才会映射到行程设计器。餐饮使用 `daily:*` 前缀，属于每日卡片模块，不进入行程设计器。

### Q2：拖拽活动时间后被默认时间覆盖？

A：检查隐藏时间字段是否正确回写。每日卡片模块会回写 `meals.*_time` 字段，日历详情应该读取这些字段而非使用默认值。

### Q3：如何区分三类资源？

A：看 `resourceId` 前缀：
- `plan-*` → 行程方案点
- `daily:*` → 每日卡片
- `custom:*` → 自定义模板

### Q4：schedule 和 activity 是什么关系？

A：1:1 关系，通过 `scheduleId` 绑定。同一团组同一时间段允许多个 activity，但只有方案行程点会双向同步。

---

文档版本：2.0.0
最后更新：2026-02-01
作者：Education Connect 开发团队
