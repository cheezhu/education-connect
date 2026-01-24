# 团组管理界面与子界面问题清单

本清单基于当前代码实现与 UI 行为，聚焦 **功能问题** 与 **UI/UX 问题**。涉及页面包括：
- 团组管理（`trip-manager/frontend/src/pages/GroupManagementV2/index.jsx`）
- 团组编辑（`trip-manager/frontend/src/pages/GroupEditV2/index.jsx`）
- 团组信息子页（`GroupInfoSimple.jsx`）
- 日历详情/详细日程（`ScheduleManagement.jsx` / `ScheduleDetail.jsx` / `CalendarDaysView.jsx`）

---

## 一、功能问题（数据一致性 / 可用性）

1) **团组状态字段不落库，筛选“已取消”无效**
   - 列表状态由日期计算（`calculateStatus`），并非数据库字段。
   - `status` 在编辑页被提交，但后端不会保存（groups 表无该字段）。
   - 影响：
     - “已取消”筛选永远为空。
     - 状态在刷新后恢复为日期推导结果，用户会误以为已保存。

2) **列表页注入“虚拟字段”，可能误导用户**
   - `completed_activities`、`activity_count`、`completion_rate` 为前端随机/计算值。
   - `contact_person/phone` 若为空会被填入默认值（张老师/13800138000）。
   - 影响：
     - 数据看似真实但实际未存储。
     - 搜索、筛选可能基于虚假数据。

3) **编辑页提交了后端不支持字段（无效保存）**
   - `tags`、`emergency_contact`、`emergency_phone`、`status` 被提交但后端忽略。
   - 影响：用户输入后刷新即丢失。

4) **日历详情保存失败无“脏状态”提示**
   - `ScheduleManagement` 的 500ms 自动保存失败仅 toast 提示，没有回滚/重试/标记未保存。
   - 影响：用户可能认为已保存，实际后端未落库。

5) **编辑锁状态不透明**
   - 后端有编辑锁机制，但前端无锁状态提示/获取操作。
   - 若权限不足或锁被占用，用户仅收到“保存失败”类提示。

6) **团组筛选含“已取消”但无取消机制**
   - UI 提供“已取消”筛选，但无任何入口或字段可以设置取消状态。
   - 影响：筛选项无意义、用户困惑。

7) **ScheduleDetail 仅展示数据，缺少刷新/编辑入口**
   - “详细日程”在团组管理页以弹窗展示，只有查看无编辑。
   - 若日历详情编辑后需手动重新打开/刷新才更新。

---

## 二、UI / 交互问题

1) **列表字体过小，可读性差**
   - 表格字体 11px（`GroupManagementV2.css`）对长时间使用不友好。

2) **团组编辑侧边栏使用竖排文字，学习成本高**
   - `writing-mode: vertical-rl`，文字可读性低，尤其是较长团组名。
   - 移动端体验更差（侧栏固定宽 80px，不可收起）。

3) **编辑页表单为原生 input，与整体 Ant Design 风格不一致**
   - `GroupInfoSimple` 使用原生 `<input>/<select>`，视觉与交互不统一。
   - 缺少统一校验、错误提示。

4) **“日历详情”与“详细日程”入口不一致**
   - “日历详情”直接跳转页面，“详细日程”弹窗查看。
   - 同一内容层级的入口行为不一致，增加理解成本。

5) **信息密度过高，缺少分组与层次**
   - 团组信息中字段密集，缺少逻辑分区（基础信息/联系人/方案/备注）。
   - 小屏设备下容易拥挤。

6) **缺少保存状态反馈**
   - 自动保存没有“保存中/已保存”状态提示。
   - 用户难以判断数据是否成功落库。

7) **筛选栏布局挤压**
   - `Space` 内右侧信息用 `marginLeft: 'auto'`，在窄屏容易换行错位。

---

## 三、可选改进建议（简短）

- 功能：
  - 明确哪些字段是“仅前端展示”，避免伪数据进入核心流程。
  - 将 `status` 字段真正落库或移除“已取消”筛选。
  - 给自动保存增加“未保存/保存失败”可视提示。

- UI：
  - 提升表格字体至 12–13px。
  - 侧栏增加折叠/横排备选模式。
  - 表单统一 Ant Design 组件并补充校验/错误提示。

---

## 关联文件
- `trip-manager/frontend/src/pages/GroupManagementV2/index.jsx`
- `trip-manager/frontend/src/pages/GroupManagementV2/GroupManagementV2.css`
- `trip-manager/frontend/src/pages/GroupEditV2/index.jsx`
- `trip-manager/frontend/src/pages/GroupEditV2/GroupEditV2.css`
- `trip-manager/frontend/src/pages/GroupEditV2/GroupInfoSimple.jsx`
- `trip-manager/frontend/src/pages/GroupEditV2/ScheduleManagement.jsx`
- `trip-manager/frontend/src/pages/GroupEditV2/ScheduleDetail.jsx`

