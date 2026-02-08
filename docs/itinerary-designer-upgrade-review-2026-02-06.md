# 行程设计器升级前审查报告（2026-02-06）

> 更新（2026-02-07）：已落地“必去行程点（manual_must_visit_location_ids）导出强校验 + 导出弹窗内补齐并自动保存”的流程，用于减少导出阻塞并明确硬约束。
> 更新（2026-02-07）：已将行程设计器的 planning 导入/导出状态与业务逻辑从 `index.jsx` 抽离到 hooks（`usePlanningExport` / `usePlanningImport`），降低耦合并缩小主文件体积。
> 更新（2026-02-07）：已进一步拆分 `ItineraryDesigner/index.jsx`：抽离顶部工具栏/团组选择抽屉/编辑行程弹窗，并抽离配置读取与“团组日历详情防抖保存”逻辑到 hooks。
> 更新（2026-02-08）：继续拆分 `ItineraryDesigner/index.jsx`：抽离数据加载、活动 CRUD、调控台拖拽/清空、调控台高度拖拽；主文件降至约 640 行。

## 1. 本次审查范围

本次重点检查了与“行程设计器升级”和“日历详情 AI 助手”直接相关的模块：

- 文档：`docs/itinerary-designer.md`、`docs/calendar-system.md`、`docs/api/api-reference.md`、`docs/db-schema.md`、`docs/code-review-issues.md`
- 前端：`trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx`、`trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/index.jsx`、`trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailCopilot.jsx`
- 后端：`trip-manager/backend/server.js`、`trip-manager/backend/src/routes/planning.js`、`trip-manager/backend/src/routes/schedules.js`、`trip-manager/backend/src/routes/systemConfig.js`、`trip-manager/backend/src/utils/aiConfig.js`

---

## 2. 模块概览（与本次需求相关）

### 2.1 前端关键模块

- `trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx`（约 640 行，已进一步拆分数据加载/CRUD/调控台拖拽/高度拖拽等逻辑，主文件更聚焦“页面编排”）
  - 同时承担：周时间轴、团组详情弹层、导入导出、拖拽、保存、配置读取
  - 是当前改造主战场
- `trip-manager/frontend/src/pages/ItineraryDesigner/components/ItineraryDesignerHeader.jsx`
  - 顶部工具栏（周切换/日期选择/时间段开关/导入导出入口）
- `trip-manager/frontend/src/pages/ItineraryDesigner/components/GroupSelectorDrawer.jsx`
  - 左侧团组选择抽屉（筛选/批量/缺必去点提示等）
- `trip-manager/frontend/src/pages/ItineraryDesigner/components/ActivityEditModal.jsx`
  - “编辑行程”弹窗（新增/编辑/删除活动）
- `trip-manager/frontend/src/pages/ItineraryDesigner/components/GroupCalendarDetailModal.jsx`
  - 团组日历详情弹窗（上部弹层 UI，资源栏开关 + 关闭）
- `trip-manager/frontend/src/pages/ItineraryDesigner/timeline/ActivityCard.jsx`
  - 时间轴内活动卡片 UI（arrival/departure 标记 + 删除/双击编辑入口）
- `trip-manager/frontend/src/pages/ItineraryDesigner/timeline/useTimelineDnD.js`
  - 时间轴拖拽逻辑（drag start/end/over/enter/leave/drop）
- `trip-manager/frontend/src/pages/ItineraryDesigner/console/useGroupConsoleModel.js`
  - 底部调控台数据拼装（必去行程点卡片 + 上午/下午网格数据）
- `trip-manager/frontend/src/pages/ItineraryDesigner/conflicts/useTimelineSlotConflictMap.js`
  - 时间轴冲突计算（按 date+slot 聚合，产出冲突 map）
- `trip-manager/frontend/src/pages/ItineraryDesigner/conflicts/checkConflicts.js`
  - 活动新增/编辑用的冲突检查（同团组同 slot、容量、不可用日、团组类型）
- `trip-manager/frontend/src/pages/ItineraryDesigner/shared/locationAvailability.js`
  - 地点可用性规则（停用/不可用星期/闭馆日）
- `trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useItineraryDesignerData.js`
  - 数据加载与刷新（groups/activities/locations/itineraryPlans/selectedGroups）
- `trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useActivityCrud.js`
  - activities 的新增/更新/删除（并修复“从卡片删除时 selectedTimeSlot 为空导致崩溃”的风险）
- `trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useGroupCalendarResize.js`
  - 底部调控台高度拖拽（vh resize + debounce persist）
- `trip-manager/frontend/src/pages/ItineraryDesigner/console/useGroupConsoleDnD.js`
  - 调控台拖拽/清空/移除等交互逻辑（和 UI 抽屉解耦）
