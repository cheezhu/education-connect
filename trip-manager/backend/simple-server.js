const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 模拟数据
let groups = [
  {
    id: 1,
    name: '深圳实验学校小学部',
    type: 'primary',
    student_count: 40,
    teacher_count: 4,
    start_date: '2025-09-12',
    end_date: '2025-09-16',
    duration: 5,
    color: '#1890ff',
    contact_person: '张老师',
    contact_phone: '13800138000',
    notes: ''
  },
  {
    id: 2,
    name: '广州中学',
    type: 'secondary',
    student_count: 35,
    teacher_count: 3,
    start_date: '2025-09-12',
    end_date: '2025-09-16',
    duration: 5,
    color: '#52c41a',
    contact_person: '李老师',
    contact_phone: '13900139000',
    notes: ''
  },
  {
    id: 3,
    name: '北京师范大学附属小学',
    type: 'primary',
    student_count: 42,
    teacher_count: 4,
    start_date: '2025-09-12',
    end_date: '2025-09-16',
    duration: 5,
    color: '#722ed1',
    contact_person: '王老师',
    contact_phone: '13700137000',
    notes: ''
  },
  {
    id: 4,
    name: '上海华东师大二附中',
    type: 'secondary',
    student_count: 38,
    teacher_count: 3,
    start_date: '2025-09-12',
    end_date: '2025-09-16',
    duration: 5,
    color: '#eb2f96',
    contact_person: '陈老师',
    contact_phone: '13600136000',
    notes: ''
  },
  {
    id: 5,
    name: '杭州学军小学',
    type: 'primary',
    student_count: 36,
    teacher_count: 4,
    start_date: '2025-09-15',
    end_date: '2025-09-20',
    duration: 6,
    color: '#13c2c2',
    contact_person: '刘老师',
    contact_phone: '13500135000',
    notes: ''
  },
  {
    id: 6,
    name: '南京师范大学附中',
    type: 'secondary',
    student_count: 40,
    teacher_count: 4,
    start_date: '2025-09-15',
    end_date: '2025-09-20',
    duration: 6,
    color: '#fa541c',
    contact_person: '周老师',
    contact_phone: '13400134000',
    notes: ''
  },
  {
    id: 7,
    name: '武汉华中师大一附小',
    type: 'primary',
    student_count: 44,
    teacher_count: 5,
    start_date: '2025-09-15',
    end_date: '2025-09-20',
    duration: 6,
    color: '#fadb14',
    contact_person: '吴老师',
    contact_phone: '13300133000',
    notes: ''
  },
  {
    id: 8,
    name: '成都七中',
    type: 'secondary',
    student_count: 42,
    teacher_count: 4,
    start_date: '2024-04-08',
    duration: 6,
    color: '#a0d911',
    contact_person: '郑老师',
    contact_phone: '13200132000',
    notes: ''
  },
  {
    id: 9,
    name: '西安交大附小',
    type: 'primary',
    student_count: 38,
    teacher_count: 4,
    start_date: '2024-04-12',
    duration: 4,
    color: '#597ef7',
    contact_person: '孙老师',
    contact_phone: '13100131000',
    notes: ''
  },
  {
    id: 10,
    name: '重庆南开中学',
    type: 'secondary',
    student_count: 45,
    teacher_count: 4,
    start_date: '2024-04-15',
    duration: 5,
    color: '#ff7a45',
    contact_person: '赵老师',
    contact_phone: '13000130000',
    notes: ''
  },
  {
    id: 11,
    name: '天津实验小学',
    type: 'primary',
    student_count: 40,
    teacher_count: 4,
    start_date: '2024-04-18',
    duration: 5,
    color: '#9254de',
    contact_person: '钱老师',
    contact_phone: '12900129000',
    notes: ''
  },
  {
    id: 12,
    name: '青岛二中',
    type: 'secondary',
    student_count: 36,
    teacher_count: 3,
    start_date: '2024-04-22',
    duration: 4,
    color: '#36cfc9',
    contact_person: '冯老师',
    contact_phone: '12800128000',
    notes: ''
  }
];

