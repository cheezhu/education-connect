# Education Connect - 研学行程管理系统

## 项目概述

Education Connect 是一个专为香港研学团组设计的行程管理系统，支持多团组并发管理、可视化日历、拖拽操作、当日时间线显示和冲突检测。

## 最新更新 (2025年1月)
  V2版本采用渐进式开发，不影响V1功能正常使用。
### UI/UX 重大升级
- **导航布局改版**: 从左侧边栏改为顶部紧凑导航栏（仅42px高度）
- **品牌更新**: 系统更名为 "Education Connect" (简称 EC)
- **空间优化**: 内容区域占比提升至 95.8%
- **导航菜单优化**:
  - 调整为: 团组管理 → 行程设计器 → 日历视图 → 行程资源 → 统计报表
  - 纯文字设计，移除图标
  - 简化右侧操作区，仅保留设置和用户信息

## 技术栈

### 前端 (Frontend)
- **框架**: React 18 + Vite
- **UI库**: Ant Design 5.x
- **日历**: FullCalendar 6.x
- **路由**: React Router DOM 6.x
- **HTTP客户端**: Axios
- **日期处理**: Day.js
- **端口**: http://localhost:5173

### 后端 (Backend)
- **运行时**: Node.js + Express
- **数据存储**: 内存存储 (演示版本)
- **认证**: HTTP基础认证
- **CORS**: 启用跨域支持
- **端口**: http://localhost:3001

## 项目结构

```
travel_plan/
├── trip-manager/
│   ├── frontend/                 # React前端应用
│   │   ├── src/
│   │   │   ├── components/       # 可复用组件
│   │   │   │   ├── DragDropTable.jsx    # 日历视图核心组件（拖拽表格）
│   │   │   │   └── CustomCalendar.jsx   # 自定义日历
│   │   │   ├── pages/           # 页面组件
│   │   │   │   ├── GroupManagement.jsx  # 团组管理
│   │   │   │   ├── LocationManagement.jsx # 行程资源（原地点管理）
│   │   │   │   ├── Statistics.jsx       # 统计报表
│   │   │   │   └── ItineraryDesigner.jsx # 行程设计器
│   │   │   ├── services/        # API服务
│   │   │   │   └── api.js       # HTTP请求封装
│   │   │   ├── App.jsx          # 主应用入口（顶部导航布局）
│   │   │   └── App.css          # 全局样式
│   │   ├── package.json
│   │   └── vite.config.js
│   └── backend/                 # Node.js后端服务
│       ├── simple-server.js     # 简化版服务器
│       ├── server.js           # 完整版服务器
│       └── package.json
├── .claude/                    # Claude配置
│   └── commands/              # 自定义命令
│       ├── start-project.md   # 启动项目命令
│       ├── check-system.md    # 系统检查命令
│       └── add-group.md       # 添加团组命令
└── CLAUDE.md                  # 本文件
```

## 核心功能

### 1. 团组管理
- 添加/编辑/删除研学团组
- 支持小学/中学团组类型
- 开始日期和结束日期必填，行程天数自动计算
- 颜色标识，便于在日历中区分
- 展开查看每日行程安排状态

### 2. 可视化日历（DragDropTable组件）
- **重要**: 日历视图使用DragDropTable组件而不是CalendarView组件
- 基于拖拽表格的日历界面实现
- 自动生成团组基础卡片（上午、下午时段）
- 支持拖拽调整活动时间
- 点击卡片编辑具体活动安排
- 已安排地点的活动显示地点名称，未安排显示"尚无活动"

### 3. 行程设计器 (ItineraryDesigner)
- **三栏式布局**: 左侧团组控制台、中央时间轴网格、右侧工具面板
- **时间轴网格**: 7天周视图，分为上午(9:00-12:00)、下午(14:00-17:00)、晚上(19:00-21:00)三个时段
- **团组筛选**: 支持选择/取消选择团组，实时筛选显示内容
- **拖拽编辑**: “活动卡片”支持拖拽到不同时间段，实时更新数据
- **弹层编辑**: 点击“时间格”查看详情，支持添加新活动和编辑现有活动
- **智能统计**: 右侧面板显示当前周的活动统计和快速操作按钮
- **视觉增强**: 团组颜色编码、悬停效果、工具提示、快速操作按钮
- **周导航**: 支持前后翻页查看不同周的安排

