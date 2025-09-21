#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要替换的映射
const replacements = {
  // Group 相关
  'group_name': 'groupName',
  'student_count': 'studentCount',
  'teacher_count': 'teacherCount',
  'start_date': 'startDate',
  'end_date': 'endDate',
  'contact_person': 'contactPerson',
  'contact_phone': 'contactPhone',
  'theme_package_id': 'themePackageId',
  'theme_package': 'themePackage',
  'created_at': 'createdAt',
  'created_by': 'createdBy',

  // Activity 相关
  'group_id': 'groupId',
  'location_id': 'locationId',
  'schedule_id': 'scheduleId',
  'time_slot': 'timeSlot',
  'participant_count': 'participantCount',
  'is_base_activity': 'isBaseActivity',
  'start_time': 'startTime',
  'end_time': 'endTime',

  // Educational Resource 相关
  'age_groups': 'ageGroups',
  'resource_count': 'resourceCount',
  'total_duration': 'totalDuration',
  'usage_count': 'usageCount',

  // Location 相关
  'available_days': 'availableDays',
  'applicable_types': 'applicableTypes',

  // Schedule 相关
  'sort_order': 'sortOrder'
};

// 需要处理的文件列表
const filesToProcess = [
  'src/pages/GroupManagementV2/index.jsx',
  'src/pages/GroupEditV2/index.jsx',
  'src/pages/GroupEditV2/GroupInfoSimple.jsx',
  'src/pages/GroupEditV2/CalendarDaysView.jsx',
  'src/pages/GroupEditV2/ScheduleManagement.jsx',
  'src/pages/GroupEditV2/GroupOverviewCompact.jsx',
  'src/pages/GroupEditV2/GroupOverview.jsx',
  'src/pages/ItineraryDesigner.jsx',
  'src/pages/GroupManagement.jsx',
  'src/pages/LocationManagement.jsx'
];

function processFile(filePath) {
  console.log(`Processing: ${filePath}`);

  let content = fs.readFileSync(filePath, 'utf8');
  let changeCount = 0;

  // 替换每个 snake_case 字段
  for (const [snakeCase, camelCase] of Object.entries(replacements)) {
    // 匹配作为对象属性的情况：.snake_case 或 ['snake_case'] 或 "snake_case": 或 'snake_case':
    const patterns = [
      new RegExp(`\\.${snakeCase}(?![a-zA-Z0-9_])`, 'g'),
      new RegExp(`\\['${snakeCase}'\\]`, 'g'),
      new RegExp(`\\["${snakeCase}"\\]`, 'g'),
      new RegExp(`'${snakeCase}'\\s*:`, 'g'),
      new RegExp(`"${snakeCase}"\\s*:`, 'g'),
      new RegExp(`${snakeCase}\\s*:(?!\\/)`, 'g')  // 匹配对象字面量中的键
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        changeCount += matches.length;
        if (pattern.source.includes('\\.')) {
          content = content.replace(pattern, `.${camelCase}`);
        } else if (pattern.source.includes("\\['")) {
          content = content.replace(pattern, `.${camelCase}`);
        } else if (pattern.source.includes('\\["')) {
          content = content.replace(pattern, `.${camelCase}`);
        } else if (pattern.source.includes("'.*':")) {
          content = content.replace(pattern, `'${camelCase}':`);
        } else if (pattern.source.includes('".*":')) {
          content = content.replace(pattern, `"${camelCase}":`);
        } else {
          content = content.replace(pattern, `${camelCase}:`);
        }
      }
    }
  }

  if (changeCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ Updated ${changeCount} occurrences`);
  } else {
    console.log(`  ℹ️  No changes needed`);
  }
}

console.log('Starting migration to camelCase...\n');

for (const file of filesToProcess) {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    processFile(fullPath);
  } else {
    console.log(`  ⚠️  File not found: ${file}`);
  }
}

console.log('\n✅ Migration completed!');