let locations = [
  { id: 1, name: '香港科学馆', capacity: 200, blocked_weekdays: '4', target_groups: 'all', address: '尖沙咀科学馆道2号' },
  { id: 2, name: '香港警队博物馆', capacity: 100, blocked_weekdays: '', target_groups: 'primary', address: '山顶甘道27号' },
  { id: 3, name: '诺亚方舟', capacity: 150, blocked_weekdays: '3', target_groups: 'all', address: '新界马湾珀欣路33号' },
  { id: 4, name: '香港海洋公园', capacity: 500, blocked_weekdays: '', target_groups: 'all', address: '香港仔黄竹坑道180号' },
  { id: 5, name: '西九文化区', capacity: 300, blocked_weekdays: '', target_groups: 'all', address: '西九龙文化区' },
  { id: 6, name: '香港太空馆', capacity: 100, blocked_weekdays: '', target_groups: 'all', address: '尖沙咀梳士巴利道10号' },
  { id: 7, name: '香港大学', capacity: 150, blocked_weekdays: '', target_groups: 'all', address: '薄扶林道' },
  { id: 8, name: '驻港部队展览中心', capacity: 100, blocked_weekdays: '', target_groups: 'secondary', address: '中环军营' }
];

let activities = [
  {
    id: 1,
    groupId: 1,
    locationId: 1,
    date: '2024-03-15',
    timeSlot: 'MORNING',
    participantCount: 44,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    groupId: 1,
    locationId: 2,
    date: '2024-03-15',
    timeSlot: 'AFTERNOON',
    participantCount: 44,
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    groupId: 2,
    locationId: 3,
    date: '2024-03-20',
    timeSlot: 'MORNING',
    participantCount: 38,
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    groupId: 2,
    locationId: 4,
    date: '2024-03-20',
    timeSlot: 'AFTERNOON',
    participantCount: 38,
    created_at: new Date().toISOString()
  },
  {
    id: 5,
    groupId: 3,
    locationId: 5,
    date: '2024-03-22',
    timeSlot: 'MORNING',
    participantCount: 42,
    created_at: new Date().toISOString()
  }
];

let editLock = {
  locked_by: null,
  locked_at: null,
  expires_at: null
};

// 简单认证中间件
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    return res.status(401).json({ error: '需要认证' });
  }
  
  const credentials = Buffer.from(auth.substring(6), 'base64').toString();
  const [username, password] = credentials.split(':');
  
  if (username === 'admin' && password === 'admin123') {
    req.user = username;
    next();
  } else {
    res.status(401).json({ error: '认证失败' });
  }
});

// 编辑锁路由
app.get('/api/lock/status', (req, res) => {
  const now = new Date();
  const isExpired = editLock.expires_at && new Date(editLock.expires_at) < now;
  
  if (isExpired) {
    editLock = { locked_by: null, locked_at: null, expires_at: null };
    return res.json({ isLocked: false, canEdit: req.user === 'admin' });
  }
  
  res.json({
    isLocked: !!editLock.locked_by,
    lockedBy: editLock.locked_by,
    expiresAt: editLock.expires_at,
    canEdit: editLock.locked_by === req.user || !editLock.locked_by
  });
});

app.post('/api/lock/acquire', (req, res) => {
  if (req.user !== 'admin') {
    return res.status(403).json({ success: false, message: '只有管理员可以编辑' });
  }
  
  const now = new Date();
  if (editLock.locked_by && new Date(editLock.expires_at) > now) {
    if (editLock.locked_by === req.user) {
      const newExpiry = new Date(Date.now() + 5 * 60 * 1000);
      editLock.expires_at = newExpiry.toISOString();
      return res.json({ success: true, expiresAt: newExpiry });
    }
    return res.json({ success: false, message: `${editLock.locked_by} 正在编辑，请稍后再试` });
  }
  
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  editLock = {
    locked_by: req.user,
    locked_at: now.toISOString(),
    expires_at: expiresAt.toISOString()
  };
  
  res.json({ success: true, expiresAt });
});

app.post('/api/lock/release', (req, res) => {
  if (editLock.locked_by === req.user) {
    editLock = { locked_by: null, locked_at: null, expires_at: null };
    res.json({ success: true, message: '已退出编辑模式' });
  } else {
    res.json({ success: false, message: '您未持有编辑锁' });
  }
});

app.post('/api/lock/renew', (req, res) => {
  if (editLock.locked_by !== req.user) {
    return res.status(403).json({ success: false, message: '您未持有编辑锁' });
  }
  
  const newExpiry = new Date(Date.now() + 5 * 60 * 1000);
  editLock.expires_at = newExpiry.toISOString();
  res.json({ success: true, expiresAt: newExpiry });
});

// 团组路由
app.get('/api/groups', (req, res) => {
  res.json(groups);
});

