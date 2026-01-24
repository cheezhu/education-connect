# 团组管理与子界面 UI 体验问题清单

更新日期：2026-01-24
范围：Education Connect / trip-manager

## 主要体验问题（按影响排序）
1. **列表可读性过低**
   - 表格字号 11px + small 模式，长时间使用疲劳、扫读困难
   - 涉及文件：`trip-manager/frontend/src/pages/GroupManagementV2/GroupManagementV2.css`

2. **信息入口不一致（弹窗/页面/弹窗混用）**
   - 团组信息：Modal
   - 日历详情：跳转页面
   - 详细日程：Modal
   - 涉及文件：`trip-manager/frontend/src/pages/GroupManagementV2/index.jsx`

3. **侧边栏竖排文字学习成本高，移动端体验差**
   - 固定 80px + 竖排标题，阅读阻力高
   - 涉及文件：`trip-manager/frontend/src/pages/GroupEditV2/GroupEditV2.css`

4. **表单风格不一致（原生 input vs Ant Design）**
   - 团组信息页使用原生 input/select，视觉与交互割裂
   - 涉及文件：`trip-manager/frontend/src/pages/GroupEditV2/GroupInfoSimple.jsx`

5. **保存状态不可感知**
   - 自动保存失败仅 toast，用户无法确认是否落库
   - 涉及文件：
     - `trip-manager/frontend/src/pages/GroupEditV2/index.jsx`
     - `trip-manager/frontend/src/pages/GroupEditV2/ScheduleManagement.jsx`

6. **筛选栏在窄屏错位**
   - `Space` + `marginLeft: auto` 在 wrap 模式下易错位
   - 涉及文件：`trip-manager/frontend/src/pages/GroupManagementV2/index.jsx`

7. **详细日程缺少刷新/编辑入口**
   - 仅展示，用户不能快速跳转编辑
   - 涉及文件：`trip-manager/frontend/src/pages/GroupEditV2/ScheduleDetail.jsx`

8. **日历详情弹窗控件不直觉**
   - 日期字段使用 `TimePicker.RangePicker` 且 disabled，易误解
   - 涉及文件：`trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.jsx`

---

## 快速体验修复（低改动、高收益）
- **提升列表可读性**
  - 字号 12–13px、行高 32–36px
  - 表头加粗但不小于 12px
  - 轻微斑马纹或 hover 高亮

- **筛选栏结构化**
  - 使用 `Row/Col` 或 `Flex` 分成“筛选区 / 搜索区 / 操作区”
  - 避免 wrap 错位

- **入口一致化**
  - 列表页统一用 Drawer 展示“团组信息 / 日历详情 / 详细日程”三 Tab
  - 保持同层级入口，减少心智切换

- **保存状态提示**
  - 顶部状态条显示“保存中 / 已保存 / 保存失败可重试”

- **详细日程增强**
  - 增加“刷新 / 跳转到日历详情”按钮

---

## 结构级体验优化（中改动）
- **左侧导航改造**
  - 桌面端：横向 Tab 或可折叠侧栏（默认展开）
  - 移动端：顶部 Tab 或 Drawer

- **表单统一 Ant Design**
  - `GroupInfoSimple` 替换为 `Form + Input + DatePicker + Select`
  - 分区：基础信息 / 联系方式 / 行程信息

- **日历详情弹窗控件校正**
  - 日期字段改为 `DatePicker`（只读或可编辑）
  - 时间字段使用 `TimePicker`

- **列表列信息压缩**
  - 次要字段（联系人、电话、标签）收进扩展行或 hover 卡片
  - 主表保留核心列（名称/日期/人数/状态/方案/操作）

---

## 涉及文件路径索引
- `trip-manager/frontend/src/pages/GroupManagementV2/index.jsx`
- `trip-manager/frontend/src/pages/GroupManagementV2/GroupManagementV2.css`
- `trip-manager/frontend/src/pages/GroupEditV2/index.jsx`
- `trip-manager/frontend/src/pages/GroupEditV2/GroupEditV2.css`
- `trip-manager/frontend/src/pages/GroupEditV2/GroupInfoSimple.jsx`
- `trip-manager/frontend/src/pages/GroupEditV2/ScheduleManagement.jsx`
- `trip-manager/frontend/src/pages/GroupEditV2/ScheduleDetail.jsx`
- `trip-manager/frontend/src/pages/GroupEditV2/CalendarDaysView.jsx`
