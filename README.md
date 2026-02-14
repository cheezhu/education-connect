# Education Connect（研学行程管理系统）

Education Connect 用于研学团组的行程与资源管理，覆盖：
- 团组管理（团组信息 / 食行卡片 / 日历详情 / 人员信息）
- 地点管理
- 行程设计器（跨团组排程与模板）
- 跨团组排程（planning 导入/导出 + 求解器）

## 快速开始（推荐）

1. 安装 Node.js（会自带 `npm`，用于安装依赖与运行脚本）。
2. 在项目根目录运行：`.\start-dev.ps1`
3. 浏览器打开：http://localhost:5173

默认账号（首次初始化 DB 后）：
- `admin` / `admin123`（管理员）
- `viewer1` / `admin123`（只读）

## 初始化数据库（需要重建数据时）

注意：会重建 `trip-manager/backend/db/trip.db`（会覆盖本地数据）。

```powershell
cd trip-manager/backend
npm install
npm run init-db
```

## 分别启动（不用脚本时）

后端：

```powershell
cd trip-manager/backend
npm install
npm run dev
```

前端：

```powershell
cd trip-manager/frontend
npm install
npm run dev
```

## 常用命令

- 一键自检（建议合并/上线前跑一次）：`.\trip-manager\scripts\verify.ps1`

## 在 backend 容器里验证求解器（CP-SAT + LNS）

```bash
docker compose build backend
docker compose run --rm -v ./trip-manager/solver-lab/examples:/data:ro backend bash -lc '/opt/solver-venv/bin/python /app/solver-lab-py/cli.py --in /data/sample-input.json --out /tmp/o.json --report /tmp/r.json --seed 42 --time 30 --workers 8 && python3 - <<PY\nimport json\nrep=json.load(open(\"/tmp/r.json\"))\nprint(rep.get(\"optimize\",{}).get(\"engine\"))\nprint(rep.get(\"optimize\",{}).get(\"diagnostics\",{}).get(\"cp_sat_used\"))\nprint(rep.get(\"optimize\",{}).get(\"diagnostics\",{}).get(\"lns_iterations\"))\nPY'
```

期望输出：
- `engine` 含 `+lns`
- `cp_sat_used` 为 `True`
- `lns_iterations` > 0

## 配置

- 认证：HTTP Basic Auth（users 表 + bcrypt）
- AI 配置（可选；当前未挂载 `/api/ai/*` 路由）
- AI 环境变量：`AI_API_KEY`（推荐）/ `AI_api_key`（兼容旧名）、`AI_PROVIDER`、`AI_MODEL`、`AI_TIMEOUT_MS`
- AI 系统配置（system_config）：`ai_api_key` / `ai_provider` / `ai_model` / `ai_timeout_ms`

## AI 助手（GroupManagementV2 AiDock / Web C2）

本项目支持在团组管理页面使用「AI 助手」对话，并可触发真实写入（如餐饮/接送/活动、成员等）。

### 链路架构（高层）

- Frontend（AiDock）→ `POST /api/c2/turn`
- Backend（Trip Manager）→ `trip-manager/backend/src/routes/c2.js`
  - **写入类指令 fast-path（默认开启）**：直接调用本机 `POST /api/agent/inject-one-shot`（使用 `x-agent-token`，不走 OpenClaw），写入速度更快。
  - 其他问答：转发到 host `c2-relay(:18791)` → OpenClaw `POST /v1/responses` → agent 回复。
- Host relay：`tools/c2-relay/server.js`（独立进程，建议用 `nohup` 先验证，稳定后再 systemd）

> 安全提示：不要在浏览器端暴露任何 OpenClaw token。relay 会从 host 的 OpenClaw 配置读取 token 并在服务端调用。

### 权限模型

- `POST /api/c2/turn`：需要 `admin`/`editor`
- viewer 用户会返回 403
- `x-agent-token`（仅服务端内部调用）命中后会把请求视为 agent 身份（`req.isAgent=true`）

### 超时/稳定性

AI 回复可能较慢，需要各层超时一致，避免 10s/60s/90s “谁先到谁先断” 的不稳定。

当前建议值（实现里已按此设置）：
- Frontend（仅 `/c2/turn`）：120s
- Nginx `/api/` 反代：`proxy_read_timeout 180s` 等
- Backend → relay：180s
- relay → OpenClaw：建议配置为 180s（见 `tools/c2-relay/README.md`）

### 运行/部署参考

- relay 说明与环境变量：见 `tools/c2-relay/README.md`
- docker compose（web+backend）：

```bash
docker compose -p education-connect up -d --build --no-deps backend web
```

- 快速验证：

```bash
# 需要 Basic auth（示例：admin/admin123）
curl -u admin:admin123 -X POST http://127.0.0.1:8080/api/c2/turn \
  -H 'content-type: application/json' \
  -d '{"groupId":22,"text":"只回复：OK"}'
```

## 文档

- 文档入口：`docs/README.md`
