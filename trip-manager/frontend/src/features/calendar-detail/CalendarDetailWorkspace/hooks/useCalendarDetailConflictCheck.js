import { useCallback } from 'react';
import message from 'antd/es/message';
import { CALENDAR_DETAIL_MESSAGES } from '../../messages';

const useCalendarDetailConflictCheck = ({
  activities,
  timeToGridRow
}) => {
  const detectOverlaps = useCallback((items) => {
    const groups = {};

    items.forEach((activity) => {
      const key = `${activity.date}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(activity);
    });

    Object.keys(groups).forEach((dateKey) => {
      const dayActivities = groups[dateKey].sort((a, b) => (
        timeToGridRow(a.startTime) - timeToGridRow(b.startTime)
      ));

      const overlaps = [];
      for (let i = 0; i < dayActivities.length; i += 1) {
        const current = dayActivities[i];
        const currentStart = timeToGridRow(current.startTime);
        const currentEnd = timeToGridRow(current.endTime);

        const overlapGroup = [current];

        for (let j = i + 1; j < dayActivities.length; j += 1) {
          const next = dayActivities[j];
          const nextStart = timeToGridRow(next.startTime);
          const nextEnd = timeToGridRow(next.endTime);

          if (nextStart < currentEnd && nextEnd > currentStart) {
            overlapGroup.push(next);
          }
        }

        if (overlapGroup.length > 1) {
          overlaps.push(overlapGroup);
        }
      }

      groups[dateKey] = { activities: dayActivities, overlaps };
    });

    return groups;
  }, [timeToGridRow]);

  const handleCheckConflicts = useCallback(() => {
    const dayGroups = detectOverlaps(activities || []);
    const conflictCount = Object.values(dayGroups).reduce((sum, day) => (
      sum + (day.overlaps?.length || 0)
    ), 0);
    if (conflictCount === 0) {
      message.success(CALENDAR_DETAIL_MESSAGES.noConflicts, 1);
    } else {
      message.warning(CALENDAR_DETAIL_MESSAGES.conflictCount(conflictCount), 2);
    }
  }, [activities, detectOverlaps]);

  return {
    detectOverlaps,
    handleCheckConflicts
  };
};

export default useCalendarDetailConflictCheck;
