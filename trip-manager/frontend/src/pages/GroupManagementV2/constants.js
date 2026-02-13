import dayjs from 'dayjs';

export const UNNAMED_GROUP_NAME = '未命名团组';

export const TAB_KEYS = new Set(['profile', 'progress', 'logistics', 'schedule', 'itinerary', 'members', 'help']);

export const QUICK_CREATE_DEFAULTS = {
  name: UNNAMED_GROUP_NAME,
  type: 'primary',
  studentCount: 44,
  teacherCount: 0,
  durationDays: 5
};

export const DEBOUNCE_MS = {
  realtimeRefresh: 280,
  logisticsSave: 400,
  scheduleSave: 400
};

export const GROUP_MESSAGES = {
  loading: '加载中...',
  tabRenderFailed: '当前标签页渲染失败，请检查控制台错误。',
  loadGroupsFailed: '加载团组数据失败',
  loadSchedulesFailed: '加载日程失败',
  loadLogisticsFailed: '加载食行卡片失败',
  groupDeleted: '团组已删除',
  groupDeleteFailed: '删除失败',
  groupCreated: '已新建团组',
  groupCreateFailed: '新建团组失败',
  batchCreateRowMissing: '请先添加团组',
  batchCreateFailed: '批量创建失败',
  saveFailed: '保存失败',
  saveScheduleFailed: '保存日程失败',
  saveLogisticsFailed: '保存食行卡片失败',
  scheduleConflict: '日程已被其他人修改，请刷新后再试'
};

export const PROFILE_TEXT = {
  emptyState: '请选择团组以查看详情',
  deleteGroup: '删除团组',
  replaceMustVisitConfirm: '将使用方案地点替换当前必去点，是否继续？',
  deleteGroupConfirm: (name) => `确定删除团组「${name}」？此操作不可撤销。`,
  statusOptions: [
    { value: null, label: '自动' },
    { value: '准备中', label: '准备中' },
    { value: '进行中', label: '进行中' },
    { value: '已完成', label: '已完成' },
    { value: '已取消', label: '已取消' }
  ]
};

export const toGroupIdKey = (value) => String(value ?? '');

export const normalizeGroupId = (value) => {
  const numericId = Number(value);
  return Number.isFinite(numericId) ? numericId : value;
};

export const isSameGroupId = (left, right) => {
  const leftKey = toGroupIdKey(left);
  const rightKey = toGroupIdKey(right);
  return leftKey !== '' && leftKey === rightKey;
};

export const toTimestamp = (value) => {
  if (!value) return null;
  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;
  return parsed.valueOf();
};