// 自动生成团组基础卡片的函数
function generateGroupBaseActivities(group) {
  const startDate = new Date(group.startDate || group.start_date);
  const endDate = new Date(group.endDate || group.end_date);
  const timeSlots = ['MORNING', 'AFTERNOON'];

  // 生成从开始日期到结束日期的所有日期
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    // 为每个时段生成基础活动
    timeSlots.forEach(timeSlot => {
      // 检查是否已存在该团组在该日期和时段的活动
      const existingActivity = activities.find(a =>
        a.groupId === group.id &&
        a.date === dateStr &&
        a.timeSlot === timeSlot
      );

      if (!existingActivity) {
        const baseActivity = {
          id: Math.max(...activities.map(a => a.id), 0) + Math.floor(Math.random() * 1000000) + 1,
          groupId: group.id,
          locationId: null, // 未安排地点
          date: dateStr,
          timeSlot: timeSlot,
          participantCount: (group.studentCount || group.student_count) + (group.teacherCount || group.teacher_count),
          isBaseActivity: true // 标记为基础活动
        };
        activities.push(baseActivity);
      }
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }
}

// 计算行程天数
function calculateDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

// 为所有现有团组生成基础活动
function generateAllGroupsBaseActivities() {
  groups.forEach(group => {
    generateGroupBaseActivities(group);
  });
}

app.post('/api/groups', (req, res) => {
  const newGroup = {
    id: Math.max(...groups.map(g => g.id), 0) + 1,
    ...req.body,
    duration: calculateDuration(req.body.start_date, req.body.end_date),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  groups.push(newGroup);

  // 自动生成基础活动卡片
  generateGroupBaseActivities(newGroup);

  res.json({ success: true, group: newGroup });
});

app.put('/api/groups/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = groups.findIndex(g => g.id === id);
  if (index === -1) {
    return res.status(404).json({ error: '团组不存在' });
  }

  const oldGroup = groups[index];
  const updatedGroup = {
    ...oldGroup,
    ...req.body,
    duration: calculateDuration(req.body.start_date || oldGroup.start_date, req.body.end_date || oldGroup.end_date),
    updated_at: new Date().toISOString()
  };
  groups[index] = updatedGroup;

  // 如果日期发生变化，需要删除旧的基础活动并重新生成
  if (oldGroup.start_date !== updatedGroup.start_date || oldGroup.end_date !== updatedGroup.end_date) {
    // 删除该团组的所有基础活动
    activities = activities.filter(a => !(a.groupId === id && a.isBaseActivity));

    // 重新生成基础活动
    generateGroupBaseActivities(updatedGroup);
  }

  res.json({ success: true, group: updatedGroup });
});

app.delete('/api/groups/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = groups.findIndex(g => g.id === id);
  if (index === -1) {
    return res.status(404).json({ error: '团组不存在' });
  }

  groups.splice(index, 1);
  res.json({ success: true, message: '团组已删除' });
});

// 生成所有团组基础活动的API
app.post('/api/generate-base-activities', (req, res) => {
  try {
    generateAllGroupsBaseActivities();
    res.json({ success: true, message: '基础活动生成成功', count: activities.length });
  } catch (error) {
    res.status(500).json({ error: '生成基础活动失败', details: error.message });
  }
});

// 地点路由
app.get('/api/locations', (req, res) => {
  res.json(locations);
});

app.post('/api/locations', (req, res) => {
  const newLocation = {
    id: Math.max(...locations.map(l => l.id), 0) + 1,
    ...req.body,
    is_active: 1,
    created_at: new Date().toISOString()
  };
  locations.push(newLocation);
  res.json({ success: true, location: newLocation });
});

app.put('/api/locations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = locations.findIndex(l => l.id === id);
  if (index === -1) {
    return res.status(404).json({ error: '地点不存在' });
  }
  
  locations[index] = { ...locations[index], ...req.body };
  res.json({ success: true, location: locations[index] });
});

app.delete('/api/locations/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = locations.findIndex(l => l.id === id);
  if (index === -1) {
    return res.status(404).json({ error: '地点不存在' });
  }
  
  locations[index].is_active = 0;
  res.json({ success: true, message: '地点已禁用' });
});

// 获取原始活动数据的路由（用于团组管理页面）
app.get('/api/activities/raw', (req, res) => {
  res.json(activities);
});

