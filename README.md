# Education Connect（研学行程管理系统）

面向香港研学团组的行程管理系统，支持多团组并发管理、可视化日历、拖拽排期与冲突检测。V1 版本稳定运行，V2 以渐进方式迭代，不影响既有功能。

## 项目亮点
- 多团组行程可视化排期（拖拽式日历/时间线）
- 活动冲突检测（时间、容量、日期与团组类型约束）
- 行程资源管理与统计报表
- V1/V2 并行演进，统一数据源

## 技术栈
- 前端：React 18 + Vite + Ant Design + FullCalendar
- 后端：Node.js + Express
- 数据：内存存储（演示版本）
- 认证：HTTP Basic Auth

## 目录结构
```
education-connect/
├── trip-manager/            # 主应用（前端 + 后端）
├── V2/                      # V2 需求/方案文档
├── future/                  # 未来规划
├── Studio_Field_架构设计/    # 架构设计资料
├── .claude/                 # Claude 命令与配置
├── CLAUDE.md                # 项目概览
├── 项目架构和运行原理详解.md
├── 项目前后端交互详解.md
├── CALENDAR_TECHNICAL_GUIDE.md
└── 测试服务器使用说明.md
```

## 快速开始

前置：Node.js 16+、npm（或 yarn）

1) 启动后端
```bash
cd trip-manager/backend
npm install
node simple-server.js
```

2) 启动前端（新终端）
```bash
cd trip-manager/frontend
npm install
npm run dev
```

3) 访问系统
- 前端：http://localhost:5173
- 后端：http://localhost:3001
- 默认账号：`admin` / `admin123`

## 版本与页面说明
- V1 以 `trip-manager/frontend` 为主，日历核心组件为 `DragDropTable`。
- V2 在前端页面逐步替换，日历编辑器核心为 `CalendarDaysView`。

## 重要文档
- 项目总览：`CLAUDE.md`
- 架构与运行原理：`项目架构和运行原理详解.md`
- 前后端交互：`项目前后端交互详解.md`
- 日历技术细节：`CALENDAR_TECHNICAL_GUIDE.md`
- 测试服务器：`测试服务器使用说明.md`

- 


## V1.91
- 后端改为使用 `better-sqlite3` 与现有路由同步写法一致。
- 数据库结构调整：补充 `end_date`、地点可为空、时间段使用 `MORNING/AFTERNOON/EVENING`。
- 新增 `GET /api/activities/raw` 以支持团组管理与行程设计器的数据源。
- 修复 V2 “查看详情”与“新建后跳转”路径问题。
- 统计页兼容新的时间段标签显示。

### V1.93

行程资源页面优化

在现有行程的地点的情况下，增加 “行程方案”，可以自由组合不同行程点。

在团组信息中可以选择行程方案

日历详情 中，行程资源中对应的 就是 “行程方案”

团组管理V2界面修改