### 4. 行程资源
- 管理参访地点信息
- 设置容量限制和适用团组类型
- 配置不可用日期（如周三、周四）
- 资源调度和分配管理

### 5. 冲突检测
- 时间冲突：同一团组不能在同一时段安排多个活动
- 容量限制：参访地点容量不能超限
- 日期限制：检查地点的不可用日期
- 团组限制：检查地点是否适用于该类型团组

## 数据结构

### 团组 (Groups)
```javascript
{
  id: number,
  name: string,              // 团组名称
  type: 'primary'|'secondary', // 小学/中学
  student_count: number,     // 学生人数
  teacher_count: number,     // 老师人数
  start_date: 'YYYY-MM-DD', // 开始日期
  end_date: 'YYYY-MM-DD',   // 结束日期
  duration: number,          // 行程天数
  color: string,            // 显示颜色
  contact_person: string,   // 联系人
  contact_phone: string     // 联系电话
}
```

### 活动 (Activities)
```javascript
{
  id: number,
  groupId: number,          // 团组ID
  locationId: number|null,  // 地点ID (null表示未安排)
  date: 'YYYY-MM-DD',      // 活动日期
  timeSlot: 'MORNING'|'AFTERNOON', // 时间段
  participantCount: number, // 参与人数
  isBaseActivity: boolean   // 是否为基础活动
}
```

## 时间段设置

- **上午**: 9:00-12:00
- **下午**: 14:00-17:00
- **晚上**: 19:00-21:00 (行程设计器中使用)

## 默认数据

### 测试团组 (2025年9月)
**第一批 (9月12-16日)**:
1. 深圳实验学校小学部 (小学, 44人)
2. 广州中学 (中学, 38人)
3. 北京师范大学附属小学 (小学, 46人)
4. 上海华东师大二附中 (中学, 41人)

**第二批 (9月15-20日)**:
5. 杭州学军小学 (小学, 40人)
6. 南京师范大学附中 (中学, 44人)
7. 武汉华中师大一附小 (小学, 49人)

### 预设地点
1. 香港科学馆 (容量200人，周四不可用)
2. 香港警队博物馆 (容量100人，仅小学团组)
3. 诺亚方舟 (容量150人，周三不可用)
4. 香港海洋公园 (容量500人)
5. 西九文化区 (容量300人)
6. 香港太空馆 (容量100人)
7. 香港大学 (容量150人)
8. 驻港部队展览中心 (容量100人，仅中学团组)

## 开发指南

### 启动项目
```bash
# 启动后端
cd trip-manager/backend
node simple-server.js

# 启动前端 (新终端)
cd trip-manager/frontend
npm run dev
```

### 或使用自定义命令
```
/start-project
```

### API端点

#### 团组相关
- `GET /api/groups` - 获取所有团组
- `POST /api/groups` - 创建新团组
- `PUT /api/groups/:id` - 更新团组
- `DELETE /api/groups/:id` - 删除团组

#### 活动相关
- `GET /api/activities` - 获取所有活动
- `POST /api/activities` - 创建新活动
- `PUT /api/activities/:id` - 更新活动

#### 行程资源相关
- `GET /api/locations` - 获取所有地点资源
- `POST /api/locations` - 创建新地点资源

#### 工具API
- `POST /api/generate-base-activities` - 手动生成基础活动

### 认证信息
- 用户名: `admin`
- 密码: `admin123`

## 关键特性

### 自动化功能
1. **自动生成基础活动**: 创建团组时自动为所有日期和时段生成卡片
2. **自动计算天数**: 基于开始和结束日期自动计算行程天数
3. **实时冲突检测**: 拖拽或编辑时自动检测并提示冲突

### 用户体验
1. **始终编辑模式**: 移除编辑锁，管理员登录后直接可编辑
2. **拖拽操作**: 支持直接拖拽活动卡片调整时间
3. **智能显示**: 未安排地点只显示团组名称，已安排显示"团组-地点"

