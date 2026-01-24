# 示例请求与响应（示意）

> 以下示例基于当前后端结构，用于帮助模型理解字段语义，非严格校验样例。

## 创建团组（POST /api/groups）
```json
{
  "name": "深圳实验学校小学部",
  "type": "primary",
  "student_count": 44,
  "teacher_count": 4,
  "start_date": "2025-09-12",
  "end_date": "2025-09-16",
  "color": "#1890ff",
  "contact_person": "张老师",
  "contact_phone": "13800138000",
  "notes": "示例备注",
  "itinerary_plan_id": null
}
```

## 更新团组（PUT /api/groups/:id）
```json
{
  "student_count": 46,
  "teacher_count": 5,
  "contact_person": "李老师"
}
```

## 创建地点（POST /api/locations）
```json
{
  "name": "香港科学馆",
  "address": "尖沙咀科学馆道2号",
  "capacity": 200,
  "blockedWeekdays": "4",
  "targetGroups": "all",
  "contactPerson": "接待负责人",
  "contactPhone": "12345678",
  "notes": "周四不可用"
}
```

## 创建活动（POST /api/activities）
```json
{
  "groupId": 1,
  "locationId": 3,
  "date": "2025-09-12",
  "timeSlot": "MORNING",
  "participantCount": 48
}
```
返回（raw 结构）：
```json
{
  "id": 10,
  "groupId": 1,
  "locationId": 3,
  "date": "2025-09-12",
  "timeSlot": "MORNING",
  "participantCount": 48,
  "scheduleId": 120
}
```

## 批量保存日程（POST /api/groups/:groupId/schedules/batch）
```json
{
  "scheduleList": [
    {
      "id": null,
      "date": "2025-09-12",
      "startTime": "09:00",
      "endTime": "11:30",
      "type": "visit",
      "title": "香港科学馆",
      "location": "香港科学馆",
      "description": "上午参观",
      "color": "#1890ff",
      "resourceId": "plan-1-loc-3",
      "isFromResource": true,
      "locationId": 3
    }
  ]
}
```

## 行程方案（POST /api/itinerary-plans）
```json
{
  "name": "经典三日游",
  "description": "基础方案",
  "locationIds": [1, 3, 5]
}
```

## AI 多团组排期（POST /api/ai/plan/global）
```json
{
  "groupIds": [1, 2, 3],
  "startDate": "2025-09-12",
  "endDate": "2025-09-16",
  "timeSlots": ["MORNING", "AFTERNOON"],
  "planNamePrefix": "AI方案",
  "replaceExisting": true,
  "useAI": true,
  "dryRun": true
}
```

## 统计导出（GET /api/statistics/export?format=csv&startDate=2025-09-01&endDate=2025-09-30）
返回：CSV 文件（二进制流）

## 排程输入包导出（POST /api/planning/export）
```json
{
  "groupIds": [1, 2],
  "startDate": "2025-09-12",
  "endDate": "2025-09-16",
  "includeExistingActivities": true,
  "includeExistingSchedules": true,
  "includePlanItemsByGroup": true
}
```
