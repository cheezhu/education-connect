import dayjs from 'dayjs';

export const UNNAMED_GROUP_NAME = '\u672a\u547d\u540d\u56e2\u7ec4';

export const TAB_GROUPS = [
  {
    id: 'read',
    mode: 'read',
    tabs: [
      { key: 'profile', label: '\u56e2\u7ec4\u8bbe\u7f6e' },
      { key: 'progress', label: '\u51c6\u5907\u8fdb\u5ea6' },
      { key: 'itinerary', label: '\u884c\u7a0b\u5bfc\u51fa' }
    ]
  },
  {
    id: 'planning',
    mode: 'work',
    tabs: [
      { key: 'schedule', label: '\u65e5\u5386\u89c4\u5212' },
      { key: 'points', label: '\u884c\u7a0b\u70b9' },
      { key: 'meals', label: '\u9910\u996e' },
      { key: 'transfer', label: '\u63a5\u9001\u7ad9' }
    ]
  },
  {
    id: 'operations',
    mode: 'work',
    tabs: [
      { key: 'members', label: '\u56e2\u5458\u540d\u5355' },
      { key: 'accommodation', label: '\u4f4f\u5bbf\u5b89\u6392' }
    ]
  }
];

export const TAB_ALIAS = {
  logistics: 'meals'
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
  loading: '\u52a0\u8f7d\u4e2d...',
  tabRenderFailed: '\u5f53\u524d\u6807\u7b7e\u9875\u6e32\u67d3\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u63a7\u5236\u53f0\u9519\u8bef\u3002',
  loadGroupsFailed: '\u52a0\u8f7d\u56e2\u7ec4\u6570\u636e\u5931\u8d25',
  loadSchedulesFailed: '\u52a0\u8f7d\u65e5\u7a0b\u5931\u8d25',
  loadLogisticsFailed: '\u52a0\u8f7d\u6bcf\u65e5\u5361\u7247\u5931\u8d25',
  groupDeleted: '\u56e2\u7ec4\u5df2\u5220\u9664',
  groupDeleteFailed: '\u5220\u9664\u5931\u8d25',
  groupCreated: '\u5df2\u65b0\u5efa\u56e2\u7ec4',
  groupCreateFailed: '\u65b0\u5efa\u56e2\u7ec4\u5931\u8d25',
  batchCreateRowMissing: '\u8bf7\u5148\u6dfb\u52a0\u56e2\u7ec4',
  batchCreateFailed: '\u6279\u91cf\u521b\u5efa\u5931\u8d25',
  saveFailed: '\u4fdd\u5b58\u5931\u8d25',
  saveScheduleFailed: '\u4fdd\u5b58\u65e5\u7a0b\u5931\u8d25',
  saveLogisticsFailed: '\u4fdd\u5b58\u6bcf\u65e5\u5361\u7247\u5931\u8d25',
  scheduleConflict: '\u65e5\u7a0b\u5df2\u88ab\u5176\u4ed6\u4eba\u4fee\u6539\uff0c\u8bf7\u5237\u65b0\u540e\u518d\u8bd5'
};

export const PROFILE_TEXT = {
  emptyState: '\u8bf7\u9009\u62e9\u56e2\u7ec4\u4ee5\u67e5\u770b\u8be6\u60c5',
  deleteGroup: '\u5220\u9664\u56e2\u7ec4',
  replaceMustVisitConfirm: '\u5c06\u4f7f\u7528\u65b9\u6848\u5730\u70b9\u66ff\u6362\u5f53\u524d\u5fc5\u53bb\u70b9\uff0c\u662f\u5426\u7ee7\u7eed\uff1f',
  deleteGroupConfirm: (name) => `\u786e\u5b9a\u5220\u9664\u56e2\u7ec4\u300c${name}\u300d\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002`,
  statusOptions: [
    { value: null, label: '\u81ea\u52a8' },
    { value: '\u51c6\u5907\u4e2d', label: '\u51c6\u5907\u4e2d' },
    { value: '\u8fdb\u884c\u4e2d', label: '\u8fdb\u884c\u4e2d' },
    { value: '\u5df2\u5b8c\u6210', label: '\u5df2\u5b8c\u6210' },
    { value: '\u5df2\u53d6\u6d88', label: '\u5df2\u53d6\u6d88' }
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
