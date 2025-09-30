# CalendarDaysView 技术设计文档

## 📋 概述

CalendarDaysView 是一个复杂的 React 组件，实现了类似 Google Calendar 的拖拽式日历界面，用于管理团组的日程安排。该组件支持活动的创建、编辑、拖拽重排，以及资源卡片的管理。

**组件路径**: `/trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.jsx`

## 🎯 核心功能

### 1. 日历视图展示
- **网格布局**：使用 CSS Grid 创建时间槽网格（6:00-20:00，每小时一格）
- **7天视图**：显示团组行程期间的7天日程
- **自适应高度**：日历自动适配屏幕高度，无需滚动条
- **时间标记**：左侧显示时间刻度，顶部显示日期

### 2. 拖拽系统
- **活动拖拽**：支持拖动已有活动到不同时间/日期
- **资源卡片拖拽**：从底部资源区拖入日历创建新活动
- **双向拖拽**：单一活动可从日历拖回资源区
- **视觉反馈**：拖拽时显示蓝色标尺线和预览区域

### 3. 资源管理
- **可重复活动**：如餐饮、交通等，可多次使用
- **单一活动**：如景点参观等，使用后从资源池移除
- **智能恢复**：单一活动拖回资源区时自动恢复到列表

### 4. 活动编辑
- **右键菜单**：右键点击活动打开编辑弹窗
- **时间调整**：支持调整活动的开始和结束时间
- **类型管理**：不同类型活动显示不同颜色和图标

## 🏗️ 技术架构

### 状态管理
```javascript
// 核心状态
const [activities, setActivities] = useState(schedules);        // 活动列表
const [availableResources, setAvailableResources] = useState(); // 可用资源
const [draggedActivity, setDraggedActivity] = useState(null);   // 拖拽中的活动
const [draggedResource, setDraggedResource] = useState(null);   // 拖拽中的资源
const [dropIndicator, setDropIndicator] = useState(null);       // 放置指示器
const [isDragging, setIsDragging] = useState(false);           // 拖拽状态
```

### 坐标系统
```
CSS Grid 布局：
- 列：第1列为时间，第2-8列为星期日期
- 行：第1行为头部，第2-15行为时间槽（6:00-20:00）

Grid定位公式：
gridColumn = dayIndex + 2    // 日期列索引
gridRow = timeSlotIndex + 2  // 时间行索引
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

// 显示标尺线
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

### CSS Grid 设置
```css
.calendar-grid {
  display: grid;
  grid-template-columns: 60px repeat(7, 1fr);  /* 时间列 + 7天 */
  grid-template-rows: 30px repeat(14, 40px);    /* 头部 + 14小时 */
}
```

### 活动定位
```css
.calendar-activity {
  grid-column: [日期列];
  grid-row: [开始时间行] / [结束时间行];
}
```

### 响应式设计
- 日历高度：`calc(100vh - 280px)` 自适应屏幕
- 资源区域：`max-height: 280px` 固定高度，可滚动

## 🔧 资源卡片系统

### 资源分类
```javascript
const presetResourcesData = [
  // 可重复活动
  { id: 'meal', title: '早餐', isUnique: false },

  // 单一活动
  { id: 'science', title: '香港科学馆', isUnique: true }
];
```

### 资源拖拽逻辑
1. **创建活动**：资源拖入日历时创建新活动
2. **移除单一资源**：`isUnique=true`的资源使用后从列表移除
3. **恢复资源**：单一活动从日历拖回资源区时恢复到列表

## 🐛 常见问题和解决方案

### 1. 标尺线与实际位置不一致
**问题**：拖拽时显示的蓝色标尺线与实际放置位置不匹配
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
**原因**：固定高度设置不合理
**解决**：使用`calc(100vh - 其他元素高度)`动态计算

## 📊 性能优化

### 1. 拖拽性能
- 使用`useRef`存储拖拽偏移，避免频繁状态更新
- 拖拽时降低活动卡片透明度，减少重绘
- 使用`pointer-events: none`避免拖拽时的事件冲突

### 2. 渲染优化
- 使用`React.memo`缓存静态组件
- 条件渲染拖拽指示器，减少DOM操作
- 使用CSS Grid而非绝对定位，提高布局性能

### 3. 状态管理
- 批量更新活动列表，减少重渲染
- 使用函数式状态更新，确保状态一致性
- 自动保存使用防抖（800ms），减少API调用

## 🎨 样式系统

### 颜色方案
```javascript
const activityTypes = {
  meal: { color: '#52c41a' },      // 绿色 - 餐饮
  visit: { color: '#1890ff' },     // 蓝色 - 参观
  transport: { color: '#fa8c16' }, // 橙色 - 交通
  rest: { color: '#722ed1' },      // 紫色 - 休息
  activity: { color: '#eb2f96' },  // 粉色 - 活动
  free: { color: '#8c8c8c' }       // 灰色 - 自由活动
};
```

### 视觉层次
- **拖拽中活动**：`opacity: 0.5, z-index: 1`
- **标尺线**：`z-index: 15, 蓝色半透明`
- **拖拽预览**：`z-index: 9999, pointer-events: none`

## 🔄 数据流

### 活动更新流程
1. 用户拖拽活动到新位置
2. 计算新的开始/结束时间
3. 更新本地`activities`状态
4. 触发`onUpdate`回调
5. 父组件处理自动保存

### 资源管理流程
1. 资源卡片拖入日历
2. 创建新活动对象
3. 单一资源从列表移除
4. 活动拖回资源区
5. 恢复单一资源到列表

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
2. **时区问题**：所有时间使用本地时区，确保一致性
3. **拖拽兼容性**：依赖HTML5 Drag and Drop API，需现代浏览器
4. **状态同步**：拖拽状态使用`useRef`避免异步问题
5. **边界处理**：始终检查索引范围，防止越界

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

文档版本：1.0.0
最后更新：2025年1月
作者：Education Connect 开发团队