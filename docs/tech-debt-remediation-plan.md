# 技术债务深度清理计划（2026-02）

适用范围：`trip-manager`，重点模块为 `GroupManagementV2`、`CalendarDetailWorkspace`、`ItineraryDesigner`、后端核心 routes/services。

## 1. 目标

- 上线稳定性优先：先处理会导致崩溃、500、数据丢失的问题。
- 可维护性提升：减少超大组件、隐式耦合、散落文案与规则。
- 可回滚可验证：每一步独立提交，统一经过脚本化校验。

## 2. 执行原则

- 小步快跑：每个批次都能独立发布与回滚。
- 先护栏后重构：先补测试与校验，再拆结构。
- 单一事实源：资源类型、时间规则、文案尽量收敛到 `domain` 层。

## 3. 当前基线

- `trip-manager/scripts/verify.ps1` 已串联：
  - `domain-selftest`
  - `backend-routes-selftest`
  - `scan-garbled`
  - frontend `lint/test/build`
- 关键 hooks 已拆分并有回归测试（Calendar Detail / Group Management）。
- 团组管理与日历详情核心功能可通过自动验证。

## 4. 风险分层

### P0（必须优先）

- 保存链路的参数校验与冲突处理一致性。
- 接口写入安全（防止非预期结构污染数据库）。
- 并发编辑与锁冲突时的回滚和提示完整性。

### P1（近期处理）

- 文案与编码一致性（消除 `\uXXXX` 直出与历史乱码影响）。
- 前后端规则统一（资源来源、时间段、状态文案）。
- 可观测性补齐（保存失败率、冲突率、回滚触发率）。

### P2（结构债）

- 持续拆分巨型组件与巨型 route/service 文件。
- 减少跨模块直接依赖，强化 hooks/domain 边界。
- CSS 按 feature/tab 切块，降低样式互相覆盖。

### P3（运维与治理）

- 凭证与敏感配置治理。
- 发布前检查清单固化（本地脚本与 CI 对齐）。

## 5. 阶段计划

### Phase A：稳定性加固（已完成）

- [x] `schedules/batch` 日期、时间、时序校验。
- [x] `schedules/batch` 限制 schedule id 复用范围。
- [x] `locations` 结构校验（营业时间/闭馆日期）。
- [x] 编辑锁接口权限与空用户防御。
- [x] 团组管理与日历保存失败回滚机制。

### Phase B：编码与文案治理（进行中）

- [x] 启动日志与关键错误文案清理。
- [x] 团组类型归一化逻辑收敛。
- [x] 关键常量文案从转义形式改为可读文本。
- [x] 引入前端统一文本解码工具（兼容历史脏数据）。
- [ ] 清理剩余业务层散落文案与重复状态定义。

### Phase C：结构重构（进行中）

- [~] `CalendarDetailWorkspace` 持续拆分（已拆核心 hooks，继续下沉组合层）。
- [ ] `LocationManagement` 拆分数据层与展示层。
- [ ] `backend/src/routes/planning.js` 拆分为 controller + service。
- [ ] `LogisticsSpreadsheet` 与 `DayLogisticsCard` 共享规则抽取。

### Phase D：发布门禁与运维（进行中）

- [x] 本地一键验证门禁脚本。
- [ ] 发布前/回滚 checklist 模板。
- [ ] 凭证与敏感信息治理方案落地。

## 6. 最近执行顺序建议

1. 继续清理 P1：统一文案、状态、来源标签定义。
2. 继续清理 P2：完成 `CalendarDetailWorkspace` 组合层拆分。
3. 拆分 `LocationManagement` 的数据/视图耦合。
4. 拆分 `planning` 后端 route，补路由级单测。

## 7. 上线前强制检查

每次上线前执行：

```powershell
powershell -ExecutionPolicy Bypass -File trip-manager/scripts/verify.ps1
```

通过标准：

- lint 全绿
- test 全绿
- selftest 全绿
- build 成功

## 8. 回滚策略

- 每个重构批次保持行为等价，不混入大规模 UI 改版。
- 每阶段结束打稳定标签，支持快速回退。
- 线上异常优先阶段回滚，禁止线上临时大修。
