const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('开始创建种子数据...');

  // 创建默认用户
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      password: hashedPassword,
      role: 'admin'
    }
  });
  console.log('创建管理员用户:', adminUser.username);

  // 创建教育资源
  const resources = await Promise.all([
    prisma.educationalResource.create({
      data: {
        id: 'resource_001',
        name: '香港科学馆',
        type: 'museum',
        category: 'science',
        description: '展示各种科学原理的互动博物馆',
        location: '尖沙咀东部科学馆道2号',
        duration: 3,
        ageGroups: JSON.stringify(['primary', 'secondary']),
        highlights: JSON.stringify(['互动物理实验', '科学原理展示', '团队探索活动']),
        icon: '🏛️',
        isUnique: true,
        status: 'active'
      }
    }),
    prisma.educationalResource.create({
      data: {
        id: 'resource_002',
        name: '香港太空馆',
        type: 'museum',
        category: 'science',
        description: '天文和太空科学教育中心',
        location: '尖沙咀梳士巴利道10号',
        duration: 2,
        ageGroups: JSON.stringify(['primary', 'secondary']),
        highlights: JSON.stringify(['天文展览', '全天域电影', '太空探索体验']),
        icon: '🌌',
        isUnique: true,
        status: 'active'
      }
    }),
    prisma.educationalResource.create({
      data: {
        id: 'resource_003',
        name: '海洋公园',
        type: 'park',
        category: 'nature',
        description: '结合娱乐与教育的海洋主题公园',
        location: '南区黄竹坑',
        duration: 6,
        ageGroups: JSON.stringify(['primary', 'secondary']),
        highlights: JSON.stringify(['海洋生物观察', '保育教育', '团队活动']),
        icon: '🐬',
        isUnique: true,
        status: 'active'
      }
    }),
    prisma.educationalResource.create({
      data: {
        id: 'resource_004',
        name: '香港大学',
        type: 'university',
        category: 'academic',
        description: '香港历史最悠久的高等教育机构',
        location: '薄扶林道',
        duration: 2.5,
        ageGroups: JSON.stringify(['secondary']),
        highlights: JSON.stringify(['校园参观', '学术交流', '历史建筑']),
        icon: '🎓',
        isUnique: true,
        status: 'active'
      }
    }),
    prisma.educationalResource.create({
      data: {
        id: 'resource_005',
        name: '数码港',
        type: 'enterprise',
        category: 'technology',
        description: '香港数码科技旗舰',
        location: '薄扶林数码港道100号',
        duration: 2,
        ageGroups: JSON.stringify(['secondary']),
        highlights: JSON.stringify(['创新科技展示', '创业分享', '未来科技体验']),
        icon: '💻',
        isUnique: true,
        status: 'active'
      }
    }),
    prisma.educationalResource.create({
      data: {
        id: 'resource_006',
        name: '文化中心',
        type: 'cultural',
        category: 'culture',
        description: '香港主要的文化艺术场地',
        location: '尖沙咀梳士巴利道10号',
        duration: 2,
        ageGroups: JSON.stringify(['primary', 'secondary']),
        highlights: JSON.stringify(['艺术展览', '音乐欣赏', '文化体验']),
        icon: '🎭',
        isUnique: true,
        status: 'active'
      }
    }),
    prisma.educationalResource.create({
      data: {
        id: 'resource_007',
        name: '湿地公园',
        type: 'nature',
        category: 'nature',
        description: '生态保育和教育中心',
        location: '天水围湿地公园路',
        duration: 3,
        ageGroups: JSON.stringify(['primary', 'secondary']),
        highlights: JSON.stringify(['生态观察', '环保教育', '自然探索']),
        icon: '🦜',
        isUnique: true,
        status: 'active'
      }
    }),
    prisma.educationalResource.create({
      data: {
        id: 'resource_008',
        name: '历史博物馆',
        type: 'museum',
        category: 'history',
        description: '展示香港历史文化',
        location: '尖沙咀漆咸道南100号',
        duration: 2,
        ageGroups: JSON.stringify(['primary', 'secondary']),
        highlights: JSON.stringify(['历史文物', '文化展览', '互动体验']),
        icon: '🏺',
        isUnique: true,
        status: 'active'
      }
    })
  ]);
  console.log(`创建了 ${resources.length} 个教育资源`);

  // 创建主题包
  const themePackages = await Promise.all([
    prisma.themePackage.create({
      data: {
        id: 'theme_001',
        name: '科技探索之旅',
        description: '专注科技创新教育，培养学生的科学思维和创新能力',
        tags: JSON.stringify(['科技', 'STEM', '互动体验']),
        status: 'active',
        resources: {
          create: [
            { resourceId: 'resource_001', sortOrder: 1 },
            { resourceId: 'resource_002', sortOrder: 2 },
            { resourceId: 'resource_005', sortOrder: 3 }
          ]
        }
      }
    }),
    prisma.themePackage.create({
      data: {
        id: 'theme_002',
        name: '文化深度游',
        description: '传统与现代文化体验，增进文化理解和艺术欣赏',
        tags: JSON.stringify(['文化', '艺术', '历史']),
        status: 'active',
        resources: {
          create: [
            { resourceId: 'resource_006', sortOrder: 1 },
            { resourceId: 'resource_008', sortOrder: 2 }
          ]
        }
      }
    }),
    prisma.themePackage.create({
      data: {
        id: 'theme_003',
        name: '自然生态探索',
        description: '环保与生态教育，培养环境保护意识',
        tags: JSON.stringify(['自然', '生态', '环保']),
        status: 'active',
        resources: {
          create: [
            { resourceId: 'resource_003', sortOrder: 1 },
            { resourceId: 'resource_007', sortOrder: 2 }
          ]
        }
      }
    }),
    prisma.themePackage.create({
      data: {
        id: 'theme_004',
        name: '学术交流体验',
        description: '高校参观与学术体验，激发学习动力',
        tags: JSON.stringify(['学术', '高校', '交流']),
        status: 'active',
        resources: {
          create: [
            { resourceId: 'resource_004', sortOrder: 1 }
          ]
        }
      }
    })
  ]);
  console.log(`创建了 ${themePackages.length} 个主题包`);

  // 创建示例团组
  const groups = await Promise.all([
    prisma.group.create({
      data: {
        name: '深圳实验学校小学部',
        type: 'primary',
        studentCount: 44,
        teacherCount: 4,
        startDate: '2025-09-22',
        endDate: '2025-09-26',
        duration: 5,
        color: '#1890ff',
        status: '准备中',
        contactPerson: '张老师',
        contactPhone: '13800138001',
        themePackageId: 'theme_001',
        createdBy: adminUser.id
      }
    }),
    prisma.group.create({
      data: {
        name: '广州中学',
        type: 'secondary',
        studentCount: 38,
        teacherCount: 3,
        startDate: '2025-09-23',
        endDate: '2025-09-27',
        duration: 5,
        color: '#52c41a',
        status: '准备中',
        contactPerson: '李老师',
        contactPhone: '13800138002',
        themePackageId: 'theme_002',
        createdBy: adminUser.id
      }
    })
  ]);
  console.log(`创建了 ${groups.length} 个团组`);

  console.log('种子数据创建完成！');
}

main()
  .catch((e) => {
    console.error('种子数据创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });