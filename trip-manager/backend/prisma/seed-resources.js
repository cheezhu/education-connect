const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化教育资源和主题包数据...');

  // 创建教育资源
  const resources = [
    {
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
      status: 'active'
    },
    {
      id: 'resource_002',
      name: '香港太空馆',
      type: 'museum',
      category: 'science',
      description: '探索宇宙奥秘的天文博物馆',
      location: '尖沙咀梳士巴利道10号',
      duration: 2,
      ageGroups: JSON.stringify(['primary', 'secondary']),
      highlights: JSON.stringify(['天象厅', '宇宙展览', '互动体验']),
      icon: '🌌',
      status: 'active'
    },
    {
      id: 'resource_003',
      name: '香港历史博物馆',
      type: 'museum',
      category: 'history',
      description: '展示香港历史发展的综合博物馆',
      location: '尖沙咀漆咸道南100号',
      duration: 2.5,
      ageGroups: JSON.stringify(['primary', 'secondary']),
      highlights: JSON.stringify(['香港故事展览', '民俗文化展示', '历史场景重现']),
      icon: '🏺',
      status: 'active'
    },
    {
      id: 'resource_004',
      name: '香港文化博物馆',
      type: 'museum',
      category: 'culture',
      description: '展示香港文化艺术的博物馆',
      location: '沙田文林路1号',
      duration: 2.5,
      ageGroups: JSON.stringify(['primary', 'secondary']),
      highlights: JSON.stringify(['粤剧文化', '香港电影', '艺术展览']),
      icon: '🎭',
      status: 'active'
    },
    {
      id: 'resource_005',
      name: '香港海洋公园',
      type: 'park',
      category: 'nature',
      description: '集娱乐和教育于一体的海洋主题公园',
      location: '香港仔黄竹坑道180号',
      duration: 6,
      ageGroups: JSON.stringify(['primary', 'secondary']),
      highlights: JSON.stringify(['海洋生物展览', '保育教育', '动物表演']),
      icon: '🐬',
      status: 'active'
    },
    {
      id: 'resource_006',
      name: '诺亚方舟',
      type: 'park',
      category: 'nature',
      description: '结合自然教育和历史文化的主题公园',
      location: '新界马湾珀欣路33号',
      duration: 4,
      ageGroups: JSON.stringify(['primary', 'secondary']),
      highlights: JSON.stringify(['生命教育', '环保体验', '团队活动']),
      icon: '🦜',
      status: 'active'
    },
    {
      id: 'resource_007',
      name: '香港大学',
      type: 'university',
      category: 'education',
      description: '香港历史最悠久的高等教育机构',
      location: '薄扶林道',
      duration: 2,
      ageGroups: JSON.stringify(['secondary']),
      highlights: JSON.stringify(['校园参观', '学术交流', '历史建筑']),
      icon: '🎓',
      status: 'active'
    },
    {
      id: 'resource_008',
      name: '西九文化区',
      type: 'cultural',
      category: 'culture',
      description: '香港的艺术文化枢纽',
      location: '西九龙文化区',
      duration: 3,
      ageGroups: JSON.stringify(['primary', 'secondary']),
      highlights: JSON.stringify(['M+博物馆', '艺术公园', '文化表演']),
      icon: '🎨',
      status: 'active'
    }
  ];

  // 插入教育资源
  for (const resource of resources) {
    await prisma.educationalResource.upsert({
      where: { id: resource.id },
      update: resource,
      create: resource
    });
    console.log(`✅ 创建教育资源: ${resource.name}`);
  }

  // 创建主题包
  const themePackages = [
    {
      id: 'theme_001',
      name: '科技探索之旅',
      description: '专注科技创新的学习体验，包含科学馆、太空馆等科技教育资源',
      tags: JSON.stringify(['科技', 'STEM', '互动体验']),
      status: 'active'
    },
    {
      id: 'theme_002',
      name: '历史文化之旅',
      description: '深入了解香港历史文化，参观博物馆和文化景点',
      tags: JSON.stringify(['文化', '艺术', '历史']),
      status: 'active'
    },
    {
      id: 'theme_003',
      name: '自然生态之旅',
      description: '亲近自然，了解生态保育和环境保护',
      tags: JSON.stringify(['自然', '生态', '环保']),
      status: 'active'
    }
  ];

  // 插入主题包
  for (const pkg of themePackages) {
    await prisma.themePackage.upsert({
      where: { id: pkg.id },
      update: pkg,
      create: pkg
    });
    console.log(`✅ 创建主题包: ${pkg.name}`);
  }

  // 创建主题包和资源的关联
  const packageResources = [
    // 科技探索之旅
    { themePackageId: 'theme_001', resourceId: 'resource_001', sortOrder: 1 },
    { themePackageId: 'theme_001', resourceId: 'resource_002', sortOrder: 2 },

    // 历史文化之旅
    { themePackageId: 'theme_002', resourceId: 'resource_003', sortOrder: 1 },
    { themePackageId: 'theme_002', resourceId: 'resource_004', sortOrder: 2 },
    { themePackageId: 'theme_002', resourceId: 'resource_008', sortOrder: 3 },

    // 自然生态之旅
    { themePackageId: 'theme_003', resourceId: 'resource_005', sortOrder: 1 },
    { themePackageId: 'theme_003', resourceId: 'resource_006', sortOrder: 2 }
  ];

  // 删除旧的关联关系
  await prisma.themePackageResource.deleteMany({});

  // 插入新的关联关系
  for (const relation of packageResources) {
    await prisma.themePackageResource.create({
      data: relation
    });
  }
  console.log('✅ 创建主题包和资源关联');

  console.log('\n✅ 数据初始化完成！');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });