# 运行与初始化（Runbook）

## 环境要求
- Node.js 16+
- npm

## 初始化数据库（重置 trip.db）

```bash
cd trip-manager/backend
npm install
npm run init-db
```

说明：
- `init-db` 会删除并重建 `trip-manager/backend/db/trip.db`
- 会插入示例地点数据与默认用户（仅用于本地开发/演示）

## 启动后端

```bash
cd trip-manager/backend
npm run start
```

- 默认端口：3001

## 一键启动（推荐）

在项目根目录执行，会分别打开后端与前端两个 PowerShell 窗口：

```powershell
cd C:\Users\beney\Desktop\education-connect
powershell -ExecutionPolicy Bypass -File start-dev.ps1
```

说明：
- 后端窗口运行 `npm run dev`（nodemon），已配置监听 `trip-manager/shared` 变更，方便改共享 domain 时自动重启。
- 前端窗口运行 `npm run dev`（Vite）。

## 启动前端

```bash
cd trip-manager/frontend
npm install
npm run dev
```

- 默认端口：5173
- `/api` 会代理到 `http://localhost:3001`

## 登录（本地默认种子账号）

前端入口：`http://127.0.0.1:5173/login`

`npm run init-db` 后默认存在：
- `admin` / `admin123`（admin）
- `viewer1` / `admin123`（viewer）

注意：
- 前端不再硬编码账号密码；登录成功后会把 Basic Auth 存到 localStorage（key=`ec_basic_auth`）。
- 生产环境不要保留默认账号/默认密码（见 `docs/code-review-issues.md` 的安全项）。

## 常用命令
- 初始化数据库：`npm run init-db`
- 启动后端：`npm run start`
- 前端开发模式：`npm run dev`

## 一键自检（推荐在合并/上线前跑一次）

```powershell
cd C:\Users\beney\Desktop\education-connect\trip-manager
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
```

包含：
- shared domain 自检（时间段/资源类型不走样）
- 后端 routes 可加载自检（避免启动即崩）
- 文本损坏扫描（避免 Vite/Babel 因字符串损坏报错）
- 可选：前端 build（默认会跑）