- `trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useItineraryDesignerConfig.js`
  - 周起始、时段显示、日聚焦、控制台高度等配置读写与 localStorage
- `trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useGroupCalendarDetail.js`
  - 团组日历详情：打开/加载 + 防抖保存（revision/token guard）+ 资源栏开关状态
- `trip-manager/frontend/src/pages/ItineraryDesigner/planning/usePlanningExport.js`、`trip-manager/frontend/src/pages/ItineraryDesigner/planning/usePlanningImport.js`
  - planning 导入/导出状态与业务逻辑（表单 watch、导出必去点强校验、导入校验/回滚/冲突汇总）
- `trip-manager/frontend/src/pages/ItineraryDesigner/ItineraryDesigner.css`（约 1560 行）
  - 承担布局、弹层、主题覆盖、控制台样式
- `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/index.jsx`（约 1200+ 行）
  - 日历详情内的活动渲染、拖拽、资源侧栏、AI 面板挂载
- `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailCopilot.jsx`（约 50+ 行）
  - 当前是静态演示 UI，不是后端 AI 对话

### 2.2 后端关键模块

- `trip-manager/backend/server.js`
  - 路由挂载点；当前没有单独 `/api/ai/chat` 之类的聊天路由
- `trip-manager/backend/src/routes/planning.js`（约 567 行）
  - 负责 `planning/export`、`planning/import`
  - `import` 是“导入 AI 结果”的数据校验与写库，不负责调用大模型
- `trip-manager/backend/src/routes/schedules.js`（约 237 行）
  - `POST /groups/:groupId/schedules/batch` 采用“整组全量替换”（但已加入 revision 校验，避免并发覆盖）
- `trip-manager/backend/src/routes/systemConfig.js` 与 `trip-manager/backend/src/utils/aiConfig.js`
  - AI provider/model/apiKey/timeout 的配置读取与保存

---

## 3. 关键发现（按优先级）

## P0（必须先处理）

### 3.1 “日历详情 AI 助手”目前未接入真实 AI API

证据：

- `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailCopilot.jsx`
  - 仅将输入透传给 `onSend`（当前是静态演示 UI）
- `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/index.jsx`
  - `handleAutoPlan` / `handleOptimizeRoute` 仅 `message.info('...正在接入中')`
  - `onSend` 仅提示 `AI 提示已收到：...`
- `trip-manager/backend/server.js:322`
  - 未见 AI chat 路由挂载

影响：

- 用户可见“聊天输入框”，但无法真正调用模型、也无法生成可应用的排程建议

建议：

- 新增后端聊天接口（建议：`POST /api/ai/schedule-chat`）
- 前端将对话改为“消息流 + 方案预览 + 手动应用”

### 3.2 AI API Key 以明文持久化到数据库

证据：

- `trip-manager/backend/src/routes/systemConfig.js:290`
  - 直接 `upsertConfig(... ai_api_key ...)`
- `trip-manager/backend/src/utils/aiConfig.js:15`
  - `AI_CONFIG_KEYS.apiKey = 'ai_api_key'`
- `trip-manager/backend/src/utils/aiConfig.js:108`
  - 读取并直接返回原始 key（内部使用）

影响：

- 数据库泄露时，AI key 会直接暴露
- 审计与合规风险较高

建议：

- 生产环境强制使用环境变量，不落库
- 或至少对系统配置表中的敏感项做加密存储（含轮换策略）

## P1（应尽快处理）

### 3.3 `schedules/batch` 全量替换策略存在误删风险

证据：

- `trip-manager/backend/src/routes/schedules.js`
  - `DELETE FROM schedules WHERE group_id = ?`
  - 同时存在 revision 校验（409 + `x-schedule-revision`），用于避免并发覆盖

影响：

- 任何“局部更新”一旦误传为“全量数据不完整”，会删除该团组已有安排
- 与多人并发或长会话编辑叠加时风险更高

建议：

- 改为增量写入（upsert + delete by ids）
- 或在服务端区分来源（只替换 `is_from_resource=1` / 指定 `resource_id` 前缀）

### 3.4 弹层布局逻辑分散，易出现“覆盖导航栏/位置错乱”

证据：

- `trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx`
  - `getDesignerContainer` 有 `document.body` 回退（container 锚点不稳定时易覆盖导航栏）
- `trip-manager/frontend/src/pages/ItineraryDesigner/components/GroupCalendarDetailModal.jsx`
  - 详情弹窗为全宽 overlay，需要确保 `getContainer` 锚定在设计器容器内
- `trip-manager/frontend/src/pages/ItineraryDesigner/ItineraryDesigner.css:747`
  - `.itinerary-modal-wrap { position:absolute; inset:0; }`
