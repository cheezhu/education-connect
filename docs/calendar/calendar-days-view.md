# CalendarDaysView 技术设计文档

## 📋 概述

CalendarDaysView 是一个复杂的 React 组件，实现了类似 Google Calendar 的拖拽式日历界面，用于管理团组的日程安排。该组件支持活动的创建、编辑、拖拽重排，以及资源卡片的管理。

**组件路径**: `/trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.jsx`

## 🎯 核心功能

### 1. 日历视图展示
- **网格布局**：使用 CSS Grid 创建时间槽网格（06:00-20:45，每 15 分钟一格）
- **按团组日期范围**：日期列由 `groupData.start_date ~ end_date` 生成（不固定 7 天）
- **滚动与高度**：日历占满父容器，网格超出时由滚动容器垂直滚动
- **时间标记**：左侧仅在整点显示时间标签，顶部显示日期（包含今天/周末样式）

### 2. 拖拽系统
- **活动拖拽**：支持拖动已有活动到不同时间/日期
- **资源卡片拖拽**：从右侧资源区拖入日历创建新活动
- **双向拖拽**：方案行程点可拖回资源区以“归还”并删除对应活动
- **视觉反馈**：拖拽时显示虚线放置框（drop indicator），使用浏览器原生拖拽预览

### 3. 资源管理
- **行程方案资源**：选择行程方案后，将方案项转为可拖拽“方案行程点”（唯一资源）
- **可重复活动**：餐饮/交通/休息等固定资源，可无限次拖入
- **AI 辅助**：支持 AI 行程生成、AI 规则配置、AI 使用记录

### 4. 活动编辑
- **右键菜单**：右键点击活动打开编辑弹窗
- **时间调整**：支持拖拽移动与拉伸调整时间
- **类型管理**：不同类型活动显示不同颜色和图标
- **点击行为**：左键点击仅阻止冒泡，不直接弹窗（通过右键菜单编辑）

## 🏗️ 技术架构

### 状态管理（关键状态）
```javascript
const [activities, setActivities] = useState(schedules);        // 日程列表
const [selectedPlanId, setSelectedPlanId] = useState(groupData?.itinerary_plan_id ?? null);
const [planResources, setPlanResources] = useState([]);
const [availablePlanResources, setAvailablePlanResources] = useState([]);
const [draggedActivity, setDraggedActivity] = useState(null);   // 拖拽中的活动
const [draggedResource, setDraggedResource] = useState(null);   // 拖拽中的资源
const [dropIndicator, setDropIndicator] = useState(null);       // 放置指示器
const [isDragging, setIsDragging] = useState(false);           // 拖拽状态
```

### 坐标系统
```
CSS Grid 布局：
- 列：第1列为时间列，第2..(N+1)列为日期列（N = 日期数）
- 行：第1行为头部，后续为时间槽（06:00-20:45，15分钟/格）

Grid定位公式：
gridColumn = dayIndex + 2    // 日期列索引
gridRow    = timeSlotIndex + 2  // 时间行索引
```

## 🎨 拖拽实现细节

### 拖拽流程

#### 1. 拖拽开始 (handleDragStart)
```javascript
// 记录鼠标在活动卡片内的偏移
const offsetY = e.clientY - rect.top;
dragOffsetRef.current = { x: offsetX, y: offsetY };

// 设置拖拽数据
e.dataTransfer.setData('application/json', JSON.stringify({
  ...activity,
  dragOffsetY: offsetY
}));
```

#### 2. 拖拽悬停 (handleDragOver)
```javascript
// 计算活动上沿位置（鼠标位置 - 偏移量）
const activityTopY = mouseY - dragOffsetRef.current.y;

// 计算目标时间槽
const adjustedY = activityTopY - headerHeight;
const targetSlotIndex = Math.round(adjustedY / slotHeight);

// 显示放置指示器
setDropIndicator({
  dayIndex,
  slotIndex: constrainedIndex,
  duration,
  time: timeSlots[constrainedIndex]
});
```

