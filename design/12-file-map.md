# 关键文件路径索引

## 后端
- `trip-manager/backend/server.js`：Express 入口
- `trip-manager/backend/db/init.sql`：数据库初始化
- `trip-manager/backend/db/trip.db`：SQLite 数据库
- `trip-manager/backend/src/routes/*`：API 路由
- `trip-manager/backend/src/routes/planning.js`：排程输入包导出
- `trip-manager/backend/src/middleware/editLock.js`：编辑锁中间件

## 前端
- `trip-manager/frontend/src/App.jsx`：路由入口
- `trip-manager/frontend/src/services/api.js`：API 客户端
- `trip-manager/frontend/src/pages/GroupManagementV2/`：团组管理
- `trip-manager/frontend/src/pages/GroupEditV2/`：团组编辑 + 日历详情
- `trip-manager/frontend/src/pages/ItineraryDesigner.jsx`：行程设计器
- `trip-manager/frontend/src/pages/LocationManagement.jsx`：地点/方案
- `trip-manager/frontend/src/pages/Statistics.jsx`：统计报表

## 文档
- `docs/architecture/overview.md`
- `docs/calendar/calendar-days-view.md`
- `docs/calendar/schedule-activity-sync.md`
- `docs/strategy/`（规划与市场方案）
