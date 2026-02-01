# 每日卡片 <-> 日历详情 双向映射规范（v1）

> 适用范围：团组管理「每日卡片」与「日历详情」联动  
> 状态：分析规范（先不改代码）  
> 日期：2026-02-01

---

## 1. 目标

- 「每日卡片」中的关键内容能生成日历活动并入库（schedules）。
- 日历中对活动的拖动/拉伸可回写每日卡片（但卡片不展示时间）。
- 资源库分三类：行程点 / 每日卡片 / 其他（自定义模板）。
- 防止“默认时间覆盖用户手动调整”的问题。

---

## 2. 资源库分类

1) 行程点  
   - 现有行程方案的资源（plan items）。

2) 每日卡片  
   - 三餐 + 接送机/站 的映射资源。  
   - 仅当卡片有内容且日历中不存在对应活动时显示。

3) 其他（自定义）  
   - 日历中新建的自定义活动，自动生成模板并留在资源库中。  
   - 使用 hash 去重，避免重复模板堆积。

---

## 3. resource_id 约定

行程点：
```
plan-<planId>-loc-<locationId>
```

每日卡片：
```
daily:<date>:meal:breakfast
daily:<date>:meal:lunch
daily:<date>:meal:dinner
daily:<date>:pickup
daily:<date>:dropoff
```

其他（自定义模板）：
```
custom:<hash>
hash = hash(type + '|' + title + '|' + durationMinutes)
```

> durationMinutes = endTime - startTime（分钟）

---

## 4. 每日卡片字段清单

### 4.1 三餐（含隐藏时间字段）
```
meals.breakfast
meals.breakfast_place
meals.breakfast_disabled
meals.breakfast_time     // 隐藏
meals.breakfast_end      // 隐藏

meals.lunch
meals.lunch_place
meals.lunch_disabled
meals.lunch_time         // 隐藏
meals.lunch_end          // 隐藏

meals.dinner
meals.dinner_place
meals.dinner_disabled
meals.dinner_time        // 隐藏
meals.dinner_end         // 隐藏
```

### 4.2 接送机/站（允许变更时长）
```
pickup.time
pickup.end_time
pickup.location
pickup.contact
pickup.flight_no
pickup.airline
pickup.terminal

dropoff.time
dropoff.end_time
dropoff.location
dropoff.contact
dropoff.flight_no
dropoff.airline
dropoff.terminal
```

---

## 5. 默认时间（仅在无隐藏时间时使用）

- 早餐：07:30–08:30  
- 午餐：12:00–13:00  
- 晚餐：18:00–19:00  

> 若 meals.*_time 已存在，则以该时间为准，不使用默认时间。

---

## 6. 每日卡片 -> 日历活动 映射规则

### 6.1 三餐
- 有填写且非“不安排” -> 自动生成日历活动  
- 不安排 -> 完全不生成  
- 日历中已存在同 resource_id -> 仅更新文本（不覆盖时间）  

映射字段：
```
type        = 'meal'
title       = 早餐/午餐/晚餐
location    = 餐饮地址
description = 餐饮安排
resource_id = daily:<date>:meal:<type>
is_from_resource = 1
```

### 6.2 接送机/站
- 开始 + 结束时间齐全 -> 自动生成  
- 只填开始时间 -> 不生成，留在资源库  

映射字段：
```
type        = 'transport'
title       = 接站 / 送站
location    = 接送地点
description = 航班号 / 航司 / 航站楼
resource_id = daily:<date>:pickup|dropoff
is_from_resource = 1
```

---

## 7. 日历 -> 每日卡片 回写规则

当日历活动满足：
```
resource_id 以 daily: 开头
```
则：

### 7.1 三餐回写
```
meals.<meal>_time = startTime
meals.<meal>_end  = endTime
```

### 7.2 接送回写
```
pickup.time / pickup.end_time
dropoff.time / dropoff.end_time
```

> 回写仅更新数据，UI 不显示时间字段。

---

## 8. 不覆盖原则

- 日历拖动/拉伸后，不应被默认时间覆盖。  
  只有当该 resource_id 对应的活动不存在时，才会使用默认时间生成。

---

## 9. 删除与回收规则

- 日历中删除活动，但每日卡片仍有内容 -> 回到资源库（每日卡片栏目）
- 不安排 -> 删除/不生成对应活动

---

## 10. 自定义活动（其他资源）

生成规则：
```
if resource_id 为空 且 非 plan 且 非 daily:
  customKey = hash(type|title|durationMinutes)
  resource_id = custom:<customKey>
  保存为资源库模板
```

回收规则：
```
日历删除该活动后，模板仍保留
```

---

## 11. 示例

示例 A：早餐
```
日卡填写：早餐=“校内餐厅”，地址=“XX路12号”
日历活动：
  type=meal
  title=早餐
  location=XX路12号
  description=校内餐厅
  resource_id=daily:2025-09-12:meal:breakfast
  startTime=07:30 endTime=08:30
```

示例 B：接站（未填结束时间）
```
pickup.time=09:00，pickup.end_time=空
结果：不生成日历活动，资源库“每日卡片”中显示接站卡片
```

示例 C：日历拖动午餐
```
午餐被拖到 13:00-14:00
回写：
  meals.lunch_time=13:00
  meals.lunch_end=14:00
```
