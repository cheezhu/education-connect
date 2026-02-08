import dayjs from 'dayjs';

export default function checkConflicts({
  activityId,
  groupId,
  locationId,
  date,
  timeSlot,
  participantCount,
  activities,
  groups,
  locations
}) {
  const conflicts = [];

  // 1) Same group, same date/time slot
  const groupActivities = (activities || []).filter((activity) => (
    activity.groupId === groupId
    && activity.id !== activityId
    && activity.date === date
    && activity.timeSlot === timeSlot
  ));

  if (groupActivities.length > 0) {
    conflicts.push({
      type: 'time',
      message: '该团组在此时段已有其他活动安排'
    });
  }

  if (!locationId) return conflicts;

  const location = (locations || []).find((item) => item.id === locationId);
  if (!location) return conflicts;

  // 2) Capacity (warning only: caller may still allow)
  const locationActivities = (activities || []).filter((activity) => (
    activity.locationId === locationId
    && activity.id !== activityId
    && activity.date === date
    && activity.timeSlot === timeSlot
  ));

  const totalParticipants = locationActivities.reduce(
    (sum, activity) => sum + (Number(activity.participantCount) || 0),
    0
  ) + (Number(participantCount) || 0);

  if (Number(location.capacity) > 0 && totalParticipants > location.capacity) {
    conflicts.push({
      type: 'capacity',
      message: `地点容量超限：${totalParticipants}/${location.capacity}人`
    });
  }

  // 3) Blocked weekdays
  const dayOfWeek = dayjs(date).day();
  const blockedWeekdays = String(location.blocked_weekdays || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (blockedWeekdays.includes(String(dayOfWeek))) {
    conflicts.push({
      type: 'unavailable',
      message: `${location.name}在${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayOfWeek]}不可用`
    });
  }

  // 4) Group type match
  const group = (groups || []).find((item) => item.id === groupId);
  const targetGroups = location.target_groups || 'all';
  if (group && targetGroups !== 'all' && targetGroups !== group.type) {
    conflicts.push({
      type: 'groupType',
      message: `${location.name}不适用于${group.type === 'primary' ? '小学' : '中学'}团组`
    });
  }

  return conflicts;
}