#### 3. 拖拽放置 (handleDrop)
```javascript
// 使用相同的计算逻辑确保位置准确
const targetSlotIndex = Math.round(adjustedY / slotHeight);
const adjustedStartTime = timeSlots[constrainedIndex];

// 更新活动时间
activity.startTime = adjustedStartTime;
activity.endTime = newEndTime;
```

### 关键计算公式

**活动上沿位置计算**：
```
活动上沿Y = 鼠标Y - 拖拽偏移Y
```

**时间槽索引计算**：
```
时间槽索引 = Math.round((活动上沿Y - 头部高度) / 时间槽高度)
```

**约束范围计算**：
```
最大开始索引 = 时间槽总数 - 活动持续格数
约束后索引 = Math.max(0, Math.min(最大开始索引, 目标索引))
```

## 📐 布局系统

### Grid 设置（运行时动态）
```javascript
gridTemplateColumns: `60px repeat(${days.length}, 1fr)`
gridTemplateRows: `30px repeat(${timeSlots.length}, ${SLOT_HEIGHT}px)`
```

### 活动定位
```css
.calendar-activity {
  grid-column: [日期列];
  grid-row: [开始时间行] / [结束时间行];
}
```

### 响应式设计
- 日历容器 `calendar-fully-maximized` 占满父容器高度
- 网格溢出由 `.calendar-scroll-wrapper` 负责滚动
- 右侧资源区固定宽度约 20%，独立滚动

## 🔧 资源卡片系统

### 资源来源
- **方案行程点**：行程方案项转为唯一资源（`plan-{planId}-loc-{locationId}`）
- **可重复活动**：预置资源（餐饮/交通/休息/自由活动等）

示例（可重复活动）：
```javascript
const presetResourcesData = [
  { id: 'meal', type: 'meal', title: '早餐', isUnique: false },
  { id: 'lunch', type: 'meal', title: '午餐', isUnique: false },
  { id: 'dinner', type: 'meal', title: '晚餐', isUnique: false },
  { id: 'transport', type: 'transport', title: '大巴交通', isUnique: false },
  { id: 'rest', type: 'rest', title: '休息', isUnique: false },
  { id: 'free', type: 'free', title: '自由活动', isUnique: false }
];
```

### 资源拖拽逻辑
1. **方案行程点拖入**：创建活动 + 从资源区移除
2. **可重复活动拖入**：创建活动（资源保留）
3. **方案行程点拖回**：归还资源 + 删除活动

## 🐛 常见问题和解决方案

### 1. 标尺线与实际位置不一致
**问题**：拖拽时显示的放置框与实际放置位置不匹配
**原因**：`handleDragOver`和`handleDrop`使用了不同的舍入方法
**解决**：统一使用`Math.round()`进行时间槽计算

### 2. 活动卡片拖出后鼠标指针残留
**问题**：活动拖出日历后，鼠标上仍显示活动卡片
**原因**：拖拽状态未完全清理
**解决**：
- 在`handleDragEnd`中清除所有状态
- 添加全局`dragend`监听器作为保障
- 资源区`onDrop`中完整清理状态

### 3. 拖拽偏移计算错误
**问题**：活动放置位置与鼠标位置不符
**原因**：未正确记录/使用鼠标在卡片内的初始偏移
**解决**：使用`useRef`记录偏移量，避免状态更新延迟

### 4. 日历高度适配问题
**问题**：日历底部被截断或出现滚动条
**原因**：父容器高度或滚动容器配置不一致
**解决**：确保父容器与 `calendar-fully-maximized` 高度一致，滚动由 `.calendar-scroll-wrapper` 承担

## 📊 性能优化

### 1. 拖拽性能
- 使用`useRef`存储拖拽偏移，避免频繁状态更新
- 拖拽时降低活动卡片透明度，减少重绘
- 使用`pointer-events: none`避免拖拽时的事件冲突

