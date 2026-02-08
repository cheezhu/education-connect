# 前端页面与路由说明

## 路由入口（App.jsx）
- `/login`：登录
- `/groups`：团组管理（GroupManagementV2）
- `/groups/v2`：团组管理（同一入口，兼容旧链接）
- `/designer`：行程设计器
- `/locations`：行程资源
- `/statistics`：统计报表
- `/users`：用户管理
- `/settings`：系统设置
- 其他路径：重定向到 `/groups`

## 页面概览

### 团组管理（GroupManagementV2）
- 列表筛选：状态、类型、搜索
- 右侧“调控台”详情区 Tabs：
  - 团组信息（基础字段 + 必去行程点配置）
  - 食行卡片（三餐/接送等）
  - 日历详情（精确到时间的日程网格）
  - 行程详情（文本行程视图：High Density 网格，可读/可打印）
    - 组件：`trip-manager/frontend/src/pages/GroupManagementV2/components/Detail/ItineraryTextDetail.jsx`
    - 子组件：`trip-manager/frontend/src/pages/GroupManagementV2/components/Detail/ItineraryEventRow.jsx`
    - 样式：`trip-manager/frontend/src/pages/GroupManagementV2/GroupCommandCenter.css`（来源：`docs/design/design-group-manager-final.html` 的 `/* --- ITINERARY VIEW (High Density) --- */`）
    - 数据：仅展示/导出“日历详情可见”的 schedules（日期在团期内，时间在 06:00-20:45；溢出/无效会被隐藏）
    - 附加：每一天底部嵌入 Logistics Summary（车辆/住宿/导游），数据来自 `groups.logistics[]`（按 `date` 匹配）
  - 人员信息（花名册：High Density List）
    - 组件：`trip-manager/frontend/src/pages/GroupManagementV2/components/Detail/MembersView.jsx`
    - 子组件：`trip-manager/frontend/src/pages/GroupManagementV2/components/Detail/MemberRow.jsx`
    - 样式：`trip-manager/frontend/src/pages/GroupManagementV2/GroupCommandCenter.css`（来源：`docs/design/design-group-manager-final.html` 的 `/* --- MEMBERS VIEW (High Density List) --- */`）
    - 排序：老师优先，其次按姓名排序；操作按钮（✎/✕）仅在 hover 行时显示
- 行程方案选择：团组信息内下拉绑定 `/itinerary-plans`（方案用于推荐/快捷点选）

### 行程资源（LocationManagement）
- Tab：地点 / 行程方案
- 地点字段：容量、色块、受限日期（`blocked_weekdays`）、联系人
- 行程方案：地点组合列表

### 行程设计器（ItineraryDesigner）
- 7 天时间轴网格，按时段显示
- 可选团组显示范围
- 右上角：导出/导入（跨团组排程）
  - 导出排程输入(JSON)：`ec-planning-input@2`
  - 导出人工模板(CSV)
  - 导入排程结果(JSON/CSV)：写回 activities / schedules
- 导出前校验：未配置“必去行程点”的团组会被拦截，可在导出弹窗内直接补齐并自动保存
- 详情弹窗：添加/编辑活动、地点、人数

### 系统设置（Settings）
- 行程设计器配置：周起始日期、显示时间段、每日关注、团组行对齐
- AI 基础配置：Provider/Model/Timeout/API Key
- AI 规则：时段选择、时间窗、完整排期、单团组最大数量

### 统计报表（Statistics）
- 概览：团组 / 地点 / 活动数
- 地点使用统计
- 活动导出（CSV/JSON）

## API 交互
- 所有请求通过 `services/api.js`
- 登录与凭证：
  - 登录页通过 `services/auth.js` 校验并把 Basic Auth 写入 localStorage（key=`ec_basic_auth`）
  - `services/api.js` 自动从 localStorage（或 `.env` 的 `VITE_API_*`）注入 `Authorization`
- `/api` 由 Vite 代理到 `3001`
