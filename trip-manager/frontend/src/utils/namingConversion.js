/**
 * 命名转换工具函数
 * 用于将 snake_case 转换为 camelCase
 */

// 将 snake_case 转换为 camelCase
export const snakeToCamel = (str) => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

// 将对象的所有键从 snake_case 转换为 camelCase
export const convertKeysToCamelCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(item => convertKeysToCamelCase(item));
  }

  if (obj !== null && obj !== undefined && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = snakeToCamel(key);
      result[camelKey] = convertKeysToCamelCase(obj[key]);
      return result;
    }, {});
  }

  return obj;
};

// 将 camelCase 转换为 snake_case
export const camelToSnake = (str) => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

// 将对象的所有键从 camelCase 转换为 snake_case
export const convertKeysToSnakeCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(item => convertKeysToSnakeCase(item));
  }

  if (obj !== null && obj !== undefined && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = convertKeysToSnakeCase(obj[key]);
      return result;
    }, {});
  }

  return obj;
};

// 字段映射表（用于过渡期）
export const fieldMapping = {
  // Group 相关
  group_name: 'groupName',
  student_count: 'studentCount',
  teacher_count: 'teacherCount',
  start_date: 'startDate',
  end_date: 'endDate',
  contact_person: 'contactPerson',
  contact_phone: 'contactPhone',
  theme_package_id: 'themePackageId',
  created_at: 'createdAt',
  created_by: 'createdBy',

  // Activity 相关
  group_id: 'groupId',
  location_id: 'locationId',
  schedule_id: 'scheduleId',
  time_slot: 'timeSlot',
  participant_count: 'participantCount',
  is_base_activity: 'isBaseActivity',
  start_time: 'startTime',
  end_time: 'endTime',

  // Educational Resource 相关
  age_groups: 'ageGroups',

  // Theme Package 相关
  theme_package: 'themePackage',
  resource_count: 'resourceCount',
  total_duration: 'totalDuration',
  usage_count: 'usageCount',

  // Location 相关
  available_days: 'availableDays',
  applicable_types: 'applicableTypes',

  // Schedule 相关
  sort_order: 'sortOrder'
};

// 反向映射表
export const reverseFieldMapping = Object.entries(fieldMapping).reduce((acc, [snake, camel]) => {
  acc[camel] = snake;
  return acc;
}, {});