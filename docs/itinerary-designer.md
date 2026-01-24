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
  - `/config/itinerary-group-row-align`
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

> 注意：前端冲突检查字段与后端并非完全一致（见 `docs/issues-known.md`）。

## AI 多团组生成
- 打开弹窗，选择团组与日期范围
- 预览 / 生成：调用 `/ai/plan/global`
- 生成后写入 itinerary plans + schedules + activities

## 团组行对齐 / 紧凑模式
### 背景与问题
当同一时段有多个团组时，为了方便跨天对比，系统会把同名团组固定在同一行。这会导致某些日期出现“空行”，降低密度。

### 目标
- 保留跨天对齐能力（便于横向对比）
- 提供紧凑模式（只显示当天有安排的团组）
- 对齐模式下的空行弱化显示

### 方案说明
#### 1) 对齐模式（默认开启）
- 行顺序基于整个时间段的团组集合
- 某天没有该团组时显示为空行
- 空行以淡色细线占位，减少视觉噪音

#### 2) 紧凑模式
- 仅渲染当天实际出现的团组行
- 同名团组跨天不再严格固定在同一行
- 适合希望提高密度、减少空行的场景

### 使用方式
行程设计器顶部工具栏提供开关：
- **对齐团组行**（提示：同名团组跨天固定在同一行，可能出现空行）
  - 开启：对齐模式
  - 关闭：紧凑模式

开关状态会全局保存并在前端做本地缓存：
- system_config key：`itinerary_group_row_align`
- localStorage key：`itinerary_group_row_align`

### 相关文件
- `trip-manager/frontend/src/pages/ItineraryDesigner.jsx`
  - 新增状态 `alignGroupRows`
  - 新增开关“对齐团组行”
  - 渲染逻辑支持对齐/紧凑两种生成方式
- `trip-manager/frontend/src/pages/ItineraryDesigner.css`
  - 对齐模式空行样式弱化
- `trip-manager/backend/src/routes/systemConfig.js`
  - 配置读取/保存接口

### 可选后续优化
- 支持系统级默认值配置
- 进一步压缩空行高度
- 将开关移入“设置”页面，减少工具栏拥挤

## AI 调用方式

本项目 AI 相关能力分为三条路径：跨团组排程（导出/导入）、行程设计器内置多团组生成（后端直调）、日历详情（单团组 AI 行程）。三者目的、入口与数据流不同，避免混用。

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

### 2) 行程设计器内置多团组生成（后端直调）

**定位**  
直接由后端生成排程结果，适合快速生成“可用版本”的排程。

**入口**  
行程设计器右上角 **AI 多团组生成**

**API**  
`POST /api/ai/plan/global`

**特点**  
- 后端生成并写入 `activities` + `schedules`
- 可配置是否使用外部 AI（如 `AI_api_key`）
- 无需导出/导入中间文件

**适用场景**  
希望快速产出一版行程、接受后端自动排程策略的场景。

---

### 3) 日历详情（单团组 AI 行程）

**定位**  
针对单个团组、基于其行程方案生成/补全详细日程。

**入口**  
团组管理 → 日历详情（GroupEditV2）中的 AI 行程相关按钮。

**API**  
- `GET /api/ai/rules`：读取 AI 规则
- `PUT /api/ai/rules`：保存 AI 规则（需编辑锁）
- `POST /api/ai/plan/itinerary`：为单团组生成/补全行程
- `GET /api/ai/history`：查看 AI 使用记录

**特性**  
- 输入：`groupId` + 选定/绑定的 `itinerary_plan_id`
- 输出：`scheduleList`（写入/覆盖到日历）+ `conflicts`（未能安排项）
- 支持冲突提示弹窗与历史记录查看
- 可配置是否调用外部 AI（`AI_api_key`；同时支持 `AI_PROVIDER`/`AI_MODEL`）
- 规则与历史存储在 `system_config`（`ai_schedule_rules` / `ai_itinerary_history`）

**适用场景**  
单团组行程细化、补全空档、快速生成日历详情。

---

### 核心区别对比

| 维度 | 跨团组排程（导出/导入） | 行程设计器内置多团组生成 | 日历详情（单团组 AI） |
| --- | --- | --- | --- |
| 入口 | 导出 JSON → 外部生成 → 导入 JSON | 行程设计器按钮直调 | 团组日历详情内按钮直调 |
| 适用范围 | 多团组跨天排程 | 多团组快速生成 | 单团组日历补全 |
| 数据写入 | activities + schedules | activities + schedules | schedules（并反映到日历） |
| 行程方案 | **不创建/不修改** | **创建/绑定**（默认流程） | **依赖既有方案** |
| 外部 AI | 外部处理 | 可选 | 可选 |

---

### 相关文件/模块
- 前端（行程设计器）：`trip-manager/frontend/src/pages/ItineraryDesigner.jsx`
- 前端（日历详情）：`trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.jsx`
- 后端（导出/导入）：`trip-manager/backend/src/routes/planning.js`
- 后端（AI 规则/排程/历史）：`trip-manager/backend/src/routes/aiPlanner.js`

---

如需扩展（例如导入时同步行程方案，或新增 AI 入口），建议在此文档追加“变体与扩展”章节统一说明。
