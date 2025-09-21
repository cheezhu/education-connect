# 命名规范转换流程图

## 数据流转全景图

```mermaid
graph TB
    subgraph "前端 Frontend"
        FE[前端组件<br/>snake_case]
        FE_API[API调用层<br/>发送 snake_case]
    end

    subgraph "后端 Backend API"
        API_IN[API接收<br/>req.body snake_case]
        CONVERT[转换层<br/>convertKeysToCamelCase]
        API_PROCESS[业务处理<br/>camelCase]
    end

    subgraph "Prisma ORM"
        PRISMA[Prisma Client<br/>camelCase]
        MAPPING[@map映射器]
    end

    subgraph "数据库 Database"
        DB[(SQLite<br/>snake_case)]
    end

    FE --> FE_API
    FE_API -->|POST/PUT| API_IN
    API_IN --> CONVERT
    CONVERT -->|转换| API_PROCESS
    API_PROCESS --> PRISMA
    PRISMA --> MAPPING
    MAPPING -->|映射| DB

    DB -->|查询结果| MAPPING
    MAPPING -->|逆映射| PRISMA
    PRISMA -->|camelCase| API_PROCESS
    API_PROCESS -->|返回数据| FE_API
    FE_API -->|camelCase| FE
```

## 创建团组请求流程

```mermaid
sequenceDiagram
    participant Frontend as 前端组件
    participant API as API层
    participant Convert as 转换函数
    participant Prisma as Prisma ORM
    participant DB as 数据库

    Frontend->>API: POST /api/groups<br/>{group_name, contact_person}
    API->>Convert: convertKeysToCamelCase(req.body)
    Convert->>Convert: snake_case → camelCase
    Convert->>API: {groupName, contactPerson}
    API->>Prisma: prisma.group.create({<br/>  groupName, contactPerson<br/>})
    Prisma->>Prisma: 应用 @map 映射
    Prisma->>DB: INSERT INTO groups<br/>(group_name, contact_person)
    DB-->>Prisma: 返回记录
    Prisma-->>API: camelCase对象
    API-->>Frontend: {groupName, contactPerson}
```

## 转换函数工作原理

```mermaid
graph LR
    subgraph "输入 Input"
        INPUT["{<br/>  group_name: '探索团',<br/>  contact_person: '张老师',<br/>  student_count: 30<br/>}"]
    end

    subgraph "转换过程 Process"
        CHECK{是对象?}
        LOOP[遍历所有键]
        TRANS[转换键名<br/>snake_case → camelCase]
        RECURSE[递归处理值]
    end

    subgraph "输出 Output"
        OUTPUT["{<br/>  groupName: '探索团',<br/>  contactPerson: '张老师',<br/>  studentCount: 30<br/>}"]
    end

    INPUT --> CHECK
    CHECK -->|是| LOOP
    LOOP --> TRANS
    TRANS --> RECURSE
    RECURSE --> OUTPUT
```

## API端点处理流程

```mermaid
flowchart TB
    START([请求到达])
    METHOD{请求方法?}

    subgraph "需要转换"
        POST[POST请求]
        PUT[PUT请求]
        CONVERT[执行转换<br/>convertKeysToCamelCase]
    end

    subgraph "不需转换"
        GET[GET请求]
        DELETE[DELETE请求]
        DIRECT[直接处理]
    end

    PRISMA[Prisma操作]
    RESPONSE([返回响应])

    START --> METHOD
    METHOD -->|POST| POST
    METHOD -->|PUT| PUT
    METHOD -->|GET| GET
    METHOD -->|DELETE| DELETE

    POST --> CONVERT
    PUT --> CONVERT
    GET --> DIRECT
    DELETE --> DIRECT

    CONVERT --> PRISMA
    DIRECT --> PRISMA
    PRISMA --> RESPONSE
```

## Prisma Schema映射示例

