export const CALENDAR_DETAIL_ALERT_TEXT = {
  featureMessage: 'Google Calendar 风格日程管理',
  featureDescription:
    'V2 版本核心功能已实现，支持拖拽创建活动、调整时间、冲突检测等。',
  demoMessage: '演示模式',
  demoDescription:
    '切换到日历视图查看完整的 Google Calendar 风格界面'
};

export const CALENDAR_DETAIL_MESSAGES = {
  saveConflictDetected: '检测到排期冲突，已刷新最新版本，请重试',
  saveFailedFallback: '保存失败，请稍后重试',
  resetTitle: '确认重置行程？',
  resetContent: '将清空当前日历中的所有日程，且无法恢复。',
  resetOkText: '确认重置',
  resetCancelText: '取消',
  resetSuccess: '已清空所有日程',
  customDeleteUnavailable: '当前页面未接入自定义资源删除能力',
  customDeleteSuccess: '已删除自定义卡片',
  shixingDateFixed: '食行卡片活动日期已固定，只能调整时间',
  shixingCrossDateForbidden: '食行卡片活动不能跨日期移动',
  autoSaved: '活动已自动保存',
  selectDateFirst: '请先选择日期',
  selectDate: '请选择日期',
  endBeforeStart: '结束时间需晚于开始时间',
  mealsSynced: '三餐已同步到日历和每日卡片',
  transferDateRestricted:
    '接送站仅支持首日和末日：首日为接站，末日为送站',
  selectPlanPoint: '请选择行程点',
  activityDeletedAndSaved: '活动已删除并保存',
  noConflicts: '未发现时间冲突',
  aiAutoPlanPending: 'AI 自动排程正在接入中',
  aiOptimizePending: '路线优化能力正在接入中',
  emptyGroupHint: '请选择团组查看日程',
  activityAdded: (title) => `已添加活动：${title || ''}`,
  mealRangeInvalid: (mealLabel) => `${mealLabel}时间范围无效`,
  transferSynced: (label) => `${label}已同步到日历和每日卡片`,
  saveActivityResult: (isUpdate) => (
    isUpdate
      ? '活动已更新并保存'
      : '活动已创建并保存'
  ),
  returnedToSource: (title, sourceTitle) => `${title} 已归还到${sourceTitle}`,
  removedFromCalendar: (title) => `${title} 已移出日历`,
  conflictCount: (count) => `发现 ${count} 处时间冲突`,
  aiPromptReceived: (text) => `AI 提示已收到：${text}`
};

export const CALENDAR_DETAIL_DESIGNER_SYNC_TEXT = {
  pullNoPermission: '需要管理员权限才能拉取行程',
  pullNoData: '行程设计器暂无可拉取的行程点',
  pullFailed: '拉取失败，请稍后重试',
  pushNoPermission: '需要管理员权限才能推送行程',
  pushNoData: '当前日历暂无可推送的行程点',
  confirmTitle: '推送到行程设计器',
  confirmOkText: '推送',
  confirmCancelText: '取消',
  pushForbidden: '无权限或编辑锁被占用，推送失败',
  pushFailed: '推送失败，请稍后重试',
  pullSuccess: (count) => `已拉取 ${count} 条行程点`,
  pushSuccess: (count) => `已推送 ${count} 条行程点到行程设计器`,
  confirmContent: (count) => (
    `将覆盖行程设计器中该团组的行程点（共 ${count} 条）。确认推送？`
  )
};
