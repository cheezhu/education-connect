# 行程设计器（ItineraryDesigner）详解

## 功能定位
多团组时间轴排期中心：用于“行程点”的跨团队宏观资源调配（导出 -> 外部大模型/求解器 -> 导入 -> 人工微调），并提供可视化网格编辑与冲突提示。

## 数据加载
- GET `/groups`
- GET `/activities/raw`
- GET `/locations`
- 读取系统配置：
  - `/config/itinerary-week-start`
  - `/config/itinerary-time-slots`
  - `/config/itinerary-daily-focus`
  - `/config/itinerary-group-calendar-height`
- 本地缓存：localStorage
  - `itinerary_week_start`
  - `itinerary_time_slots`
  - `itinerary_daily_focus`
  - `itinerary_show_unscheduled`（仅前端本地开关，暂无后端配置）
  - `itinerary_group_calendar_height`

## 网格结构
- 7 天视图（以 weekStartDate 为起点）
- 时段：MORNING / AFTERNOON / EVENING（可隐藏）
- 每格显示当前时段内的多个活动卡片

## 交互
- 选择团组：筛选显示
- 拖拽活动：调整日期与时段
- 点击单元格：打开编辑弹窗，支持添加活动
- 导出（跨团组排程）：
  - 导出排程输入(JSON)：用于外部大模型/求解器（`ec-planning-input@2`）
  - 导出人工模板(CSV)：给非技术同学人工填写/交接
- 导入（跨团组排程）：
  - 导入排程结果(JSON/CSV)：写回 activities / schedules（可选覆盖范围）

## 冲突检查（前端）
- 同团组同时间段冲突
- 地点容量超限
- 地点不可用日期
- 团组类型限制

> 注意：前端冲突检查字段与后端并非完全一致（见 `docs/code-review-issues.md`）。

## 必去行程点（Must-Visit，导出强依赖）

这是“行程设计器导出排程输入”里最关键的一份约束：**每个被导出的团组必须至少勾选 1 个必去行程点**，否则导出会被拦截。

### 数据来源（以团组字段为准）
- 团组字段：`groups.manual_must_visit_location_ids`
  - 形态：地点 ID 数组（例如 `[1, 5, 9]`）
  - 语义：本次跨团组资源调配时，大模型/求解器必须优先安排（每个地点通常只安排 1 次）
- 团组字段：`groups.itinerary_plan_id`
  - 语义：推荐方案/快捷点选（不等同于“必去”）

### 配置入口（推荐）
- 团组管理（GroupManagementV2）-> 团组详情（Profile）-> “必去行程点配置”
  - 手动多选必去点：直接点击卡片即可多选
  - 方案仅是“快捷点选”：选择方案后，点击“套用当前方案”才会把方案地点写入必去点，之后可继续手动微调

### 导出时补齐（减少“点进团组再勾选”的成本）
行程设计器导出弹窗内会显示“必去点补齐”面板：
- 自动列出当前选择范围内“缺少必去点”的团组
- 支持为每个团组直接选择必去点，或“一键从方案填充”
- 导出时会自动把补齐的必去点写回团组字段，再执行导出

## （规划/未落地）AI 多团组生成

当前行程设计器没有接入“后端直调大模型生成排程”的接口；只保留跨团组排程的导出/导入工作流。

## 团组行对齐 / 紧凑模式（规划/未启用）
### 背景与问题
当同一时段有多个团组时，为了方便跨天对比，系统会把同名团组固定在同一行。这会导致某些日期出现“空行”，降低密度。

### 目标
- 保留跨天对齐能力（便于横向对比）
- 提供紧凑模式（只显示当天有安排的团组）
- 对齐模式下的空行弱化显示

### 方案说明
#### 1) 对齐模式
- 行顺序基于整个时间段的团组集合
- 某天没有该团组时显示为空行
- 空行以淡色细线占位，减少视觉噪音

#### 2) 紧凑模式
- 仅渲染当天实际出现的团组行
- 同名团组跨天不再严格固定在同一行
- 适合希望提高密度、减少空行的场景

### 当前实现状态（重要）
- `trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx` 内 `alignGroupRows` 目前写死为 `false`，等同于“仅紧凑模式”
- UI 暂无“对齐团组行”开关，也没有对应的后端 `/config/*` 项
- `TimelineGrid` 组件已具备对齐/紧凑两种渲染路径，后续只需要把开关与配置接上即可

### 相关文件
- `trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx`
  - 当前固定 `alignGroupRows=false`
- `trip-manager/frontend/src/pages/ItineraryDesigner/timeline/TimelineGrid.jsx`
  - 已实现对齐/紧凑两种渲染逻辑
- `trip-manager/frontend/src/pages/ItineraryDesigner/ItineraryDesigner.css`
  - 对齐模式空行样式弱化

