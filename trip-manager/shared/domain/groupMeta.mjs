// Shared domain (ESM): group type/status/source metadata for frontend + backend parity.

export const GROUP_TYPE_VALUES = Object.freeze(['primary', 'secondary', 'vip']);

export const GROUP_TYPE_LABELS = Object.freeze({
  primary: '小学',
  secondary: '中学',
  vip: 'VIP'
});

export const GROUP_TYPE_DISPLAY_ALIASES = Object.freeze({
  primary: Object.freeze(['小学', '小學']),
  secondary: Object.freeze(['中学', '中學']),
  vip: Object.freeze(['VIP', 'vip'])
});

export const GROUP_CANCELLED_STATUS = '已取消';

export const GROUP_STATUS_VALUES = Object.freeze([
  '准备中',
  '进行中',
  '已完成',
  GROUP_CANCELLED_STATUS
]);

export const GROUP_STATUS_OPTIONS = Object.freeze([
  Object.freeze({ value: null, label: '自动' }),
  ...GROUP_STATUS_VALUES.map((value) => Object.freeze({ value, label: value }))
]);

export const RESOURCE_SOURCE_META = Object.freeze({
  plan: Object.freeze({
    kind: 'plan',
    tag: '必去',
    title: '必去行程点',
    className: 'source-plan'
  }),
  shixing: Object.freeze({
    kind: 'shixing',
    tag: '食行',
    title: '食行卡片',
    className: 'source-shixing'
  }),
  custom: Object.freeze({
    kind: 'custom',
    tag: '其他',
    title: '其他',
    className: 'source-custom'
  }),
  unknown: Object.freeze({
    kind: 'unknown',
    tag: '其他',
    title: '其他',
    className: 'source-custom'
  })
});

