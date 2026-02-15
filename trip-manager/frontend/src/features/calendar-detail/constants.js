export const CALENDAR_ACTIVITY_TYPES = Object.freeze({
  meal: Object.freeze({ label: '餐饮', color: '#52c41a', icon: '' }),
  visit: Object.freeze({ label: '参观', color: '#1890ff', icon: '' }),
  transport: Object.freeze({ label: '交通', color: '#fa8c16', icon: '' }),
  rest: Object.freeze({ label: '休息', color: '#8c8c8c', icon: '' }),
  activity: Object.freeze({ label: '活动', color: '#722ed1', icon: '' }),
  free: Object.freeze({ label: '自由活动', color: '#13c2c2', icon: '' })
});

export const getActivityTypeLabel = (type) => (
  CALENDAR_ACTIVITY_TYPES[type]?.label || CALENDAR_ACTIVITY_TYPES.activity.label
);
