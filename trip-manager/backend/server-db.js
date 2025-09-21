const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// JWT密钥（生产环境应使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 转换层已移除 - 现在前后端统一使用 camelCase

// 中间件
app.use(cors());
app.use(express.json());

// JWT验证中间件（兼容基础认证）
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  // 首先检查是否是基础认证
  if (authHeader && authHeader.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    if (username === 'admin' && password === 'admin123') {
      req.user = { id: 1, username: 'admin', role: 'admin' };
      return next();
    }
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  // 然后检查JWT token
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: '需要认证' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: '无效的token' });
    req.user = user;
    next();
  });
};

// ==================== 认证相关 API ====================

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// ==================== 团组相关 API ====================

// 获取所有团组
app.get('/api/groups', authenticateToken, async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        themePackage: true,
        activities: true,
        members: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: '获取团组失败' });
  }
});

// 获取单个团组
app.get('/api/groups/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const group = await prisma.group.findUnique({
      where: { id: parseInt(id) },
      include: {
        themePackage: {
          include: {
            resources: {
              include: {
                resource: true
              }
            }
          }
        },
        activities: true,
        schedules: true,
        members: {
          orderBy: [
            { role: 'desc' },
            { name: 'asc' }
          ]
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: '团组不存在' });
    }

    res.json(group);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: '获取团组失败' });
  }
});

// 创建团组
app.post('/api/groups', authenticateToken, async (req, res) => {
  try {
    const groupData = {
      ...req.body,
      createdBy: req.user.id
    };

    // 移除前端传递的临时字段
    delete groupData.members;  // members字段在数据库中不存在
    delete groupData.schedules;  // schedules字段需要通过关联而非直接字段

    console.log('Creating group with data:', groupData);

    const group = await prisma.group.create({
      data: groupData,
      include: {
        themePackage: true
      }
    });

    res.json({ success: true, group });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: '创建团组失败' });
  }
});

// 更新团组
app.put('/api/groups/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 移除不应该更新的字段
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.createdBy;
    delete updateData.members;  // members字段在数据库中不存在
    delete updateData.schedules;  // schedules字段需要通过关联而非直接字段
    delete updateData.tags;  // tags字段在Group模型中不存在
    delete updateData.activities;  // activities字段需要通过关联而非直接字段
    delete updateData.themePackage;  // themePackage是关联字段，不是数据字段

    console.log('🔄 Updating group with ID:', id);
    console.log('📤 Update data:', JSON.stringify(updateData, null, 2));

    const group = await prisma.group.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        themePackage: true
      }
    });

    console.log('✅ Group updated successfully:', {
      id: group.id,
      name: group.name,
      updatedAt: group.updatedAt
    });

    res.json({ success: true, group });
  } catch (error) {
    console.error('❌ Update group error:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    res.status(500).json({ error: '更新团组失败', details: error.message });
  }
});

// 删除团组
app.delete('/api/groups/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.group.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: '删除团组失败' });
  }
});

// ==================== 活动相关 API ====================

// 获取团组的活动
app.get('/api/groups/:groupId/activities', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;

    const activities = await prisma.activity.findMany({
      where: { groupId: parseInt(groupId) },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' }
      ]
    });

    res.json(activities);
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: '获取活动失败' });
  }
});

// 批量更新活动
app.put('/api/groups/:groupId/activities', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const activities = req.body;

    // 删除旧活动
    await prisma.activity.deleteMany({
      where: {
        groupId: parseInt(groupId),
        isBaseActivity: false
      }
    });

    // 创建新活动
    if (activities && activities.length > 0) {
      const newActivities = await prisma.activity.createMany({
        data: activities.map(activity => ({
          ...activity,
          groupId: parseInt(groupId),
          scheduleId: activity.scheduleId || null
        }))
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update activities error:', error);
    res.status(500).json({ error: '更新活动失败' });
  }
});

// ==================== 教育资源相关 API ====================

// 获取所有教育资源
app.get('/api/educational-resources', authenticateToken, async (req, res) => {
  try {
    const resources = await prisma.educationalResource.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' }
    });
    res.json(resources);
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ error: '获取资源失败' });
  }
});

// 创建教育资源
app.post('/api/educational-resources', authenticateToken, async (req, res) => {
  try {
    const resourceData = req.body;
    const resource = await prisma.educationalResource.create({
      data: resourceData
    });
    res.json({ success: true, resource });
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({ error: '创建资源失败' });
  }
});

// 更新教育资源
app.put('/api/educational-resources/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const resource = await prisma.educationalResource.update({
      where: { id },
      data: updateData
    });
    res.json({ success: true, resource });
  } catch (error) {
    console.error('Update resource error:', error);
    res.status(500).json({ error: '更新资源失败' });
  }
});

// 删除教育资源
app.delete('/api/educational-resources/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.educationalResource.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ error: '删除资源失败' });
  }
});

// ==================== 主题包相关 API ====================

