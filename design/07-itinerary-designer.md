# 行程设计器（ItineraryDesigner）详解

## 功能定位
多团组 7 日时间轴排期中心：批量查看、编辑、拖拽、冲突检查、AI 自动排期。

## 数据加载
- GET `/groups`
- GET `/activities/raw`
- GET `/locations`
- 读取系统配置：
  - `/config/itinerary-week-start`
  - `/config/itinerary-time-slots`
  - `/config/itinerary-daily-focus`
- 本地缓存：localStorage

## 网格结构
- 7 天视图（以 weekStartDate 为起点）
- 时段：MORNING / AFTERNOON / EVENING（可隐藏）
- 每格显示当前时段内的多个活动卡片

## 交互
- 选择团组：筛选显示
- 拖拽活动：调整日期与时段
- 点击单元格：打开编辑弹窗，支持添加活动
- 导出：当前周 + 选中团组的活动导出为 CSV

## 冲突检查（前端）
- 同团组同时间段冲突
- 地点容量超限
- 地点不可用日期
- 团组类型限制

> 注意：前端冲突检查字段与后端并非完全一致（见 `11-known-issues.md`）。

## AI 多团组生成
- 打开弹窗，选择团组与日期范围
- 预览 / 生成：调用 `/ai/plan/global`
- 生成后写入 itinerary plans + schedules + activities