### 2. 渲染优化
- 条件渲染拖拽指示器，减少DOM操作
- 使用CSS Grid而非绝对定位，提高布局性能

### 3. 状态管理
- 批量更新活动列表，减少重渲染
- 自动保存由父组件 `ScheduleManagement` 进行 500ms 防抖提交
- `CalendarDaysView` 内部 `saveStatus` 仅作 UI 提示

## 🎨 样式系统

### 颜色方案
```javascript
const activityTypes = {
  meal: { color: '#52c41a' },      // 绿色 - 餐饮
  visit: { color: '#1890ff' },     // 蓝色 - 参观
  transport: { color: '#fa8c16' }, // 橙色 - 交通
  rest: { color: '#8c8c8c' },      // 灰色 - 休息
  activity: { color: '#722ed1' },  // 紫色 - 活动
  free: { color: '#13c2c2' }       // 青色 - 自由活动
};
```

### 视觉层次
- **拖拽中活动**：`opacity: 0.5`
- **放置指示器**：`z-index: 15`，虚线框
- **拖拽预览**：使用浏览器原生预览（自定义预览组件目前未启用）

## 🔄 数据流

### 活动更新流程
1. 用户拖拽/编辑活动
2. 计算新的开始/结束时间
3. 更新本地`activities`状态
4. 触发`onUpdate`回调
5. 父组件批量保存（`POST /groups/:id/schedules/batch`）

### 资源管理流程
1. 资源卡片拖入日历
2. 创建新活动对象
3. 方案资源从列表移除（可重复资源保留）
4. 活动拖回资源区
5. 恢复方案资源到列表

## 📝 代码结构

```
CalendarDaysView.jsx
├── 状态定义 (useState, useRef)
├── 工具函数
│   ├── timeToGridRow()    // 时间转Grid行
│   ├── gridRowToTime()    // Grid行转时间
│   └── generateTimeSlots() // 生成时间槽
├── 拖拽处理
│   ├── handleDragStart()  // 拖拽开始
│   ├── handleDragOver()   // 拖拽悬停
│   ├── handleDrop()       // 拖拽放置
│   └── handleDragEnd()    // 拖拽结束
├── 资源/AI
│   ├── 行程方案资源加载
│   ├── AI规则/冲突/历史
│   └── AI行程生成
├── 活动管理
│   ├── handleActivityClick()     // 活动点击
│   ├── handleActivityContextMenu() // 右键菜单
│   ├── handleSaveActivity()      // 保存活动
│   └── handleDeleteActivity()    // 删除活动
└── 渲染逻辑
    ├── 日历网格
    ├── 时间槽
    ├── 活动卡片
    ├── 资源区域
    └── 编辑弹窗
```

## ⚠️ 注意事项

1. **坐标系统**：CSS Grid索引从1开始，JavaScript数组从0开始
2. **时间槽范围**：视图固定 06:00-20:45，结束时间会被网格约束
3. **拖拽兼容性**：依赖 HTML5 Drag and Drop API，需现代浏览器
4. **保存机制**：日历详情保存为批量替换（batch），失败需提示用户重新保存
5. **方案资源恢复**：仅 `resourceId` 为 `plan-*` 且 `isFromResource=true` 的活动可拖回恢复

## 🚀 未来优化建议

1. **多活动冲突检测**：同一时间槽多个活动的处理
2. **批量操作**：支持多选活动进行批量移动/删除
3. **撤销/重做**：实现操作历史记录
4. **键盘快捷键**：支持键盘操作提高效率
5. **动画优化**：添加平滑过渡动画
6. **虚拟滚动**：处理大量活动时的性能优化

## 📚 参考资源

- [CSS Grid 布局指南](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [HTML5 Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- [React DnD 库](https://react-dnd.github.io/react-dnd/) (可选替代方案)
- [Google Calendar UI 设计](https://calendar.google.com)

---

文档版本：1.1.0
最后更新：2026年1月24日
作者：Education Connect 开发团队
