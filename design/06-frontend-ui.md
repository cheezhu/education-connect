# 前端页面与路由说明

## 路由入口（App.jsx）
- `/groups`：团组管理
- `/groups/v2`：同上
- `/groups/v2/new`：新建团组
- `/groups/v2/edit/:id`：团组编辑
- `/designer`：行程设计器
- `/locations`：行程资源
- `/statistics`：统计报表
- 其他路径：重定向 `/groups`

## 页面概览
### 团组管理（GroupManagementV2）
- 列表筛选：状态、类型、搜索
- 操作：团组信息（弹窗）、日历详情（跳转编辑页）、详细日程（弹窗）
- 行程方案选择：下拉绑定 `/itinerary-plans`
- 备注：页面内 `status/tags/completion` 为前端计算或随机字段，不来自数据库

### 团组编辑（GroupEditV2）
- Tabs：团组信息 / 日历详情 / 详细日程
- 新建模式：先保存团组再编辑日历
- 自动保存：800ms 延迟（PUT /groups/:id）

### 行程资源（LocationManagement）
- Tab：地点 / 行程方案
- 地点字段：容量、受限日期（blocked_weekdays）、联系人
- 行程方案：地点组合列表

### 行程设计器（ItineraryDesigner）
- 7天时间轴网格，按时段显示
- 可选择团组显示范围
- 右上角：AI 多团组生成、导出
- 新增：导出排程输入包(JSON)
- 详情弹窗：添加/编辑活动、地点、人数

### 统计报表（Statistics）
- 统计概览（团组/地点/活动数）
- 地点使用统计
- 活动导出（CSV/JSON）

## API 交互
- 所有请求通过 `services/api.js`
- Basic Auth 固定 `admin/admin123`
- `/api` 由 Vite 代理到 3001
