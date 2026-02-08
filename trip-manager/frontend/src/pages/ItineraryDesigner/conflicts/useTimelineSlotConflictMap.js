import dayjs from 'dayjs';
import { useMemo } from 'react';

export default function useTimelineSlotConflictMap({
  activities,
  selectedGroups,
  groups,
  locations
}) {
  const groupsById = useMemo(() => (
    new Map((groups || []).map(group => [Number(group.id), group]))
  ), [groups]);

  const locationsById = useMemo(() => (
    new Map((locations || []).map(location => [Number(location.id), location]))
  ), [locations]);

  return useMemo(() => {
    const buildTimelineSlotConflicts = (dateString, slotActivities) => {
      if (!Array.isArray(slotActivities) || slotActivities.length === 0) return [];

      const conflicts = [];
      const conflictKeys = new Set();
      const weekdayIndex = dayjs(dateString).day();
      const weekdayLabel = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][weekdayIndex] || '当日';

      const pushConflict = (conflict) => {
        const dedupeKey = `${conflict.type}|${conflict.groupId || ''}|${conflict.locationId || ''}|${conflict.message}`;
        if (conflictKeys.has(dedupeKey)) return;
        conflictKeys.add(dedupeKey);
        conflicts.push(conflict);
      };

      const groupBuckets = new Map();
      slotActivities.forEach((activity) => {
        const groupId = Number(activity.groupId);
        if (!Number.isFinite(groupId)) return;
        if (!groupBuckets.has(groupId)) {
          groupBuckets.set(groupId, []);
        }
        groupBuckets.get(groupId).push(activity);
      });
      groupBuckets.forEach((groupActivities, groupId) => {
        if (groupActivities.length <= 1) return;
        const group = groupsById.get(groupId);
        pushConflict({
          type: 'GROUP_TIME_CONFLICT',
          groupId,
          groupName: group?.name || `#${groupId}`,
          message: `${group?.name || `#${groupId}`} 在同一时段有 ${groupActivities.length} 条活动安排`
        });
      });

      const locationBuckets = new Map();
      slotActivities.forEach((activity) => {
        const locationId = Number(activity.locationId);
        if (!Number.isFinite(locationId) || locationId <= 0) return;
        if (!locationBuckets.has(locationId)) {
          locationBuckets.set(locationId, []);
        }
        locationBuckets.get(locationId).push(activity);
      });
      locationBuckets.forEach((locationActivities, locationId) => {
        const location = locationsById.get(locationId);
        if (!location) return;
        const capacity = Number(location.capacity);
        if (!Number.isFinite(capacity) || capacity <= 0) return;
        const totalParticipants = locationActivities.reduce(
          (sum, activity) => sum + Number(activity.participantCount || 0),
          0
        );
        if (totalParticipants <= capacity) return;
        pushConflict({
          type: 'CAPACITY',
          locationId,
          locationName: location.name || `#${locationId}`,
          message: `${location.name || `#${locationId}`} 容量超限：${totalParticipants}/${capacity} 人`
        });
      });

      slotActivities.forEach((activity) => {
        const groupId = Number(activity.groupId);
        const locationId = Number(activity.locationId);
        const group = groupsById.get(groupId);
        const location = locationsById.get(locationId);
        if (!group || !location) return;

        const blockedWeekdays = String(location.blocked_weekdays || '')
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);
        if (blockedWeekdays.includes(String(weekdayIndex))) {
          pushConflict({
            type: 'BLOCKED_WEEKDAY',
            groupId,
            groupName: group.name || `#${groupId}`,
            locationId,
            locationName: location.name || `#${locationId}`,
            message: `${location.name || `#${locationId}`} 在 ${weekdayLabel} 不可用`
          });
        }

        const targetGroups = String(location.target_groups || 'all').trim();
        if (targetGroups !== 'all' && targetGroups !== group.type) {
          pushConflict({
            type: 'GROUP_TYPE',
            groupId,
            groupName: group.name || `#${groupId}`,
            locationId,
            locationName: location.name || `#${locationId}`,
            message: `${location.name || `#${locationId}`} 不适用于${group.type === 'primary' ? '小学' : '中学'}团组`
          });
        }
      });

      return conflicts;
    };

    const slotActivityMap = new Map();
    (activities || []).forEach((activity) => {
      if (!selectedGroups.includes(activity.groupId)) return;
      const key = `${activity.date}|${activity.timeSlot}`;
      if (!slotActivityMap.has(key)) {
        slotActivityMap.set(key, []);
      }
      slotActivityMap.get(key).push(activity);
    });

    const result = new Map();
    slotActivityMap.forEach((slotActivities, key) => {
      const [dateString, timeSlot] = key.split('|');
      const conflicts = buildTimelineSlotConflicts(dateString, slotActivities);
      if (!conflicts.length) return;
      result.set(key, {
        key,
        date: dateString,
        timeSlot,
        activities: slotActivities,
        conflicts
      });
    });
    return result;
  }, [activities, selectedGroups, groupsById, locationsById]);
}