### 数据完整性
1. **防重复生成**: 避免为同一团组同一时段重复生成活动
2. **级联操作**: 删除团组时清理相关活动数据
3. **数据同步**: 前后端数据实时同步

## 常见问题

### Q: 如何添加新团组？
A: 使用 `/add-group` 命令或在团组管理页面手动添加

### Q: 为什么看不到团组卡片？
A: 检查团组日期是否正确，可使用 `/check-system` 命令验证

### Q: 如何修改时间段设置？
A: 修改 `CalendarView.jsx` 中的 `getTimeSlotLabel` 和 `businessHours` 配置，或在 `ItineraryDesigner.jsx` 中修改 `timeSlots` 数组

### Q: 行程设计器和日历视图有什么区别？
A: 日历视图(`DragDropTable`)适合总览管理，行程设计器(`ItineraryDesigner`)提供专业的时间轴界面，支持更精细的编辑和拖拽操作

### Q: 数据会持久化吗？
A: 当前版本使用内存存储，重启服务器会重置数据

## 开发注意事项

### ⚠️ 关键架构提醒
1. **导航布局**: 采用顶部紧凑导航栏（42px高度），非传统侧边栏
2. **日历视图组件**: 日历视图使用的是 `DragDropTable` 组件，不是 `CalendarView` 组件
3. **App.jsx路由**: 首页路由 "/" 使用 `<DragDropTable>` 而不是其他日历组件
4. **行程设计器**: 全新的 `ItineraryDesigner` 组件，路由为 "/designer"，提供专业的时间轴设计界面
5. **删除CalendarView**: 所有CalendarView相关代码已删除，请勿创建或引用
6. **品牌标识**: 系统名称为 "Education Connect" (简称 EC)

### 技术注意事项
5. **热更新**: Vite支持前端热更新，后端修改需重启
6. **端口冲突**: 确保3001和5173端口未被占用
7. **浏览器缓存**: 数据异常时尝试硬刷新 (Ctrl+F5)
8. **时区问题**: 所有日期使用本地时区，注意日期格式一致性
9. **拖拽功能**: 行程设计器支持HTML5拖拽API，需现代浏览器支持

## 版本控制 (Git & GitHub)

### 仓库信息
- **GitHub仓库**: https://github.com/cheezhu/education-connect
- **主分支**: main
- **仓库状态**: 已初始化并同步
- **最新提交**: Initial commit - Education Connect 研学行程管理系统

### Git配置
```bash
# 远程仓库
origin  https://github.com/cheezhu/education-connect.git

# 本地仓库路径
/Users/mac/Desktop/travel_plan/.git
```

### 版本历史
- **2025-01-15**: 初始版本发布
  - 完整V1功能实现
  - 清理所有V2测试代码
  - 保留V2需求文档供未来参考




## V1.8.1版本待改善问题

### 拖拽交互问题
1. **虚线指示器被阻拦问题**:
   - **现象**: 拖拽活动卡片经过原有位置时，虚线表示的新位置出现被阻拦情况
   - **原因分析**:
     - 拖拽开始时，原始活动仍保留在`activities`数组中
     - 位置冲突检测逻辑将原始位置视为"已占用"
     - DOM元素层级可能影响鼠标事件传递
   - **解决方案**:
     - 拖拽开始时临时从`activities`中移除原始活动
     - 冲突检测时排除正在拖拽的活动自身
     - 优化CSS层级避免原始位置干扰

2. **拖拽取消恢复机制**:
   - 需要完善拖拽取消时的活动恢复逻辑
   - 确保拖拽失败时数据一致性

### 性能优化
3. **大数据量拖拽优化**:
   - 多活动场景下的拖拽流畅度提升
   - 事件节流和防抖优化

## 扩展计划

1. **数据库集成**: 替换内存存储为SQLite/PostgreSQL
2. **用户权限**: 添加多角色权限管理
3. **导出功能**: 支持Excel/PDF格式导出
4. **移动端适配**: 响应式设计优化
5. **实时协作**: WebSocket支持多用户实时编辑

---

💡 **提示**: 使用 `/check-system` 检查系统状态，使用 `/add-group` 快速添加团组