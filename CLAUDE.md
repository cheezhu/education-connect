# Education Connect - 研学行程管理系统

## 项目概述

Education Connect 是一个专为香港研学团组设计的行程管理系统，支持多团组并发管理、可视化日历、拖拽操作、当日时间线显示和冲突检测。

## 最新更新 (2025年1月)

### 数据库架构升级
- **全面迁移到数据库**: 从内存存储迁移到 SQLite + Prisma ORM
- **统一命名规范**: 全栈采用 camelCase 命名规则
- **主题包功能**: 新增教育资源管理和主题包系统

### UI/UX 重大升级
- **导航布局改版**: 从左侧边栏改为顶部紧凑导航栏（仅42px高度）
- **品牌更新**: 系统更名为 "Education Connect" (简称 EC)
- **空间优化**: 内容区域占比提升至 95.8%
- **导航菜单优化**:
  - 调整为: 团组管理 → 行程设计器 → 日历视图 → 教育资源 → 统计报表
  - 纯文字设计，移除图标
  - 简化右侧操作区，仅保留设置和用户信息

## 命名规范

### 统一命名规则
项目全栈采用 **camelCase** 命名规范，确保前后端数据一致性。

| 类型 | 规范 | 示例 |
|------|------|------|
| **变量/字段** | camelCase | `studentCount`, `startDate`, `contactPerson` |
| **布尔值** | is/has前缀 | `isActive`, `hasCompleted`, `isBaseActivity` |
| **常量/枚举值** | UPPER_CASE | `MORNING`, `AFTERNOON`, `PENDING` |
| **数据库表名** | snake_case复数 | `groups`, `theme_packages`, `educational_resources` |
| **数据库字段** | snake_case (通过@map映射) | `student_count`, `start_date` |
| **API路径** | kebab-case | `/api/theme-packages`, `/api/educational-resources` |
| **文件名** | kebab-case | `theme-package-service.js`, `group-edit-v2.jsx` |

### Prisma 映射示例
```prisma
model Group {
  id            Int      @id @default(autoincrement())
  name          String
  type          String
  studentCount  Int      @map("student_count")
  teacherCount  Int      @map("teacher_count")
  startDate     DateTime @map("start_date")
  endDate       DateTime @map("end_date")
  contactPerson String?  @map("contact_person")
  contactPhone  String?  @map("contact_phone")
  themePackageId Int?    @map("theme_package_id")

  @@map("groups")  // 表名映射
}
```

### API 数据格式
```javascript
// ✅ 统一的 camelCase 格式
{
  id: 1,
  name: "深圳实验学校小学部",
  type: "primary",
  studentCount: 40,        // 不再使用 student_count
  teacherCount: 4,         // 不再使用 teacher_count
  startDate: "2025-09-12", // 不再使用 start_date
  endDate: "2025-09-16",   // 不再使用 end_date
  contactPerson: "张老师",  // 不再使用 contact_person
  contactPhone: "13800138000",
  themePackageId: 1,       // 新增：关联主题包
  notes: ""
}
```

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




## V1.8.3版本更新 - 拖拽流畅性优化

### 已解决的拖拽问题 ✅
1. **虚线指示器被阻拦问题** (已修复):
   - **解决方案**: 通过z-index层级管理解决
     - 虚线框指示器：z-index = 15（最高层）
     - 正常活动卡片：z-index = 10（中间层）
     - 拖拽中的活动：z-index = 0（最底层，配合0.05透明度）
   - **优化效果**: 拖拽大卡片时流畅度显著提升，虚线框始终可见

2. **拖拽状态管理** (已优化):
   - 拖拽中活动设置 `draggable=false` 防止重复拖拽
   - 移除不必要的事件阻止，让拖拽事件正常传播
   - 拖拽中活动极简化显示（opacity: 0.05，内容隐藏）

## V1.8.4版本规划 - 教育资源管理系统

### 🎯 核心目标
将现有的简单资源管理升级为完整的教育资源组合包系统，支持灵活的资源编组和团组关联应用。

### 📚 教育资源管理

#### 1. 单一教育资源（简化版）
```javascript
const educationalResource = {
  id: 'resource_001',
  name: '香港科学馆',
  type: 'museum',  // museum, park, university, cultural
  category: 'science',  // science, history, culture, nature
  description: '展示各种科学原理的互动博物馆',
  location: '尖沙咀东部科学馆道2号',
  duration: 3,  // 建议时长(小时)
  ageGroups: ['primary', 'secondary'],  // 适用年龄
  highlights: [  // 亮点特色
    '互动物理实验',
    '科学原理展示',
    '团队探索活动'
  ],
  image: '/images/science_museum.jpg',
  status: 'active'
};
```

#### 2. 资源组合包系统
```javascript
const themePackage = {
  id: 'theme_001',
  name: '科技探索之旅',
  description: '专注科技创新的学习体验',
  resources: [  // 包含的资源ID列表
    'resource_001',  // 香港科学馆
    'resource_002',  // 香港太空馆
    'resource_003'   // 数码港
  ],
  createdAt: '2024-09-21',
  status: 'active'
};
```

