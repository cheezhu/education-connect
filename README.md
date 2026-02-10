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

## 文档

- 文档入口：`docs/README.md`
