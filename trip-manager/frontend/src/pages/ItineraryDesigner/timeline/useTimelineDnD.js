import message from 'antd/es/message';
import { useCallback, useState } from 'react';

import { getLocationUnavailableReason } from '../shared/locationAvailability';

export default function useTimelineDnD({
  groups,
  locations,
  isDateWithinGroupRange,
  formatDateString,
  onUpdateActivity
}) {
  const [draggedActivity, setDraggedActivity] = useState(null);

  const handleDragStart = useCallback((event, activity) => {
    setDraggedActivity(activity);
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', '');
    }

    setTimeout(() => {
      event?.target?.classList?.add('dragging');
    }, 0);
  }, []);

  const handleDragEnd = useCallback((event) => {
    event?.target?.classList?.remove('dragging');
    setDraggedActivity(null);
  }, []);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    if (event?.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }, []);

  const handleDragEnter = useCallback((event) => {
    event.preventDefault();
    if (event?.currentTarget?.classList?.contains('timeline-cell')) {
      event.currentTarget.classList.add('drag-over');
    }
  }, []);

  const handleDragLeave = useCallback((event) => {
    if (event?.currentTarget?.classList?.contains('timeline-cell')) {
      event.currentTarget.classList.remove('drag-over');
    }
  }, []);

  const handleDrop = useCallback(async (event, targetDate, targetTimeSlot) => {
    event.preventDefault();
    if (event?.currentTarget?.classList?.contains('timeline-cell')) {
      event.currentTarget.classList.remove('drag-over');
    }

    if (!draggedActivity) return;

    const targetDateString = formatDateString(targetDate);
    const targetGroup = (groups || []).find(group => group.id === draggedActivity.groupId);
    if (!isDateWithinGroupRange(targetGroup, targetDateString)) {
      message.warning('不能拖入团组行程区间外的日期');
      return;
    }

    const targetLocation = (locations || []).find(location => location.id === draggedActivity.locationId);
    const locationUnavailableReason = getLocationUnavailableReason(targetLocation, targetDateString);
    if (locationUnavailableReason) {
      message.warning(locationUnavailableReason);
      return;
    }

    if (draggedActivity.date === targetDateString && draggedActivity.timeSlot === targetTimeSlot) {
      return;
    }

    try {
      await onUpdateActivity?.(draggedActivity.id, {
        date: targetDateString,
        timeSlot: targetTimeSlot,
        ignoreConflicts: true
      });
      message.success('活动时间调整成功');
    } catch (error) {
      const errorMessage = error?.response?.data?.conflicts?.[0]?.message
        || error?.response?.data?.error
        || '调整活动时间失败';
      message.error(errorMessage);
    }
  }, [draggedActivity, formatDateString, groups, isDateWithinGroupRange, locations, onUpdateActivity]);

  return {
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop
  };
}
