# 设计方案：planning_result.json 导入（ItineraryDesigner）

> 目标：为“行程设计器”增加 planning_result.json 导入能力，提供**可预览、可校验、可选择覆盖范围**的导入流程。以下为设计方案（不含代码）。

---

## 0) 目标与边界

- **目标**：把外部排程结果导入系统，写入 activities / schedules / itinerary_plans（可选）。
- **边界**：不泄露 .env / 密钥 / 隐私数据；不重构现有核心逻辑；可按需逐步上线。

---

## 1) UI/交互设计

### 1.1 入口位置
- 位置：行程设计器右上角按钮组（与“AI 多团组生成 / 导出 / 导出排程输入包”同级）
- 按钮文案：**“导入排程结果(JSON)”**

### 1.2 弹窗流程（两步）
**Step 1：选择文件 + 基本设置**
- Upload：支持拖拽/点击选择
- 自动解析 JSON，展示：schema/version、range、group 数量
- 选项：
  - 覆盖已有安排（默认 false）
  - 仅导入选中团组（默认 true）
  - 自动生成行程方案（默认 true）

**Step 2：预览与校验**
- 展示校验概览：
  - 可导入条目数
  - 缺失团组/地点/字段
  - 冲突统计（容量/日期/团组重叠）
- 按钮：**继续导入 / 取消**

> 严重错误（缺 group/location）建议禁用导入按钮。

---

## 2) planning_result.json 合同建议

> 若外部模型产出结构不同，可做映射。

```json
{
  "schema": "ec-planning-result@1",
  "snapshot_id": "...",
  "exported_at": "...",
  "range": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" },
  "assignments": [
    {
      "group_id": 1,
      "date": "YYYY-MM-DD",
      "time_slot": "MORNING|AFTERNOON|EVENING",
      "location_id": 10,
      "participant_count": 48
    }
  ],
  "conflicts": [],
  "rules": { ... }
}
```

---

## 3) 数据写入策略（推荐后端事务）

### 3.1 写入目标
- `activities`（行程设计器数据源）
- `schedules`（团组日历详情）
- `itinerary_plans / itinerary_plan_items`（可选）

### 3.2 推荐流程（新增 `/api/planning/import`）
1) 校验 group / location 是否存在
2) 可选：删除既有安排（日期范围 + 指定团组）
3) 生成/绑定 itinerary plan（若启用）
4) 插入 schedules + activities（保持 1:1）
   - `start_time/end_time` 根据 time_slot 的 slotWindow
   - `schedules.is_from_resource = 1`
5) 返回导入结果报告（inserted/skipped/conflicts）

> 当前已有 `schedules/batch` 为**全量替换**，不适合直接导入外部结果，建议专用接口。

---

## 4) 校验策略

### 4.1 基础校验
- schema/version
- assignments 是否为数组
- 日期范围合法
- group_id / location_id 存在

### 4.2 业务校验
- time_slot 合法
- location.is_active
- target_groups 与团组类型匹配
- blocked_weekdays / closed_dates
- 容量是否超限
- 同团组同时间段重叠

### 4.3 冲突处理策略（建议）
- 默认 **拒绝导入冲突项**
- 用户可选择：
  - 丢弃冲突项继续导入
  - 全部回滚

---

## 5) 前端行为绑定

### 5.1 导入流程
1) 上传 planning_result.json
2) 本地解析 + 预览
3) 调用 `/api/planning/import`
4) 成功后刷新行程设计器数据

### 5.2 可选：导入报告下载
后端返回：
```json
{
  "inserted": 120,
  "skipped": 6,
  "conflicts": [ ... ]
}
```

---

## 6) 关键待确认事项

1) 外部模型产出的 **planning_result.json** 实际结构？
2) 是否自动创建行程方案？
3) 冲突处理策略：回滚 or 跳过？
4) 是否仅导入选中团组？是的
5) 是否必须双写 schedules + activities？只有 activities，

---

## 7) 设计产出（当前）

- 已输出本文件作为导入功能设计稿
- 后续可补充：字段映射规范、后端接口细则、前端交互稿
