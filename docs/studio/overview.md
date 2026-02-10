# Studio（独立行程调度台）— 概览

> 目标：将“行程设计器”剥离为独立模块（Studio），先以**参数调整 + 求解 + 报告/下载**为主。
> 
> 重要约束：
> - Studio **不写回** education-connect（由用户后续“推送最佳方案”）；
> - Studio 与现有服务尽量隔离（独立前端 + 独立 `studio-api` 控制面 + OpenClaw 执行面）；
> - 仅在 Tailscale 内访问；
> - 第一阶段复用旧系统 BasicAuth（鉴权方案 A）。

## 当前阶段（Phase 0 / V0）

- `studio-frontend`：独立前端
  - 选择团组/日期范围
  - 调整策略参数（repeat/balance/missing/归集等）
  - 发起求解任务
  - 查看 run 状态/日志/报告
  - 下载 artifacts（planning_input/result/report）

- `studio-api`：独立控制面服务
  - 端口：`8090`
  - 访问：Tailscale-only
  - 鉴权：复用旧系统 BasicAuth（admin/editor/viewer）
  - 提供：创建 run、查询 run、下载 artifacts、接收 OpenClaw 回调（日志/完成）

- OpenClaw：执行面（executor）
  - 从 education-connect 读取数据（只读 API）
  - 组装 `ec-planning-input@2`
  - 调用 `solver-lab-py`（OR-Tools CP-SAT + LNS）
  - 产出 `ec-planning-result@1` + report
  - 回调 `studio-api`

## 相关文档

- 架构：`docs/studio/architecture.md`
- API：`docs/studio/api.md`
- 求解器质量规则：`docs/planning/solver-quality-rules.md`
