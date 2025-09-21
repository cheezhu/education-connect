const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addTestGroups() {
  console.log('开始添加测试团组...');

  // 测试团组数据
  const testGroups = [
    {
      name: '北京师范大学附属小学',
      type: 'primary',
      studentCount: 45,
      teacherCount: 4,
      startDate: '2025-09-25',
      endDate: '2025-09-29',
      duration: 5,
      color: '#f5222d',
      status: '准备中',
      contactPerson: '王老师',
      contactPhone: '13800138003',
      emergencyContact: '陈主任',
      emergencyPhone: '13900139003',
      notes: '需要准备特殊饮食安排',
      themePackageId: 'theme_001'  // 科技探索之旅
    },
    {
      name: '上海华东师大二附中',
      type: 'secondary',
      studentCount: 42,
      teacherCount: 3,
      startDate: '2025-09-26',
      endDate: '2025-09-30',
      duration: 5,
      color: '#fa541c',
      status: '准备中',
      contactPerson: '刘老师',
      contactPhone: '13800138004',
      emergencyContact: '周主任',
      emergencyPhone: '13900139004',
      notes: '部分学生有过敏史',
      themePackageId: 'theme_003'  // 自然生态探索
    },
    {
      name: '杭州学军小学',
      type: 'primary',
      studentCount: 40,
      teacherCount: 4,
      startDate: '2025-10-08',
      endDate: '2025-10-12',
      duration: 5,
      color: '#fa8c16',
      status: '已确认',
      contactPerson: '赵老师',
      contactPhone: '13800138005',
      emergencyContact: '钱主任',
      emergencyPhone: '13900139005',
      notes: '需要安排摄影师跟拍',
      themePackageId: 'theme_002'  // 文化深度游
    },
    {
      name: '南京师范大学附中',
      type: 'secondary',
      studentCount: 48,
      teacherCount: 4,
      startDate: '2025-10-09',
      endDate: '2025-10-13',
      duration: 5,
      color: '#faad14',
      status: '已确认',
      contactPerson: '孙老师',
      contactPhone: '13800138006',
      emergencyContact: '李主任',
      emergencyPhone: '13900139006',
      notes: '优秀学生团，可安排学术交流',
      themePackageId: 'theme_004'  // 学术交流体验
    },
    {
      name: '武汉华中师大一附小',
      type: 'primary',
      studentCount: 43,
      teacherCount: 4,
      startDate: '2025-10-15',
      endDate: '2025-10-19',
      duration: 5,
      color: '#52c41a',
      status: '准备中',
      contactPerson: '周老师',
      contactPhone: '13800138007',
      emergencyContact: '吴主任',
      emergencyPhone: '13900139007',
      notes: '首次参加研学活动',
      themePackageId: 'theme_001'  // 科技探索之旅
    },
    {
      name: '成都七中',
      type: 'secondary',
      studentCount: 46,
      teacherCount: 4,
      startDate: '2025-10-20',
      endDate: '2025-10-24',
      duration: 5,
      color: '#13c2c2',
      status: '待确认',
      contactPerson: '郑老师',
      contactPhone: '13800138008',
      emergencyContact: '王主任',
      emergencyPhone: '13900139008',
      notes: '科技特长班学生',
      themePackageId: 'theme_001'  // 科技探索之旅
    },
    {
      name: '西安高新第一小学',
      type: 'primary',
      studentCount: 41,
      teacherCount: 3,
      startDate: '2025-10-22',
      endDate: '2025-10-26',
      duration: 5,
      color: '#1890ff',
      status: '待确认',
      contactPerson: '冯老师',
      contactPhone: '13800138009',
      emergencyContact: '陈主任',
      emergencyPhone: '13900139009',
      notes: '需要提供清真餐',
      themePackageId: 'theme_002'  // 文化深度游
    },
    {
      name: '重庆南开中学',
      type: 'secondary',
      studentCount: 44,
      teacherCount: 4,
      startDate: '2025-11-05',
      endDate: '2025-11-09',
      duration: 5,
      color: '#722ed1',
      status: '已确认',
      contactPerson: '褚老师',
      contactPhone: '13800138010',
      emergencyContact: '卫主任',
      emergencyPhone: '13900139010',
      notes: '学生会干部培训团',
      themePackageId: 'theme_004'  // 学术交流体验
    },
    {
      name: '天津南开小学',
      type: 'primary',
      studentCount: 39,
      teacherCount: 3,
      startDate: '2025-11-12',
      endDate: '2025-11-16',
      duration: 5,
      color: '#eb2f96',
      status: '准备中',
      contactPerson: '蒋老师',
      contactPhone: '13800138011',
      emergencyContact: '沈主任',
      emergencyPhone: '13900139011',
      notes: '艺术特色班',
      themePackageId: 'theme_002'  // 文化深度游
    },
    {
      name: '厦门外国语学校',
      type: 'secondary',
      studentCount: 47,
      teacherCount: 4,
      startDate: '2025-11-18',
      endDate: '2025-11-22',
      duration: 5,
      color: '#87d068',
      status: '待确认',
      contactPerson: '韩老师',
      contactPhone: '13800138012',
      emergencyContact: '杨主任',
      emergencyPhone: '13900139012',
      notes: '国际班学生，英语流利',
      themePackageId: 'theme_003'  // 自然生态探索
    }
  ];

  try {
    // 获取管理员用户ID
    const adminUser = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (!adminUser) {
      console.error('未找到管理员用户，请先运行种子数据');
      return;
    }

    // 批量创建团组
    let createdCount = 0;
    for (const groupData of testGroups) {
      try {
        const group = await prisma.group.create({
          data: {
            ...groupData,
            createdBy: adminUser.id
          }
        });
        console.log(`✅ 创建团组: ${group.name}`);
        createdCount++;
      } catch (error) {
        console.error(`❌ 创建团组失败 ${groupData.name}:`, error.message);
      }
    }

    console.log(`\n✨ 成功创建 ${createdCount} 个测试团组`);

    // 显示总计
    const totalGroups = await prisma.group.count();
    console.log(`📊 数据库中现有团组总数: ${totalGroups}`);

  } catch (error) {
    console.error('添加测试团组失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行脚本
addTestGroups();