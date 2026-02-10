# Studio 架构（Studio API + OpenClaw executor）

## 目标

- 将“强互动行程资源调整工具”从现有 `trip-manager/frontend` 中剥离为独立模块。
- 先实现“参数调整 + 求解 + 报告/下载”，不写回系统。
- 与现有 education-connect 服务尽量隔离。

## 组件

### 1) studio-frontend（独立前端）

- 只与 `studio-api` 通信
- 不直接访问 OpenClaw
- 不直接写 education-connect

### 2) studio-api（控制面）

- 端口：8090
- 仅 Tailscale 内访问（UFW 只放行 100.64.0.0/10）
- 鉴权：复用 education-connect 的 BasicAuth（方案 A）
- 负责：
  - run 状态机（queued/running/success/failed）
  - logs 汇聚
  - artifacts 元数据与下载
  - 触发 OpenClaw 执行（发送任务）

### 3) OpenClaw（执行面 / executor）

执行流水线：

1. 拉取数据（只读）：groups/locations/existingAssignments（必要时可加 schedules）
2. 合并 UI 参数，组装 `ec-planning-input@2`
3. 调用 solver：`trip-manager/solver-lab-py/cli.py`
4. 生成 summary（repeats/overT1/overT2/missing/归集违规等）
5. 回调 studio-api：
   - `POST /runs/:id/logs`
   - `POST /runs/:id/complete`

### 4) education-connect（现有服务）

- 作为业务数据真相来源
- Studio V0 阶段仅读 API
- “推送最佳方案”作为后续阶段能力（会走 `/api/planning/import` + rollback）

## 安全边界

- Studio V0 不写回，降低风险
- studio-api 不暴露 OpenClaw token 给浏览器
- artifacts 永久保留（后续可加清理策略/配额）