// 获取所有主题包
app.get('/api/theme-packages', authenticateToken, async (req, res) => {
  try {
    const packages = await prisma.themePackage.findMany({
      where: { status: 'active' },
      include: {
        resources: {
          include: {
            resource: true
          }
        },
        _count: {
          select: { groups: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 格式化响应并解析JSON字段
    const formattedPackages = packages.map(pkg => ({
      ...pkg,
      tags: typeof pkg.tags === 'string' ? JSON.parse(pkg.tags) : pkg.tags,
      resourceCount: pkg.resources.length,
      totalDuration: pkg.resources.reduce((sum, r) => sum + r.resource.duration, 0),
      usageCount: pkg._count.groups,
      resources: pkg.resources.map(r => r.resourceId)
    }));

    res.json(formattedPackages);
  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({ error: '获取主题包失败' });
  }
});

// 获取单个主题包
app.get('/api/theme-packages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const themePackage = await prisma.themePackage.findUnique({
      where: { id },
      include: {
        resources: {
          include: {
            resource: true
          },
          orderBy: {
            sortOrder: 'asc'
          }
        }
      }
    });

    if (!themePackage) {
      return res.status(404).json({ error: '主题包不存在' });
    }

    res.json(themePackage);
  } catch (error) {
    console.error('Get package error:', error);
    res.status(500).json({ error: '获取主题包失败' });
  }
});

// 创建主题包
app.post('/api/theme-packages', authenticateToken, async (req, res) => {
  try {
    const requestData = req.body;
    const { name, description, tags, resources } = requestData;

    const createData = {
      name,
      description,
      tags: tags ? JSON.stringify(tags) : null
    };

    // 只有当resources数组不为空时才添加关联
    if (resources && resources.length > 0) {
      createData.resources = {
        create: resources.map((resourceId, index) => ({
          resourceId,
          sortOrder: index
        }))
      };
    }

    const themePackage = await prisma.themePackage.create({
      data: createData,
      include: {
        resources: {
          include: {
            resource: true
          }
        }
      }
    });

    res.json({ success: true, themePackage });
  } catch (error) {
    console.error('Create package error:', error);
    res.status(500).json({ error: '创建主题包失败' });
  }
});

// 更新主题包
app.put('/api/theme-packages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const requestData = req.body;
    const { name, description, tags, resources } = requestData;

    // 先删除旧的资源关联
    await prisma.themePackageResource.deleteMany({
      where: { themePackageId: id }
    });

    // 更新主题包并创建新的资源关联
    const updateData = {
      name,
      description,
      tags: tags ? JSON.stringify(tags) : null
    };

    // 只有当resources数组不为空时才添加关联
    if (resources && resources.length > 0) {
      updateData.resources = {
        create: resources.map((resourceId, index) => ({
          resourceId,
          sortOrder: index
        }))
      };
    }

    const themePackage = await prisma.themePackage.update({
      where: { id },
      data: updateData,
      include: {
        resources: {
          include: {
            resource: true
          }
        }
      }
    });

    res.json({ success: true, themePackage });
  } catch (error) {
    console.error('Update package error:', error);
    res.status(500).json({ error: '更新主题包失败' });
  }
});

// 删除主题包
app.delete('/api/theme-packages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.themePackage.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({ error: '删除主题包失败' });
  }
});

// ==================== 团员相关 API ====================

// 获取团组的团员列表
app.get('/api/groups/:groupId/members', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const members = await prisma.member.findMany({
      where: { groupId: parseInt(groupId) },
      orderBy: [
        { role: 'desc' }, // teacher first
        { name: 'asc' }
      ]
    });
    res.json(members);
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: '获取团员列表失败' });
  }
});

// 创建团员
app.post('/api/groups/:groupId/members', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const member = await prisma.member.create({
      data: {
        ...req.body,
        groupId: parseInt(groupId)
      }
    });
    res.json({ success: true, member });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: '创建团员失败' });
  }
});

// 批量创建团员
app.post('/api/groups/:groupId/members/batch', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { members } = req.body;

    const createdMembers = await prisma.member.createMany({
      data: members.map(member => ({
        ...member,
        groupId: parseInt(groupId)
      }))
    });

    res.json({ success: true, count: createdMembers.count });
  } catch (error) {
    console.error('Batch create members error:', error);
    res.status(500).json({ error: '批量创建团员失败' });
  }
});

// 更新团员
app.put('/api/members/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const member = await prisma.member.update({
      where: { id: parseInt(id) },
      data: req.body
    });
    res.json({ success: true, member });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: '更新团员失败' });
  }
});

// 删除团员
app.delete('/api/members/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.member.delete({
      where: { id: parseInt(id) }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ error: '删除团员失败' });
  }
});

// ==================== 地点相关 API (兼容旧版) ====================

app.get('/api/locations', authenticateToken, async (req, res) => {
  res.json([]); // 返回空数组以保持兼容
});

// ==================== 其他 API ====================

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'sqlite',
    timestamp: new Date().toISOString()
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // 测试数据库连接
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    app.listen(PORT, () => {
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
      console.log('📦 使用 SQLite 数据库');
      console.log('🔑 默认管理员账号: admin / admin123');
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();