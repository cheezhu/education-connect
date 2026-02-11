import dayjs from 'dayjs';
import { useMemo } from 'react';
import { getGroupTypeLabel } from '../../../domain/group';

import { normalizeManualMustVisitLocationIds } from '../shared/groupRules';

const GROUP_CONSOLE_SLOT_KEYS = ['MORNING', 'AFTERNOON'];
const GROUP_CONSOLE_SLOT_ORDER = {
  MORNING: 0,
  AFTERNOON: 1
};

const getGroupDateRange = (group) => {
  if (!group?.start_date || !group?.end_date) return [];
  const start = dayjs(group.start_date);
  const end = dayjs(group.end_date);
  if (!start.isValid() || !end.isValid()) return [];
  const dates = [];
  let cursor = start.startOf('day');
  while (cursor.isBefore(end, 'day') || cursor.isSame(end, 'day')) {
    dates.push(cursor.toDate());
    cursor = cursor.add(1, 'day');
  }
  return dates;
};

const isGroupActiveOnDate = (group, date) => {
  if (!group?.start_date || !group?.end_date) return false;
  const currentDate = dayjs(date);
  const start = dayjs(group.start_date);
  const end = dayjs(group.end_date);
  if (!currentDate.isValid() || !start.isValid() || !end.isValid()) return false;
  return !start.isAfter(currentDate, 'day') && !end.isBefore(currentDate, 'day');
};

export default function useGroupConsoleModel({
  groupId,
  groups,
  activities,
  locations,
  fallbackDates,
  formatDateString,
  getTimeSlotLabel
}) {
  return useMemo(() => {
    const group = groups.find(candidate => candidate.id === groupId) || null;
    const groupConsoleDates = group ? getGroupDateRange(group) : fallbackDates;

    const groupActivities = group
      ? activities.filter(activity => activity.groupId === group.id)
      : [];

    const groupActivityIndex = new Map();
    if (group) {
      groupActivities.forEach((activity) => {
        if (!GROUP_CONSOLE_SLOT_KEYS.includes(activity.timeSlot)) return;
        const key = `${activity.date}|${activity.timeSlot}`;
        if (!groupActivityIndex.has(key)) {
          groupActivityIndex.set(key, []);
        }
        groupActivityIndex.get(key).push(activity);
      });
    }

    const locationMap = new Map(locations.map(location => [Number(location.id), location]));

    const groupConsoleMustVisitIds = Array.from(new Set(
      normalizeManualMustVisitLocationIds(group?.manual_must_visit_location_ids)
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && id > 0)
    ));
    const groupConsoleMustVisitIdSet = new Set(groupConsoleMustVisitIds);

    const groupConsoleMustVisitActivityMap = new Map();
    groupActivities.forEach((activity) => {
      if (!GROUP_CONSOLE_SLOT_KEYS.includes(activity.timeSlot)) return;
      const locationId = Number(activity.locationId);
      if (!Number.isFinite(locationId) || !groupConsoleMustVisitIdSet.has(locationId)) return;
      if (!groupConsoleMustVisitActivityMap.has(locationId)) {
        groupConsoleMustVisitActivityMap.set(locationId, []);
      }
      groupConsoleMustVisitActivityMap.get(locationId).push(activity);
    });

    groupConsoleMustVisitActivityMap.forEach((items) => {
      items.sort((left, right) => {
        if (left.date !== right.date) return String(left.date).localeCompare(String(right.date), 'zh-CN');
        return (GROUP_CONSOLE_SLOT_ORDER[left.timeSlot] ?? 99) - (GROUP_CONSOLE_SLOT_ORDER[right.timeSlot] ?? 99);
      });
    });

    const groupConsoleMustVisitCards = groupConsoleMustVisitIds.map((locationId) => {
      const location = locationMap.get(locationId);
      const assignedActivities = groupConsoleMustVisitActivityMap.get(locationId) || [];
      return {
        locationId,
        locationName: location?.name || `#${locationId}`,
        assignedActivity: assignedActivities[0] || null,
        duplicateCount: Math.max(0, assignedActivities.length - 1)
      };
    });
    const groupConsoleUnassignedMustVisitCards = groupConsoleMustVisitCards.filter(
      (card) => !card.assignedActivity
    );
    const groupConsoleAssignedMustVisitCount = groupConsoleMustVisitCards.length - groupConsoleUnassignedMustVisitCards.length;

    const groupConsoleSchedule = GROUP_CONSOLE_SLOT_KEYS.map((slotKey) => ({
      key: slotKey,
      label: getTimeSlotLabel(slotKey),
      cells: groupConsoleDates.map((date) => {
        const dateString = formatDateString(date);
        const inactive = !group || !isGroupActiveOnDate(group, date);
        const items = (groupActivityIndex.get(`${dateString}|${slotKey}`) || [])
          .slice()
          .sort((left, right) => Number(left.id) - Number(right.id))
          .map((activity) => {
            const locationId = Number(activity.locationId);
            const location = locationMap.get(locationId);
            const locationName = location?.name
              || (activity?.notes ? String(activity.notes) : '')
              || '未设置场地';
            return {
              ...activity,
              locationId,
              locationName,
              isMustVisit: Number.isFinite(locationId) && groupConsoleMustVisitIdSet.has(locationId)
            };
          });
        return {
          key: `${dateString}|${slotKey}`,
          date,
          dateString,
          inactive,
          activities: items
        };
      })
    }));

    const groupConsoleTypeLabel = getGroupTypeLabel(group?.type) || '团组';

    return {
      groupCalendarSlotKeys: GROUP_CONSOLE_SLOT_KEYS,
      groupCalendarGroup: group,
      groupCalendarActivities: groupActivities,
      groupConsoleDates,
      groupConsoleSchedule,
      groupConsoleTypeLabel,
      groupConsoleMustVisitMode: 'manual',
      groupConsoleActivePlan: null,
      groupConsoleMustVisitIdSet,
      groupConsoleMustVisitActivityMap,
      groupConsoleMustVisitCards,
      groupConsoleUnassignedMustVisitCards,
      groupConsoleAssignedMustVisitCount
    };
  }, [groupId, groups, activities, locations, fallbackDates, formatDateString, getTimeSlotLabel]);
}