- `trip-manager/frontend/src/pages/ItineraryDesigner/ItineraryDesigner.css:735`
  - `.group-calendar-drawer { position:absolute !important; inset:0; }`

影响：

- 容器锚点不一致时，顶部/底部弹层容易覆盖左侧导航或跑到错误位置

建议：

- 统一弹层宿主为 `itinerary-designer` 内单一 overlay root，不允许回退 `body`
- 顶部日历和底部控制台都挂到同一容器，统一 `z-index` 体系

## P2（中期治理）

### 3.5 行程设计器文件过大，功能耦合重

证据：

- `trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx` 约 640 行
- `trip-manager/frontend/src/pages/ItineraryDesigner/ItineraryDesigner.css` 约 1560 行

影响：

- 功能迭代时回归风险高，定位问题成本大

建议拆分（当前已落地一部分）：

- `trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx`（页面编排）
- `trip-manager/frontend/src/pages/ItineraryDesigner/components/ItineraryDesignerHeader.jsx`
- `trip-manager/frontend/src/pages/ItineraryDesigner/components/GroupSelectorDrawer.jsx`
- `trip-manager/frontend/src/pages/ItineraryDesigner/components/ActivityEditModal.jsx`
- `trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useItineraryDesignerConfig.js`
- `trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useGroupCalendarDetail.js`
- `trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useItineraryDesignerData.js`
- `trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useActivityCrud.js`
- `trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useGroupCalendarResize.js`
- `trip-manager/frontend/src/pages/ItineraryDesigner/timeline/TimelineGrid.jsx`
- `trip-manager/frontend/src/pages/ItineraryDesigner/console/GroupConsoleDrawer.jsx`
- `trip-manager/frontend/src/pages/ItineraryDesigner/console/useGroupConsoleDnD.js`
- `trip-manager/frontend/src/pages/ItineraryDesigner/planning/PlanningImportModal.jsx`
- `trip-manager/frontend/src/pages/ItineraryDesigner/planning/PlanningExportModal.jsx`
- `trip-manager/frontend/src/pages/ItineraryDesigner/planning/planningIO.js`
- `trip-manager/frontend/src/pages/ItineraryDesigner/planning/usePlanningExport.js`
- `trip-manager/frontend/src/pages/ItineraryDesigner/planning/usePlanningImport.js`
- `trip-manager/frontend/src/pages/ItineraryDesigner/conflicts/SlotConflictModal.jsx`
- `trip-manager/frontend/src/pages/ItineraryDesigner/conflicts/checkConflicts.js`
- `trip-manager/frontend/src/pages/ItineraryDesigner/shared/`（dates/timeSlots/parse/groupRules/messages）

### 3.6 缺少自动化测试

现状：

- 当前仓库无前后端测试文件（未检索到 jest/vitest/spec）

建议最小集：

- 后端：`planning/import` 冲突校验与写库测试
- 前端：AI 聊天“仅预览不自动写入”流程测试
- 集成：`schedules/batch` revision 冲突回归测试

---

## 4. 与你当前目标的直接结论

你要做的是：先排好行程点，再用 AI 补充餐饮等“行程点之外内容”，并通过对话写入。

结论：

- 架构上可行
- 但当前代码还停留在“AI 面板 UI”阶段，不具备真实对话与落库能力
- 需要先补一条“对话 -> 预览 -> 应用”的后端与前端链路

---

## 5. 建议实施顺序（按可交付拆分）

### 阶段 A：打通最小可用 AI 对话（MVP）

目标：

- 在“日历详情 AI 助手”里发送自然语言
- 后端返回结构化建议（只含 MORNING/AFTERNOON）
- 前端显示预览并可“应用新增”，默认不覆盖已有安排

工作项：

- 新增后端接口：`POST /api/ai/schedule-chat`
- 输入：`groupId + 当前日历 + 用户指令`
- 输出：`proposedAssignments[] + explanations[] + warnings[]`
- 前端：消息列表、方案预览卡、`应用` 按钮

验收：

- 输入“周三下午补一个室内餐饮安排”，可生成并应用一条新增活动

### 阶段 B：会话记忆与续聊

目标：

- 对话可命名、可恢复

工作项：

- 新增 `ai_sessions`、`ai_messages` 两张表
- 支持 `sessionId` 续聊与会话列表

### 阶段 C：安全与可靠性加固

目标：

- 防误删、可审计、可回滚

工作项：

- `schedules/batch` 从全量替换改为增量更新
- API key 改环境变量或加密存储
- 增加冲突测试与回归测试

---

## 6. 你现在可以直接执行的下一步

建议下一步只做一件事：

- 先实现“阶段 A 的聊天接口 + 预览应用（仅新增，不覆盖）”

这样能最快把“AI 对话有实际价值”落地，再逐步做续聊和安全治理。
