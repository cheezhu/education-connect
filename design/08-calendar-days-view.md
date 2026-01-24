# 日历详情（CalendarDaysView）说明

CalendarDaysView 位于：
`trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.jsx`

## 核心能力
- Google Calendar 风格网格
- 拖拽创建/调整活动
- 资源卡片拖拽
- 右键菜单编辑

## 关键点
- 视图为 7 天，时间轴 6:00-20:00
- 使用 CSS Grid 定位活动
- 保存时调用 `/groups/:groupId/schedules/batch`

## 详细技术说明
请参考：`docs/calendar/calendar-days-view.md`
