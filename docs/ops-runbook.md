﻿﻿﻿﻿# 运行与初始化（Runbook）

## 环境要求
- Node.js 16+（Node 16 需安装依赖后使用 `undici` 提供 fetch）
- npm 或 yarn

## 初始化数据库
```bash
cd trip-manager/backend
npm install
npm run init-db
```
说明：`init-db` 会删除并重建 `trip.db`，并插入默认账号与地点数据。

## 启动后端
```bash
cd trip-manager/backend
npm run start
```
- 默认端口：3001

## 启动前端
```bash
cd trip-manager/frontend
npm install
npm run dev
```
- 默认端口：5173
- `/api` 会代理到 `http://localhost:3001`

## 默认账号
- 用户名：`admin`
- 密码：`admin123`

## 常用命令
- 初始化数据库：`npm run init-db`
- 启动后端：`npm run start`
- 前端开发模式：`npm run dev`

## 注意事项
- 前端 `api.js` 固定使用 `admin/admin123` Basic Auth
- 后端认证来自 `users` 表（bcrypt 校验）
- AI 功能可由环境变量或 system_config 配置（见 `docs/config-auth.md`）
