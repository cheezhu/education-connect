# 服务器启动状态

## 当前运行的服务

### ✅ 主要服务（正常运行）

| 服务 | 地址 | 状态 | 描述 |
|------|------|------|------|
| **后端API服务器** | http://localhost:3002 | 🟢 运行中 | 数据库版本，使用 Prisma + SQLite |
| **前端开发服务器** | http://localhost:5173 | 🟢 运行中 | Vite 开发服务器 |
| **Prisma Studio** | http://localhost:5555 | 🟢 运行中 | 数据库管理界面 |

### 📋 启动命令

#### 后端服务
```bash
cd /Users/mac/Desktop/travel_plan/trip-manager/backend
PORT=3002 node server-db.js
```

#### 前端服务
```bash
cd /Users/mac/Desktop/travel_plan/trip-manager/frontend
npm run dev
```

#### Prisma Studio
```bash
cd /Users/mac/Desktop/travel_plan/trip-manager/backend
npx prisma studio
```

## 🔧 配置信息

### 端口配置
- **后端**: 3002
- **前端**: 5173 (Vite 默认)
- **Prisma Studio**: 5555

### 数据库
- **类型**: SQLite
- **位置**: `backend/prisma/dev.db`
- **ORM**: Prisma

### 认证信息
- **用户名**: admin
- **密码**: admin123

## 📝 最近更新

### 2025-09-21 更新日志
1. ✅ 解决了数据持久化问题
2. ✅ 重启了所有服务，清理了重复进程
3. ✅ 确认数据库连接正常
4. ✅ 前端自动保存功能正常工作
5. ✅ Prisma Studio 可正常访问数据库

### 系统状态
- **数据库连接**: ✅ 正常
- **API响应**: ✅ 正常
- **前端加载**: ✅ 正常
- **自动保存**: ✅ 正常
- **数据持久化**: ✅ 正常

## 🚨 故障排除

### 常见问题
1. **端口被占用**: 使用 `lsof -i :端口号` 检查
2. **数据不同步**: 检查是否有多个后端实例运行
3. **Prisma Studio 无法访问**: 重启服务 `npx prisma studio`

### 重启所有服务
```bash
# 1. 关闭所有进程
pkill -f "node.*server"
pkill -f "npm run dev"
pkill -f "vite"
pkill -f "prisma studio"

# 2. 启动后端
cd backend && PORT=3002 node server-db.js &

# 3. 启动前端
cd frontend && npm run dev &

# 4. 启动 Prisma Studio
cd backend && npx prisma studio &
```

---

*最后更新: 2025-09-21 19:44*