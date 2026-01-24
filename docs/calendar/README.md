# 日历文档索引

本目录汇总与“团组日历详情/详细日程”相关的实现说明与同步规则。

## 文档列表
- `calendar-days-view.md`：日历详情（CalendarDaysView）技术设计与交互细节
- `schedule-activity-sync.md`：日历详情与行程设计器互通规则

## CalendarDaysView 概览
- 组件路径：`trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.jsx`
- 视图范围：日期列由团组 `start_date ~ end_date` 动态生成
- 时间轴：06:00–20:45，15 分钟一格（仅整点显示时间标签）
- 交互：拖拽创建/移动/拉伸活动，右键菜单编辑
- 资源区：行程方案点（唯一资源）+ 可重复活动（餐饮/交通/休息等）
- 保存：由父组件批量提交 `POST /groups/:groupId/schedules/batch`

> 详细技术细节与拖拽计算逻辑请见 `calendar-days-view.md`。