```mermaid
graph TB
    subgraph "Prisma Model"
        MODEL["model Group {<br/>  groupName String<br/>  contactPerson String<br/>  studentCount Int<br/>}"]
    end

    subgraph "@map 装饰器"
        MAP1["@map('group_name')"]
        MAP2["@map('contact_person')"]
        MAP3["@map('student_count')"]
        MAP4["@@map('groups')"]
    end

    subgraph "数据库表"
        TABLE["表: groups<br/>列: group_name<br/>列: contact_person<br/>列: student_count"]
    end

    MODEL --> MAP1
    MODEL --> MAP2
    MODEL --> MAP3
    MODEL --> MAP4

    MAP1 --> TABLE
    MAP2 --> TABLE
    MAP3 --> TABLE
    MAP4 --> TABLE
```

## 特殊字段处理流程

```mermaid
flowchart LR
    subgraph "前端发送"
        FRONT["{<br/>  group_name: '团组',<br/>  members: [...],<br/>  schedules: [...],<br/>  tags: ['教育']<br/>}"]
    end

    subgraph "转换处理"
        CONV[转换为camelCase]
        REMOVE[移除临时字段<br/>- members<br/>- schedules]
        JSON_CONV[JSON序列化<br/>- tags]
    end

    subgraph "Prisma接收"
        PRISMA["{<br/>  groupName: '团组',<br/>  tags: '[\"教育\"]'<br/>}"]
    end

    FRONT --> CONV
    CONV --> REMOVE
    REMOVE --> JSON_CONV
    JSON_CONV --> PRISMA
```

## 错误处理流程

```mermaid
flowchart TB
    REQ([请求到达])
    CONVERT[转换处理]
    ERROR{出现错误?}

    subgraph "错误类型"
        E1[字段验证错误]
        E2[Prisma错误]
        E3[转换错误]
    end

    LOG[记录错误日志]
    RESP_ERR[返回错误响应]
    RESP_OK[返回成功响应]

    REQ --> CONVERT
    CONVERT --> ERROR
    ERROR -->|是| E1
    ERROR -->|是| E2
    ERROR -->|是| E3
    ERROR -->|否| RESP_OK

    E1 --> LOG
    E2 --> LOG
    E3 --> LOG
    LOG --> RESP_ERR
```

## 响应数据流程（当前状态）

```mermaid
graph TB
    subgraph "数据库查询"
        DB_QUERY[SELECT * FROM groups]
        DB_RESULT[snake_case结果]
    end

    subgraph "Prisma处理"
        PRISMA_MAP[应用@map逆映射]
        PRISMA_RESULT[camelCase对象]
    end

    subgraph "API响应"
        API_RESP[直接返回camelCase]
    end

    subgraph "前端处理"
        FE_RECV[接收camelCase]
        FE_HANDLE[需要处理命名差异]
    end

    DB_QUERY --> DB_RESULT
    DB_RESULT --> PRISMA_MAP
    PRISMA_MAP --> PRISMA_RESULT
    PRISMA_RESULT --> API_RESP
    API_RESP --> FE_RECV
    FE_RECV --> FE_HANDLE

    style FE_HANDLE fill:#ffcccc
```

## 未来优化方向

```mermaid
graph LR
    subgraph "Phase 1 当前"
        P1[前端: snake_case<br/>后端: 转换层<br/>数据库: snake_case]
    end

    subgraph "Phase 2 过渡"
        P2[前端: 逐步迁移<br/>后端: 版本控制<br/>数据库: 不变]
    end

    subgraph "Phase 3 目标"
        P3[前端: camelCase<br/>后端: 原生camelCase<br/>数据库: snake_case]
    end

    P1 -->|渐进迁移| P2
    P2 -->|完成迁移| P3
```

---

## 快速参考

### 需要转换的API端点
- ✅ POST /api/groups
- ✅ PUT /api/groups/:id
- ✅ PUT /api/groups/:groupId/activities
- ✅ POST /api/educational-resources
- ✅ PUT /api/educational-resources/:id
- ✅ POST /api/theme-packages
- ✅ PUT /api/theme-packages/:id

### 不需要转换的API端点
- ⭕ GET /api/*
- ⭕ DELETE /api/*

### 关键文件位置
- 转换函数: `/backend/server-db.js:14-33`
- Prisma Schema: `/backend/prisma/schema.prisma`
- API配置: `/frontend/src/services/api.js`