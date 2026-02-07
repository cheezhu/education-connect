export const planningConflictReasonLabels = {
  INVALID_TIME_SLOT: '时段不合法',
  OUT_OF_RANGE: '超出可导入日期范围',
  GROUP_TIME_CONFLICT: '同团组同日同时段冲突',
  INACTIVE_LOCATION: '地点已停用',
  GROUP_TYPE: '地点不适用于该团组类型',
  INVALID_DATE: '日期无效',
  BLOCKED_WEEKDAY: '地点在该星期不可用',
  CLOSED_DATE: '地点在该日期闭馆',
  OPEN_HOURS: '地点开放时段不覆盖该时段',
  CAPACITY: '地点容量不足'
};

const planningManualRequiredReasons = new Set([
  'GROUP_TIME_CONFLICT',
  'CAPACITY',
  'INACTIVE_LOCATION',
  'GROUP_TYPE',
  'BLOCKED_WEEKDAY',
  'CLOSED_DATE',
  'OPEN_HOURS',
  'INVALID_TIME_SLOT',
  'INVALID_DATE'
]);

const planningConflictHandlingTips = {
  INVALID_TIME_SLOT: '改成标准时段（上午/下午/晚上）后重试',
  OUT_OF_RANGE: '调整导入范围或把活动日期改到范围内',
  GROUP_TIME_CONFLICT: '同团组同一时段有重复，保留一条其余换时段',
  INACTIVE_LOCATION: '地点停用，替换为可用地点',
  GROUP_TYPE: '当前地点不匹配团组类型，改匹配地点',
  INVALID_DATE: '修正为 YYYY-MM-DD 有效日期',
  BLOCKED_WEEKDAY: '避开地点禁用星期或改地点',
  CLOSED_DATE: '避开闭馆日或改地点',
  OPEN_HOURS: '改为地点开放时段',
  CAPACITY: '换到更大容量地点或错峰安排'
};

export const getPlanningConflictReasonLabel = (reason) => (
  planningConflictReasonLabels[reason] || reason || '未知冲突'
);

export const getPlanningConflictHandlingTip = (reason) => (
  planningConflictHandlingTips[reason] || '需人工核对后处理'
);

export const isPlanningConflictManualRequired = (reason) => (
  planningManualRequiredReasons.has(String(reason || '').trim())
);

