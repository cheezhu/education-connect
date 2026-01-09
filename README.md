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

## 备注
- 当前数据为内存存储，重启服务后会重置。
- 生产部署可按需接入数据库与权限系统。

## 日历详情与行程设计器互通规则
### 1) 数据模型与绑定
- **schedule**: 详细日程，精确到日期与开始/结束时间（date + startTime/endTime）。
- **activity**: 行程设计器活动，按时间段（MORNING/AFTERNOON/EVENING）。
- **绑定键**: `activities.schedule_id` 关联对应的 schedule，用于避免重复生成与互相覆盖。

### 2) schedule -> activity (日历详情同步到行程设计器)
- **触发点**: 日历详情保存（batch 保存 schedules）。
- **时间段映射**: 按 schedule.startTime 映射为 timeSlot。
  - 06:00-11:59 -> MORNING
  - 12:00-17:59 -> AFTERNOON
  - 18:00-23:59 -> EVENING
- **字段映射**:
  - schedule.id -> activity.schedule_id
  - schedule.group_id -> activity.group_id
  - schedule.location_id -> activity.location_id
  - schedule.activity_date -> activity.activity_date
  - timeSlot 由 startTime 推导
  - participantCount = group.student_count + group.teacher_count
- **增改逻辑**:
  - 若存在 activity.schedule_id = schedule.id -> 更新该 activity
  - 若不存在 -> 新建 activity
- **删除逻辑**:
  - 若 schedule 被删除，则删除关联的 activity

### 3) activity -> schedule (行程设计器同步到日历详情)
- **触发点**: 行程设计器创建/更新/删除 activity。
- **默认时间段**:
  - MORNING -> 09:00-11:30
  - AFTERNOON -> 14:00-17:00
  - EVENING -> 19:00-21:00
- **冲突处理**:
  - 若当日已有 schedule，则把新日程放到**当日最后一个活动之后**
  - 新日程时长固定为 **1 小时**
  - 允许超过当天结束时间（不自动换天）
- **字段映射**:
  - activity.schedule_id -> schedule.id (若已存在则更新)
  - activity.group_id -> schedule.group_id
  - activity.activity_date -> schedule.activity_date
  - timeSlot -> 默认起止时间（如发生冲突则用追加规则）
  - activity.location_id -> schedule.location_id
  - title 优先地点名，兜底为团组名或 "行程活动"
  - location 使用地点名
  - type 默认 "visit"
  - color 默认团组色
- **删除逻辑**:
  - 删除 activity 时，删除关联 schedule（若有 schedule_id）

### 4) 额外说明
- schedule 与 activity 的关系为 1:1（通过 schedule_id 绑定），但允许同一团组同一时间段存在多个 activity。
- 若 schedule.location_id 为空，activity 仍会创建，但地点为空，后续可在行程设计器补充。

## V1.91
- 后端改为使用 `better-sqlite3` 与现有路由同步写法一致。
- 数据库结构调整：补充 `end_date`、地点可为空、时间段使用 `MORNING/AFTERNOON/EVENING`。
- 新增 `GET /api/activities/raw` 以支持团组管理与行程设计器的数据源。
- 修复 V2 “查看详情”与“新建后跳转”路径问题。
- 统计页兼容新的时间段标签显示。