// 活动路由（返回日历格式）
app.get('/api/activities', (req, res) => {
  try {
    const events = activities.map(a => {
      // 验证活动数据完整性
      if (!a || typeof a !== 'object') {
        console.warn('Invalid activity object:', a);
        return null;
      }
      
      const group = groups.find(g => g.id === a.groupId);
      const location = locations.find(l => l.id === a.locationId);
      
      const getTimeFromSlot = (slot) => {
        const times = {
          'MORNING': { start: '09:00:00', end: '12:00:00' },
          'AFTERNOON': { start: '14:00:00', end: '17:00:00' },
          'EVENING': { start: '19:00:00', end: '21:00:00' }
        };
        return times[slot];
      };
      
      const timeInfo = getTimeFromSlot(a.timeSlot);
      
      // 如果找不到对应的时间槽，使用默认值
      if (!timeInfo) {
        console.warn(`Unknown time slot: ${a.timeSlot} for activity:`, a);
        return null;
      }
      
      // 基础活动（未安排地点）只显示团组名称
      const title = a.isBaseActivity || !location
        ? (group?.name || '未知团组')
        : `${group?.name || '未知团组'} - ${location?.name || '未知地点'}`;

      return {
        id: a.id,
        title: title,
        start: `${a.date}T${timeInfo.start}`,
        end: `${a.date}T${timeInfo.end}`,
        backgroundColor: group?.color || '#1890ff',
        extendedProps: {
          groupId: a.groupId,
          locationId: a.locationId,
          participantCount: a.participantCount,
          capacity: location?.capacity || 0,
          timeSlot: a.timeSlot,
          isBaseActivity: a.isBaseActivity || false
        }
      };
    }).filter(event => event !== null);
    
    res.json(events);
  } catch (error) {
    console.error('Error in /api/activities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/activities', (req, res) => {
  const { groupId, locationId, date, timeSlot, participantCount } = req.body;

  // 注意：在我们的系统中，基础活动是自动生成的
  // POST通常只用于创建新的非基础活动，所以这里的冲突检测要谨慎
  console.log('POST /api/activities called with:', req.body);

  const newActivity = {
    id: Math.max(...activities.map(a => a.id), 0) + 1,
    groupId,
    locationId,
    date,
    timeSlot,
    participantCount,
    created_at: new Date().toISOString()
  };

  activities.push(newActivity);
  res.json({ success: true, id: newActivity.id });
});

app.put('/api/activities/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = activities.findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: '活动不存在' });
  }

  const oldActivity = activities[index];
  const newData = req.body;

  // 移除所有冲突检测，允许自由安排地点

  // 更新活动数据
  const updatedActivity = {
    ...oldActivity,
    ...newData,
    updated_at: new Date().toISOString()
  };

  // 确保参与人数正确
  if (newData.locationId !== undefined) {
    const group = groups.find(g => g.id === oldActivity.groupId);
    if (group) {
      updatedActivity.participantCount = group.student_count + group.teacher_count;
    }
  }

  activities[index] = updatedActivity;
  res.json({ success: true });
});

app.delete('/api/activities/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = activities.findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: '活动不存在' });
  }
  
  activities.splice(index, 1);
  res.json({ success: true, message: '活动已删除' });
});

// 统计路由
app.get('/api/statistics', (req, res) => {
  const summary = {
    groups: groups.length,
    locations: locations.length,
    activities: activities.length
  };
  
  const locationUsage = locations.map(l => {
    const locationActivities = activities.filter(a => a.locationId === l.id);
    return {
      location_name: l.name,
      activity_count: locationActivities.length,
      total_participants: locationActivities.reduce((sum, a) => sum + a.participantCount, 0)
    };
  });
  
  res.json({
    summary,
    locationUsage,
    groupActivities: [],
    dailyActivities: [],
    timeSlotDistribution: []
  });
});

app.get('/api/statistics/export', (req, res) => {
  res.json(activities);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`简化服务器运行在 http://localhost:${PORT}`);
  console.log('默认管理员账号: admin/admin123');
  console.log('按 Ctrl+C 停止服务器');

  // 启动时自动修正所有团组的duration值
  groups.forEach(group => {
    if (group.start_date && group.end_date) {
      const correctDuration = calculateDuration(group.start_date, group.end_date);
      if (group.duration !== correctDuration) {
        console.log(`修正团组 "${group.name}" 的天数: ${group.duration} -> ${correctDuration}`);
        group.duration = correctDuration;
      }
    }
  });

  // 启动时自动生成所有团组的基础活动
  generateAllGroupsBaseActivities();
  console.log(`已为所有团组生成基础活动，当前活动总数: ${activities.length}`);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});