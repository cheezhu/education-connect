# 团组管理未来优化建议

更新日期：2026-01-24
范围：Education Connect / trip-manager

## 目标
- 让团组管理的数据“可保存、可追溯、可筛选、可统计”
- 消除前端伪数据与后端真实数据不一致的问题
- 提升编辑可靠性（锁状态、保存状态明确）
- 为后续成员管理与执行阶段功能打基础

## 现状问题（基于当前代码）
1. **字段不落库导致“看似保存、实际丢失”**
   - 前端提交：`status`、`tags`、`emergency_contact`、`emergency_phone`
   - 后端 `groups` 表与更新白名单不支持这些字段，保存后刷新丢失
   - 相关文件：
     - `trip-manager/frontend/src/pages/GroupEditV2/index.jsx`
     - `trip-manager/frontend/src/pages/GroupEditV2/GroupInfoSimple.jsx`
     - `trip-manager/backend/src/routes/groups.js`
     - `trip-manager/backend/db/init.sql`

2. **团组列表注入伪数据，筛选/搜索被误导**
   - `completion_rate`、`completed_activities`、`activity_count` 为前端随机/计算
   - `contact_person/phone` 为空时被默认值填充
   - 相关文件：
     - `trip-manager/frontend/src/pages/GroupManagementV2/index.jsx`

3. **“已取消”筛选无真实机制**
   - 状态由日期推算，数据库无取消状态字段
   - 结果：筛选永远为空、用户困惑
   - 相关文件：
     - `trip-manager/frontend/src/pages/GroupManagementV2/index.jsx`
     - `trip-manager/backend/db/init.sql`

4. **自动保存与编辑锁状态不可见**
   - 写操作受编辑锁保护，但前端无锁状态提示
   - 保存失败仅 toast，无“未保存”标记
   - 相关文件：
     - `trip-manager/backend/src/middleware/editLock.js`
     - `trip-manager/backend/src/routes/lock.js`
     - `trip-manager/frontend/src/pages/GroupEditV2/ScheduleManagement.jsx`
     - `trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.jsx`

5. **团员管理仍为 mock**
   - 仅前端模拟数据，无法导入/导出/落库
   - 相关文件：
     - `trip-manager/frontend/src/pages/GroupEditV2/MemberManagement.jsx`

6. **历史/旧组件混杂，易造成维护噪音**
   - `index_old.jsx` 残片、`GroupOverview*` 未使用
   - 相关文件：
     - `trip-manager/frontend/src/pages/GroupEditV2/index_old.jsx`
     - `trip-manager/frontend/src/pages/GroupEditV2/GroupOverview.jsx`
     - `trip-manager/frontend/src/pages/GroupEditV2/GroupOverviewCompact.jsx`

## 优化方向（优先级）

### P0：数据一致性与真实筛选
- **扩展团组字段并落库**：`status` 或 `is_cancelled/cancelled_at/cancel_reason`
- **明确定义“真实字段 vs 计算字段”**，列表与筛选只使用真实字段
- **移除伪数据注入**或改为后端统计结果

### P1：保存可靠性与编辑体验
- **编辑锁状态可视化**（谁持锁、剩余时间、无法编辑原因）
- **保存状态显示**（保存中/已保存/保存失败可重试）
- **表单统一 Ant Design**（校验、错误提示一致）

### P2：管理效率与团队协作
- **团员管理落库**（成员表 + 导入/导出 + 与人数统计联动）
- **批量操作**（批量状态、批量绑定行程方案、批量归档）
- **异常标记**（容量冲突、地点不可用）

## 数据模型建议（示意）
> 若采纳“取消状态”，建议以下字段之一（任选其一）：

### 方案A：简化字段
- `status` (TEXT)：准备中/进行中/已完成/已取消

### 方案B：可审计字段
- `is_cancelled` (INTEGER 0/1)
- `cancelled_at` (DATETIME)
- `cancel_reason` (TEXT)

## 后端改动清单（建议）
- `groups` 表新增字段，并纳入 `POST/PUT` 白名单
- 列表统计接口：提供活动数、完成数、完成率
- 统一返回真实数据，避免前端伪字段拼装

## 前端改动清单（建议）
- `GroupManagementV2` 使用后端真实统计，移除随机字段
- `GroupEditV2` 表单字段与后端对齐
- 增加编辑锁状态 UI 与保存状态提示

## 验收标准（示例）
- 状态/取消字段可保存并可筛选
- 团组列表不再出现“默认联系人/随机完成度”
- 编辑锁被占用时，前端明确提示原因
- 保存失败时界面出现“未保存”状态并可重试

## 涉及文件路径索引
- `trip-manager/backend/db/init.sql`
- `trip-manager/backend/src/routes/groups.js`
- `trip-manager/backend/src/middleware/editLock.js`
- `trip-manager/backend/src/routes/lock.js`
- `trip-manager/frontend/src/pages/GroupManagementV2/index.jsx`
- `trip-manager/frontend/src/pages/GroupEditV2/index.jsx`
- `trip-manager/frontend/src/pages/GroupEditV2/GroupInfoSimple.jsx`
- `trip-manager/frontend/src/pages/GroupEditV2/ScheduleManagement.jsx`
- `trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.jsx`
- `trip-manager/frontend/src/pages/GroupEditV2/MemberManagement.jsx`