### 代码结构（2026-02 重构后）
- 页面入口：`trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx`（约 640 行）
- 数据加载/选择范围（hook）：`trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useItineraryDesignerData.js`
- 样式：`trip-manager/frontend/src/pages/ItineraryDesigner/ItineraryDesigner.css`
- 顶部工具栏：`trip-manager/frontend/src/pages/ItineraryDesigner/components/ItineraryDesignerHeader.jsx`
- 左侧团组选择抽屉：`trip-manager/frontend/src/pages/ItineraryDesigner/components/GroupSelectorDrawer.jsx`
- 时间轴网格：`trip-manager/frontend/src/pages/ItineraryDesigner/timeline/TimelineGrid.jsx`
- 活动卡片（UI）：`trip-manager/frontend/src/pages/ItineraryDesigner/timeline/ActivityCard.jsx`
- 时间轴拖拽（hook）：`trip-manager/frontend/src/pages/ItineraryDesigner/timeline/useTimelineDnD.js`
- 活动新增/编辑/删除（hook）：`trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useActivityCrud.js`
- 底部调控台抽屉：`trip-manager/frontend/src/pages/ItineraryDesigner/console/GroupConsoleDrawer.jsx`
- 底部调控台数据拼装（hook）：`trip-manager/frontend/src/pages/ItineraryDesigner/console/useGroupConsoleModel.js`
- 底部调控台拖拽/清空/移除（hook）：`trip-manager/frontend/src/pages/ItineraryDesigner/console/useGroupConsoleDnD.js`
- 底部调控台高度拖拽（hook）：`trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useGroupCalendarResize.js`
- 编辑行程弹窗：`trip-manager/frontend/src/pages/ItineraryDesigner/components/ActivityEditModal.jsx`
- 导入/导出弹窗：`trip-manager/frontend/src/pages/ItineraryDesigner/planning/PlanningImportModal.jsx`、`trip-manager/frontend/src/pages/ItineraryDesigner/planning/PlanningExportModal.jsx`
- 导入/导出解析（CSV/JSON）：`trip-manager/frontend/src/pages/ItineraryDesigner/planning/planningIO.js`
- 导入/导出状态与业务逻辑（hooks）：`trip-manager/frontend/src/pages/ItineraryDesigner/planning/usePlanningExport.js`、`trip-manager/frontend/src/pages/ItineraryDesigner/planning/usePlanningImport.js`
- 配置读取/本地缓存（hook）：`trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useItineraryDesignerConfig.js`
- 团组日历详情（打开/加载/防抖保存）（hook）：`trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useGroupCalendarDetail.js`
- 团组日历详情弹窗（UI）：`trip-manager/frontend/src/pages/ItineraryDesigner/components/GroupCalendarDetailModal.jsx`
- 冲突 UI 与文案：`trip-manager/frontend/src/pages/ItineraryDesigner/conflicts/`
- 时间轴冲突计算（hook）：`trip-manager/frontend/src/pages/ItineraryDesigner/conflicts/useTimelineSlotConflictMap.js`
- 活动冲突检查（helper，用于新增/编辑提示）：`trip-manager/frontend/src/pages/ItineraryDesigner/conflicts/checkConflicts.js`
- 公共工具（日期/时段/解析/规则/错误提示）：`trip-manager/frontend/src/pages/ItineraryDesigner/shared/`
- 地点可用性规则：`trip-manager/frontend/src/pages/ItineraryDesigner/shared/locationAvailability.js`

### 可选后续优化
- 支持系统级默认值配置
- 进一步压缩空行高度
- 将开关移入“设置”页面，减少工具栏拥挤

## AI 调用方式

当前已落地的“自动化/AI 工作流”只有一条：跨团组排程（导出/导入）。日历详情 Copilot 与其他 AI 入口目前为 UI 预留，后端尚未接入真实 `/api/ai/*` 接口（见 `docs/itinerary-designer-upgrade-review-2026-02-06.md`）。

---

### 1) 跨团组排程（导出 / 导入）

**定位**  
面向多团组跨天排程，适合把排程问题交给外部大模型或离线算法处理。

**流程**  
1. 行程设计器点击 **导出排程输入(JSON)**  
   - API：`POST /api/planning/export`
   - 生成 `planning_input_*.json`
2. 外部模型/算法生成 `planning_result.json`（schema：`ec-planning-result@1`）
3. 行程设计器点击 **导入排程结果(JSON)**  
   - API：`POST /api/planning/import`
   - 支持校验(dryRun)与冲突处理

**写入范围**  
- 写入 `activities` + `schedules`
- **不会创建/修改行程方案**（`itinerary_plans` / `itinerary_plan_items`）

**导入关键选项**  
- 覆盖日期范围内已存在安排（`replaceExisting`）
- 跳过冲突继续导入（`skipConflicts`）
- 仅导入已选团组（UI 选择）

**适用场景**  
跨团组统筹、约束复杂、希望外部模型优化的场景。

---

### （规划/未落地）日历详情 AI Copilot（单团组）

当前仅有前端静态演示 UI（可输入指令，但不会调用后端 AI API）：
- 组件：`trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailCopilot.jsx`
- 逻辑挂载：`trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/index.jsx`

后端现状（截至 2026-02-07）：
- 已有 AI 基础配置读写（provider/model/apiKey/timeout）：`trip-manager/backend/src/routes/systemConfig.js` + `trip-manager/backend/src/utils/aiConfig.js`
- 暂无 `/api/ai/*` 的聊天/排程接口（需要单独实现）

---

### 相关文件/模块
- 前端（行程设计器）：`trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx`
- 前端（日历详情）：`trip-manager/frontend/src/features/calendar-detail/CalendarDetailController.jsx`
- 后端（导出/导入）：`trip-manager/backend/src/routes/planning.js`
- 后端（AI 配置）：`trip-manager/backend/src/routes/systemConfig.js`、`trip-manager/backend/src/utils/aiConfig.js`

---

如需扩展（例如导入时同步行程方案，或新增 AI 入口），建议在此文档追加“变体与扩展”章节统一说明。
