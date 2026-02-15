import dayjs from 'dayjs';
import { GROUP_STATUS_OPTIONS } from '../../../../shared/domain/groupMeta.mjs';

export const UNNAMED_GROUP_NAME = '未命名团组';

export const TAB_GROUPS = [
  {
    id: 'read',
    mode: 'read',
    tabs: [
      { key: 'profile', label: '团组设置' },
      { key: 'progress', label: '准备进度' },
      { key: 'itinerary', label: '行程导出' }
    ]
  },
  {
    id: 'planning',
    mode: 'work',
    tabs: [
      { key: 'schedule', label: '日历规划' },
      { key: 'points', label: '行程点' },
      { key: 'meals', label: '餐饮' },
      { key: 'transfer', label: '接送站' },
      { key: 'logistics_sheet', label: '每日资源表' }
    ]
  },
  {
    id: 'operations',
    mode: 'work',
    tabs: [
      { key: 'members', label: '团员名单' },
      { key: 'accommodation', label: '住宿安排' }
    ]
  }
];

export const TAB_ALIAS = {
  logistics: 'logistics_sheet'
};

const TAB_GROUP_KEYS = TAB_GROUPS.flatMap((group) => group.tabs.map((tab) => tab.key));

export const TAB_KEYS = new Set([
  ...TAB_GROUP_KEYS,
  ...Object.keys(TAB_ALIAS),
  'help'
]);

export const READ_MODE_TAB_KEYS = new Set(
  TAB_GROUPS
    .filter((group) => group.mode === 'read')
    .flatMap((group) => group.tabs.map((tab) => tab.key))
);

export const resolveTabKey = (tabKey) => TAB_ALIAS[tabKey] || tabKey;

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
  loadLogisticsFailed: '加载每日卡片失败',
  groupDeleted: '团组已删除',
  groupDeleteFailed: '删除失败',
  groupCreated: '已新建团组',
  groupCreateFailed: '新建团组失败',
  batchCreateRowMissing: '请先添加团组',
  batchCreateFailed: '批量创建失败',
  saveFailed: '保存失败',
  saveScheduleFailed: '保存日程失败',
  saveLogisticsFailed: '保存每日卡片失败',
  scheduleConflict: '日程已被其他人修改，请刷新后再试'
};

export const PROFILE_TEXT = {
  emptyState: '请选择团组以查看详情',
  deleteGroup: '删除团组',
  replaceMustVisitConfirm: '将使用方案地点替换当前必去点，是否继续？',
  deleteGroupConfirm: (name) => `确定删除团组「${name}」？此操作不可撤销。`,
  statusOptions: GROUP_STATUS_OPTIONS
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

