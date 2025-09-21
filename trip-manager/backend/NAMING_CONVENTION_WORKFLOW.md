# 命名规范工作流程文档

## 概述
系统采用渐进式命名规范迁移策略，允许前端逐步从snake_case迁移到camelCase，同时保持系统稳定运行。

## 当前数据流架构

```
前端 (snake_case) → API转换层 → Prisma (camelCase) → 数据库 (snake_case)
```

## 各层命名规范

### 1. 前端层 (Frontend)
- **当前状态**: 使用 snake_case
- **原因**: 历史遗留代码，保持兼容性
- **示例**:
  ```javascript
  {
    group_name: "香港文化探索团",
    contact_person: "张老师",
    start_date: "2024-03-15"
  }
  ```

### 2. API转换层 (Backend API)
- **位置**: `/backend/server-db.js`
- **功能**: 自动转换 snake_case → camelCase
- **实现**:
  ```javascript
  // 转换函数
  const snakeToCamel = (str) => {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  };

  const convertKeysToCamelCase = (obj) => {
    // 递归转换所有键名
  };

  // 应用于所有POST/PUT请求
  app.post('/api/groups', async (req, res) => {
    const groupData = convertKeysToCamelCase(req.body);
    // groupData 现在是 camelCase
  });
  ```

### 3. Prisma ORM层
- **命名规范**: 纯 camelCase
- **示例**:
  ```javascript
  const group = await prisma.group.create({
    data: {
      groupName: "香港文化探索团",
      contactPerson: "张老师",
      startDate: new Date("2024-03-15")
    }
  });
  ```

### 4. 数据库层 (SQLite)
- **列名**: snake_case
- **映射**: 通过 Prisma @map 装饰器
- **Schema示例**:
  ```prisma
  model Group {
    id            Int      @id @default(autoincrement())
    groupName     String   @map("group_name")
    contactPerson String   @map("contact_person")
    startDate     DateTime @map("start_date")

    @@map("groups")
  }
  ```

## 数据转换流程示例

### 创建团组请求流程

1. **前端发送** (snake_case):
   ```json
   POST /api/groups
   {
     "group_name": "科技探索团",
     "contact_person": "李老师",
     "contact_phone": "13800138000",
     "participant_count": 30
   }
   ```

2. **API层转换** (snake_case → camelCase):
   ```javascript
   // server-db.js
   const groupData = convertKeysToCamelCase(req.body);
   // 结果:
   {
     groupName: "科技探索团",
     contactPerson: "李老师",
     contactPhone: "13800138000",
     participantCount: 30
   }
   ```

3. **Prisma处理** (camelCase):
   ```javascript
   await prisma.group.create({
     data: {
       groupName: groupData.groupName,
       contactPerson: groupData.contactPerson,
       // ...
     }
   });
   ```

4. **数据库存储** (snake_case):
   ```sql
   INSERT INTO groups (group_name, contact_person, contact_phone, participant_count)
   VALUES ('科技探索团', '李老师', '13800138000', 30);
   ```

## 受影响的API端点

### 需要转换的端点
- `POST /api/groups` - 创建团组
- `PUT /api/groups/:id` - 更新团组
- `PUT /api/groups/:groupId/activities` - 批量更新活动
- `POST /api/educational-resources` - 创建教育资源
- `PUT /api/educational-resources/:id` - 更新教育资源
- `POST /api/theme-packages` - 创建主题包
- `PUT /api/theme-packages/:id` - 更新主题包

### 只读端点（不需要转换）
- 所有 GET 请求
- 所有 DELETE 请求

## 特殊处理字段

### 需要排除的字段
在转换过程中，以下字段会被自动删除：
- `members` - 前端临时字段
- `schedules` - 需通过关联表管理
- `createdAt` - 系统自动生成
- `createdBy` - 从认证信息获取

### JSON字段处理
- `tags` - 自动序列化为JSON字符串
- `ageGroups` - 自动序列化为JSON字符串
- `highlights` - 自动序列化为JSON字符串

## 迁移策略

### 当前阶段（Phase 1）
- ✅ 前端保持 snake_case
- ✅ 后端添加自动转换层
- ✅ 数据库使用 @map 映射

### 未来阶段（Phase 2）
- [ ] 逐个页面迁移前端到 camelCase
- [ ] 为已迁移的端点添加版本控制
- [ ] 保持转换层以支持旧版本

### 最终阶段（Phase 3）
- [ ] 所有前端使用 camelCase
- [ ] 移除转换层
- [ ] 统一全栈命名规范

## 优势

1. **无破坏性变更**: 前端代码无需立即修改
2. **渐进式迁移**: 可按模块逐步更新
3. **类型安全**: Prisma 提供完整类型检查
4. **维护性**: 清晰的分层和转换逻辑

## 注意事项

1. **响应数据**: 当前后端返回的数据仍是 camelCase，前端需要处理
2. **调试**: 使用 console.log 查看转换前后的数据
3. **新功能**: 建议新功能直接使用 camelCase

## 相关文件
- `/backend/server-db.js` - API转换层实现
- `/backend/prisma/schema.prisma` - 数据库映射定义
- `/frontend/src/services/api.js` - 前端API调用
- `/CLAUDE.md` - 项目命名规范文档