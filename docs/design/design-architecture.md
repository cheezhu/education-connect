# 行程设计器 v2.0 (Pro Workstation) - 架构设计文档

## 1. 设计目标

将现有的“行程设计器”从一个简单的排期表格升级为**专业级的生产力工具**。
目标用户是需要长时间、高频次操作的调度员。核心设计原则是**沉浸感**、**高效率**和**全局掌控**。

---

## 2. UI 布局规范 (The Shell)

采用经典的 **IDE 布局 (Holy Grail Layout)**，最大化时间轴的可视区域。

```mermaid
graph TD
    Root[App Shell (100vh)]
    Root --> Top[Top Bar (40px)]
    Root --> Body[Main Body (Flex Row)]
    
    Body --> ActivityBar[Activity Bar (48px, Left)]
    Body --> Sidebar[Sidebar (260px, Resizable)]
    Body --> Stage[Main Stage (Flex Column)]
    Body --> Inspector[Inspector (280px, Right, Collapsible)]
    
    Stage --> Toolbar[Editor Toolbar (36px)]
    Stage --> Canvas[Timeline Canvas (Flex 1, Scrollable)]
    Stage --> Panel[Bottom Panel (150px, Resizable)]
```

### 区域定义

1.  **Activity Bar (左侧极窄栏)**:
    *   功能：切换 Sidebar 的视图（行程树、资源库、搜索、AI助手）。
    *   样式：深灰色背景，图标垂直排列。

2.  **Sidebar (侧边栏)**:
    *   **视图A - 排期管理**:
        *   `Open Groups` (已选团组列表，带复选框)。
        *   `Unscheduled Pool` (待排期团组/活动池，支持拖拽)。
    *   **视图B - 资源库**: 显示地点、车辆等资源状态。

3.  **Timeline Canvas (中央画布)**:
    *   核心时间轴网格。
    *   特性：十字准星辅助、右键菜单、多选框选。

4.  **Inspector (右侧属性面板)**:
    *   取代弹窗。选中 Canvas 中的卡片时，此处显示详情表单。
    *   特性：实时保存 (Debounce Save)，无需“确定”按钮。

5.  **Bottom Panel (底部控制台)**:
    *   **Tab 1 - Problems**: 实时冲突列表 (e.g., "科技馆A厅 Capacity exceeded")。
    *   **Tab 2 - Daily Focus**: 现有的每日关注统计行移至此处。

---

## 3. 核心交互流程

### 3.1 拖拽排期 (Drag-and-Drop Scheduling)

这是从“表格录入”到“可视化排期”的质变。

1.  **源 (Source)**: Sidebar 中的 `Unscheduled Pool`（显示未排期的团组）。
2.  **动作 (Action)**: 用户拖拽团组名 -> 移动到 Canvas 的某个格子 (e.g., 周二上午)。
3.  **响应 (Drop)**:
    *   前端立即在目标格子渲染一个“临时卡片” (Optimistic UI)。
    *   自动调用 `POST /activities` 创建活动。
    *   触发 `checkConflicts` 校验。
    *   如果成功：卡片变为实体，Inspector 自动选中该卡片供进一步编辑。
    *   如果失败：Toast 提示错误，回滚 UI。

### 3.2 冲突实时诊断 (Real-time Diagnostics)

不再依赖用户主动检查，系统像编译器报错一样实时反馈。

1.  **监听**: `useEffect` 监听 `activities` 数组的变化。
2.  **计算**: 遍历所有活动，运行冲突检测逻辑（地点容量、时间重叠、不可用日期）。
3.  **输出**: 生成一个 `Diagnostic[]` 数组。
4.  **渲染**:
    *   **在 Canvas**: 冲突卡片变红，显示警告图标。
    *   **在 Bottom Panel**: 渲染错误列表列表。
5.  **交互**: 点击 Bottom Panel 的某一行错误 -> Canvas 自动滚动并聚焦到对应卡片 -> 打开 Context Menu 建议修复方案。

---

## 4. 组件架构拆分

将 `ItineraryDesigner.jsx` (2300行) 拆解为原子组件。

```
src/pages/ItineraryDesigner/
├── index.jsx                # 入口，Context Provider
├── context/
│   ├── SelectionContext.js  # 管理选中态 (selectedActivityIds)
│   └── DiagnosticContext.js # 管理冲突列表
├── layout/
│   ├── ActivityBar.jsx
│   ├── Sidebar.jsx
│   ├── Inspector.jsx
│   └── BottomPanel.jsx
├── canvas/
│   ├── TimelineCanvas.jsx   # 网格容器
│   ├── GridHeader.jsx       # 日期头
│   ├── GridRow.jsx          # 时间段行
│   ├── GridCell.jsx         # 单元格 (处理 Drop)
│   └── ActivityCard.jsx     # 卡片 (处理 Drag/Click/Context)
└── overlays/
    ├── ContextMenu.jsx      # 右键菜单
    └── SmartResolver.jsx    # 冲突解决浮层
```

## 5. 关键数据结构增强

为了支持新功能，需要在现有数据结构上做轻微扩展（前端状态层）。

### 5.1 选中模型 (Selection Model)
不仅仅是选中一个，要支持**多选**。

```javascript
// Before
const [selectedTimeSlot, setSelectedTimeSlot] = useState(null); // 只能选时间段

// After
const [selection, setSelection] = useState({
  type: 'activity' | 'cell' | 'group', 
  ids: ['act-123', 'act-456'] // 支持多选
});
```

### 5.2 诊断模型 (Diagnostic Model)

```javascript
interface Diagnostic {
  id: string;          // 唯一ID
  severity: 'error' | 'warning' | 'info';
  message: string;     // e.g. "Capacity Exceeded"
  sourceId: string;    // 关联的 activityId
  locationId?: string; // 关联的地点ID
  fixSuggestions?: {   // 智能修复建议
    label: string;     // "Move to Afternoon"
    action: () => void;
  }[];
}
```

---

## 6. 视觉与体验细节 (Polishing)

*   **深色模式 (Dark Mode)**: 使用 CSS Variables 定义主题，确保长时间工作舒适度。
*   **微交互**:
    *   Hover 团组名 -> 高亮该团组在时间轴上的所有活动 (Dim others)。
    *   Drag 活动时 -> 自动高亮可放置的区域（Drop Zones）。
*   **快捷键 (Hotkeys)**:
    *   `Del`: 删除选中活动。
    *   `Ctrl+C / Ctrl+V`: 复制/粘贴活动。
    *   `Ctrl+Z`: 撤销操作（需要引入 undo/redo 栈）。

