# planning_result 导入前端交互流程（状态机草案）

> 目标：为前端实现提供清晰的交互状态与异常处理路径。

---

## 1) 状态机概览

```
[Idle]
  └─ 点击“导入排程结果(JSON)” → [ModalOpen]

[ModalOpen]
  ├─ 上传文件 → [Parsing]
  ├─ 取消 → [Idle]

[Parsing]
  ├─ 解析成功 → [PreviewReady]
  └─ 解析失败 → [ParseError]

[ParseError]
  ├─ 重新上传 → [Parsing]
  └─ 取消 → [Idle]

[PreviewReady]
  ├─ 点击“校验/预览” → [Validating]
  ├─ 取消 → [Idle]

[Validating]
  ├─ 无冲突 → [ReadyToImport]
  ├─ 有冲突 + skipConflicts=true → [ReadyToImportWithWarnings]
  └─ 严重错误 → [ValidationError]

[ValidationError]
  ├─ 修改选项/重新上传 → [Parsing]
  └─ 取消 → [Idle]

[ReadyToImport]
  ├─ 点击“导入” → [Importing]
  └─ 取消 → [Idle]

[ReadyToImportWithWarnings]
  ├─ 用户确认继续 → [Importing]
  └─ 用户取消 → [Idle]

[Importing]
  ├─ 成功 → [ImportSuccess]
  └─ 失败 → [ImportError]

[ImportSuccess]
  └─ 关闭 → [Idle] + refreshData()

[ImportError]
  ├─ 重试 → [Importing]
  └─ 关闭 → [Idle]
```

---

## 2) 弹窗界面结构（建议）

### Step 1：文件与选项
- 文件上传区（拖拽/点击）
- 展示解析出的基本信息（schema、range、assignment 数量）
- 选项（checkbox）：
  - 覆盖已有安排（replaceExisting）
  - 仅导入选中团组（groupIds）
  - 跳过冲突继续（skipConflicts）
  - 自动创建行程方案（createPlans）
- 下一步按钮：校验/预览

### Step 2：校验结果
- 统计卡片：
  - 可导入条目数
  - 冲突数
  - 缺失实体数
- 冲突列表（可展开）：
  - group / date / time_slot / reason
- 按钮：
  - 继续导入
  - 返回修改

---

## 3) 前端动作与 API 绑定

### 3.1 解析阶段（Parsing）
- `FileReader.readAsText` → JSON.parse
- 失败提示：message.error('文件解析失败')

### 3.2 校验阶段（Validating）
- 调用 `/api/planning/import` with `dryRun=true`
- 后端返回 `summary/conflicts`
- 若 conflicts 且 skipConflicts=false → `ValidationError`

### 3.3 导入阶段（Importing）
- 调用 `/api/planning/import` with `dryRun=false`
- 成功后：message.success + 关闭弹窗 + refreshData

---

## 4) UI 细节建议

- 上传完成后展示文件名与大小
- 若 schema 不匹配，强提示“不支持的文件格式”
- 冲突提示区可折叠，默认展示前 20 条
- 导入按钮在以下情况禁用：
  - 无 valid payload
  - 校验失败（严重错误）

---

## 5) 错误处理指引

- 解析失败：提示文件格式错误
- 校验失败：提示具体错误（缺 group/location/时间段不合法）
- 导入失败：提示“导入失败，请查看冲突或重试”

---

## 6) 提示文案建议

- “覆盖已有安排”提示：会清空范围内已有排期
- “跳过冲突继续”提示：冲突条目将不会导入
- “自动创建行程方案”提示：导入后会绑定新方案

---

## 7) 可选增强

- 导入前展示“影响范围”摘要（团组数、日期范围）
- 导入完成后弹出“查看导入报告”链接
- 提供“仅导入某一天”的高级筛选