#### 3. 团组关联
```javascript
// 团组信息新增字段
const groupInfo = {
  // ... 原有团组信息
  themePackageId: 'theme_001',  // 关联的主题包ID
};
```

### 🖥️ 界面设计

#### A. 教育资源管理页面（卡片式）
- **资源库展示**: 卡片形式展示所有教育资源
- **筛选功能**: 按类型、分类、适用年龄筛选
- **快速操作**: 每个资源卡片支持编辑和"加入包"操作

#### B. 主题包管理页面
- **包概览**: 展示所有已创建的主题包
- **创建工具**: 简化的拖拽式包创建界面
- **使用统计**: 显示每个包的使用情况和受欢迎程度

#### C. 主题包创建界面
```
基本信息设置 → 资源选择（左侧资源库，右侧我的包） → 保存发布
```

#### D. 团组信息集成
- **主题包选择**: 在团组信息中选择对应的主题包ID
- **一键应用**: 主题包可直接应用到团组日历
- **包内容预览**: 显示选择包的详细内容和适用性

### 📅 日历详情展示（卡片模式）

#### 核心设计原则
- **卡片形式**: 每个资源都是独立的信息卡片
- **信息完整**: 显示资源的所有关键信息
- **时间可编辑**: 在卡片中直接调整时间安排
- **来源标识**: 清楚标示资源来自哪个主题包

#### 日历卡片展示示例
```
┌─────────── 日历详情 - 9月20日 ──────────┐
│ 团组: 深圳实验学校五年级                │
│ 主题包: 科技探索之旅 (theme_001)        │
├───────────────────────────────────────┤
│ 📦 今日资源安排                        │
│                                       │
│ ┌────────────────────────────────────┐ │
│ │ 🏛️ 香港科学馆                      │ │
│ │ 📍 尖沙咀东部科学馆道2号            │ │
│ │ ⏰ 建议时长: 3小时                  │ │
│ │ 🎯 科学教育                        │ │
│ │                                    │ │
│ │ 亮点特色:                          │ │
│ │ • 互动物理实验                     │ │
│ │ • 科学原理展示                     │ │
│ │ • 团队探索活动                     │ │
│ │                                    │ │
│ │ 适用: 小学+中学 👥 44人参与         │ │
│ │ 🕘 时间安排: [09:00] - [12:00]     │ │
│ │ [✏️ 编辑时间] [📋 查看详情]         │ │
│ └────────────────────────────────────┘ │
│ (其他资源卡片...)                      │
│ 📊 今日统计: 3个资源 | 总时长: 7小时   │
└───────────────────────────────────────┘
```

### 🗄️ 数据库设计

#### 简化的表结构
```sql
-- 教育资源表（简化版）
CREATE TABLE educational_resources (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50),
  category VARCHAR(50),
  description TEXT,
  location VARCHAR(200),
  duration DECIMAL(3,1),
  age_groups JSON,
  highlights JSON,
  image_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'active'
);

-- 主题包表
CREATE TABLE theme_packages (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  resources JSON,  -- 存储资源ID数组
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active'
);

-- 团组表（新增字段）
ALTER TABLE groups ADD COLUMN theme_package_id VARCHAR(50);
```

### 🔧 核心功能实现

#### 1. 资源管理
- 教育资源的增删改查
- 资源卡片的搜索和筛选
- 资源状态管理（启用/禁用）

#### 2. 主题包管理
- 主题包的创建、编辑、复制
- 资源的添加和移除
- 主题包使用统计

#### 3. 团组关联
- 团组选择主题包
- 主题包应用到日历
- 日历中的卡片式资源展示

#### 4. 日历集成
- 根据团组的themePackageId获取资源列表
- 将每个资源转换为日历中的卡片
- 支持在卡片中编辑时间安排
- 保持与现有日历拖拽功能的兼容性

### 🎯 实施优先级

**Phase 1**: 基础资源管理
- 创建educational_resources表和管理界面
- 实现资源的增删改查功能

**Phase 2**: 主题包系统
- 创建theme_packages表和管理界面
- 实现主题包创建和编辑功能

**Phase 3**: 团组集成
- 团组信息中添加主题包选择
- 实现主题包到日历的应用逻辑

**Phase 4**: 日历优化
- 优化日历详情的卡片展示
- 确保与现有拖拽功能的完美集成

### 📋 技术要点

1. **保持简洁**: 避免过度复杂的功能，专注核心需求
2. **向后兼容**: 确保不影响现有的日历拖拽功能
3. **数据一致性**: 主题包变更时正确更新相关团组的日历
4. **用户体验**: 直观的卡片操作和清晰的信息展示
5. **扩展性**: 为未来的功能扩展预留接口

## 扩展计划

1. **数据库集成**: 替换内存存储为SQLite/PostgreSQL
2. **用户权限**: 添加多角色权限管理
3. **导出功能**: 支持Excel/PDF格式导出
4. **移动端适配**: 响应式设计优化
5. **实时协作**: WebSocket支持多用户实时编辑

---

💡 **提示**: 使用 `/check-system` 检查系统状态，使用 `/add-group` 快速添加团组