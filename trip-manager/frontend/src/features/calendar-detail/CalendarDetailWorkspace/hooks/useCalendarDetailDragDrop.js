import { useCallback, useEffect, useRef, useState } from 'react';
import message from 'antd/es/message';
import { buildClientId } from '../utils/clientId';
import { isDailyActivity, parseDailyDate } from '../utils/calendarDetailResourceId';
import { getResourceId, isPlanResourceId } from '../../../../domain/resourceId';
import { resolveSourceMeta, resolveSourceMetaByKind } from '../../../../domain/resourceSource';
import { CALENDAR_DETAIL_MESSAGES } from '../../messages';

const EMPTY_DRAG_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';

const useCalendarDetailDragDrop = ({
  activities,
  setActivities,
  onUpdate,
  groupId,
  timeSlots,
  slotMinutes,
  slotHeight,
  headerHeight,
  calendarRef,
  visibleDays,
  timeToGridRow,
  gridRowToTime,
  getActivityIdentity,
  resolveActivityColor,
  planResources,
  setAvailablePlanResources,
  setSaveStatus,
  saveTimeoutRef
}) => {
  const [draggedActivity, setDraggedActivity] = useState(null);
  const [draggedResource, setDraggedResource] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const clearDragState = useCallback(() => {
    setDraggedActivity(null);
    setDraggedResource(null);
    setDropIndicator(null);
    setIsDragging(false);
    dragOffsetRef.current = { x: 0, y: 0 };
  }, []);

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      if (isDragging || draggedActivity || draggedResource) {
        clearDragState();
      }
    };

    document.addEventListener('dragend', handleGlobalDragEnd);
    return () => document.removeEventListener('dragend', handleGlobalDragEnd);
  }, [isDragging, draggedActivity, draggedResource, clearDragState]);

  const handleResourceDragStart = useCallback((resource) => {
    setDraggedResource(resource);
    setIsDragging(true);
  }, []);

  const handleResourceDragEnd = useCallback(() => {
    setDraggedResource(null);
    setIsDragging(false);
  }, []);

  const handleDragStart = useCallback((event, activity) => {
    setDraggedActivity(activity);
    setIsDragging(true);

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const offsetX = event.clientX - rect.left;

    dragOffsetRef.current = { x: offsetX, y: offsetY };

    const dragData = {
      ...activity,
      dragOffsetY: offsetY,
      dragOffsetX: offsetX
    };
    event.dataTransfer.setData('application/json', JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = 'move';

    const emptyImage = new Image();
    emptyImage.src = EMPTY_DRAG_IMAGE;
    event.dataTransfer.setDragImage(emptyImage, 0, 0);
  }, []);

  const handleDragEnd = useCallback((event) => {
    clearDragState();
    event.dataTransfer.clearData();
  }, [clearDragState]);

  const updateDropIndicatorForDate = useCallback((event, dateStr) => {
    if (draggedResource) return;
    if (!draggedActivity || !dateStr) return;
    if (isDailyActivity(draggedActivity) && draggedActivity.date && dateStr !== draggedActivity.date) {
      setDropIndicator(null);
      return;
    }

    const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');
    const scrollWrapper = calendarRef.current?.querySelector('.calendar-scroll-wrapper');
    if (!calendarGrid || !scrollWrapper) return;

    const wrapperRect = scrollWrapper.getBoundingClientRect();
    const scrollTop = scrollWrapper.scrollTop;
    const mouseY = event.clientY - wrapperRect.top + scrollTop;
    const activityTopY = mouseY - dragOffsetRef.current.y;

    const adjustedY = activityTopY - headerHeight;
    let targetSlotIndex;
    if (adjustedY < 0) {
      targetSlotIndex = 0;
    } else {
      targetSlotIndex = Math.round(adjustedY / slotHeight);
    }

    const originalStart = timeToGridRow(draggedActivity.startTime);
    const originalEnd = timeToGridRow(draggedActivity.endTime);
    const duration = originalEnd - originalStart;

    const maxStartIndex = Math.max(0, timeSlots.length - duration - 1);
    const constrainedIndex = Math.max(0, Math.min(maxStartIndex, targetSlotIndex));

    const dayIndex = visibleDays.findIndex((day) => day.dateStr === dateStr);
    if (dayIndex === -1) return;

    setDropIndicator({
      dayIndex,
      slotIndex: constrainedIndex,
      duration,
      time: timeSlots[constrainedIndex]
    });
  }, [
    draggedResource,
    draggedActivity,
    calendarRef,
    headerHeight,
    slotHeight,
    timeToGridRow,
    timeSlots,
    visibleDays
  ]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = draggedResource ? 'copy' : 'move';

    if (draggedResource || !draggedActivity) return;

    const targetElement = event.target.closest('.time-slot');
    if (targetElement) {
      const dateStr = targetElement.dataset.date;
      if (isDailyActivity(draggedActivity) && draggedActivity.date && dateStr && dateStr !== draggedActivity.date) {
        event.dataTransfer.dropEffect = 'none';
        setDropIndicator(null);
        return;
      }
      updateDropIndicatorForDate(event, dateStr);
    }
  }, [draggedResource, draggedActivity, updateDropIndicatorForDate]);

  const handleDragEnter = useCallback((event) => {
    event.preventDefault();
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');
    if (calendarGrid && !calendarGrid.contains(event.relatedTarget)) {
      setDropIndicator(null);
    }
  }, [calendarRef]);

  const handleDrop = useCallback((event, targetDate, targetTime) => {
    event.preventDefault();
    event.stopPropagation();

    if (draggedResource) {
      const fixedDate = draggedResource.fixedDate || parseDailyDate(draggedResource.id);
      if (fixedDate && targetDate && fixedDate !== targetDate) {
        message.warning(CALENDAR_DETAIL_MESSAGES.shixingDateFixed);
        return;
      }
      const resolvedDate = fixedDate || targetDate;
      const durationSlots = Math.max(1, Math.ceil((draggedResource.duration * 60) / slotMinutes));
      const startIndex = Math.max(0, timeSlots.indexOf(targetTime));
      const maxStartIndex = Math.max(0, timeSlots.length - durationSlots - 1);
      const constrainedIndex = Math.min(maxStartIndex, startIndex);
      const adjustedStartTime = timeSlots[constrainedIndex] || targetTime;
      const startRow = constrainedIndex + 2;
      const endRow = Math.min(startRow + durationSlots, timeSlots.length + 1);
      const endTime = gridRowToTime(endRow);
      const isMealResource = draggedResource.type === 'meal';
      const resourceTitle = isMealResource
        ? (draggedResource.title || draggedResource.description || 'Meal Arrangement')
        : draggedResource.title;
      const newActivity = {
        id: null,
        clientId: buildClientId(),
        groupId,
        date: resolvedDate,
        startTime: adjustedStartTime,
        endTime,
        type: draggedResource.type,
        title: resourceTitle,
        location: draggedResource.locationName || draggedResource.title || '',
        locationId: draggedResource.locationId || null,
        locationColor: draggedResource.locationColor || null,
        description: isMealResource ? '' : draggedResource.description,
        color: draggedResource.color || resolveActivityColor({
          type: draggedResource.type,
          locationId: draggedResource.locationId,
          locationColor: draggedResource.locationColor
        }),
        resourceId: draggedResource.id,
        planItemId: isPlanResourceId(draggedResource.id) ? draggedResource.id : null,
        isFromResource: true
      };

      const updatedActivities = [...activities, newActivity];
      setActivities(updatedActivities);
      onUpdate?.(updatedActivities);

      setDraggedResource(null);
      setIsDragging(false);

      message.success(
        CALENDAR_DETAIL_MESSAGES.activityAdded(resourceTitle || draggedResource.title),
        1
      );
      return;
    }

    if (!draggedActivity) return;

    if (isDailyActivity(draggedActivity) && draggedActivity.date && targetDate && targetDate !== draggedActivity.date) {
      message.warning(CALENDAR_DETAIL_MESSAGES.shixingCrossDateForbidden);
      return;
    }

    const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');
    const scrollWrapper = calendarRef.current?.querySelector('.calendar-scroll-wrapper');
    if (!calendarGrid || !scrollWrapper) return;

    const wrapperRect = scrollWrapper.getBoundingClientRect();
    const scrollTop = scrollWrapper.scrollTop;
    const mouseY = event.clientY - wrapperRect.top + scrollTop;

    let dragOffsetY = dragOffsetRef.current.y;
    try {
      const dragDataStr = event.dataTransfer.getData('application/json');
      if (dragDataStr) {
        const dragData = JSON.parse(dragDataStr);
        if (dragData.dragOffsetY !== undefined) {
          dragOffsetY = dragData.dragOffsetY;
        }
      }
    } catch (err) {
      // ignore malformed drag payload
    }

    const activityTopY = mouseY - dragOffsetY;

    const originalStart = timeToGridRow(draggedActivity.startTime);
    const originalEnd = timeToGridRow(draggedActivity.endTime);
    const duration = originalEnd - originalStart;

    const adjustedY = activityTopY - headerHeight;
    let targetSlotIndex;
    if (adjustedY < 0) {
      targetSlotIndex = 0;
    } else {
      targetSlotIndex = Math.round(adjustedY / slotHeight);
    }

    const maxStartIndex = Math.max(0, timeSlots.length - duration - 1);
    const constrainedIndex = Math.max(0, Math.min(maxStartIndex, targetSlotIndex));
    const adjustedStartTime = timeSlots[constrainedIndex];

    const newStartRow = timeToGridRow(adjustedStartTime);
    const newEndRow = Math.min(newStartRow + duration, timeSlots.length + 1);
    const newEndTime = gridRowToTime(newEndRow);

    const updatedActivities = activities.map((activity) => (
      getActivityIdentity(activity) === getActivityIdentity(draggedActivity)
        ? {
            ...activity,
            date: targetDate,
            startTime: adjustedStartTime,
            endTime: newEndTime
          }
        : activity
    ));

    setActivities(updatedActivities);
    setSaveStatus('saving');
    onUpdate?.(updatedActivities);

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      message.success(CALENDAR_DETAIL_MESSAGES.autoSaved, 1);
    }, 500);
  }, [
    draggedResource,
    draggedActivity,
    slotMinutes,
    timeSlots,
    gridRowToTime,
    groupId,
    resolveActivityColor,
    activities,
    setActivities,
    onUpdate,
    calendarRef,
    timeToGridRow,
    headerHeight,
    slotHeight,
    getActivityIdentity,
    setSaveStatus,
    saveTimeoutRef
  ]);

  const handleEventChipDragOver = useCallback((event, dateStr) => {
    if (!draggedActivity && !draggedResource) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = draggedResource ? 'copy' : 'move';
    updateDropIndicatorForDate(event, dateStr);
  }, [draggedActivity, draggedResource, updateDropIndicatorForDate]);

  const handleEventChipDrop = useCallback((event, targetDate, targetTime) => {
    if (!draggedActivity && !draggedResource) return;
    event.preventDefault();
    event.stopPropagation();
    handleDrop(event, targetDate, targetTime);
  }, [draggedActivity, draggedResource, handleDrop]);

  const handleResourceDrop = useCallback((event) => {
    event.preventDefault();
    if (draggedActivity) {
      const resourceId = getResourceId(draggedActivity);
      let planResource = null;

      if (resourceId) {
        planResource = planResources.find((item) => String(item.id) === String(resourceId)) || null;
      }

      if (!planResource) {
        const activityLocationId = Number(draggedActivity.locationId);
        if (Number.isFinite(activityLocationId)) {
          planResource = planResources.find((item) => Number(item.locationId) === activityLocationId) || null;
        }
      }

      if (planResource) {
        setAvailablePlanResources((prev) => {
          if (prev.find((item) => item.id === planResource.id)) {
            return prev;
          }
          return [...prev, planResource].sort((a, b) => {
            const aIndex = planResources.findIndex((item) => item.id === a.id);
            const bIndex = planResources.findIndex((item) => item.id === b.id);
            return aIndex - bIndex;
          });
        });

        const updatedActivities = activities.filter(
          (activity) => getActivityIdentity(activity) !== getActivityIdentity(draggedActivity)
        );
        setActivities(updatedActivities);
        onUpdate?.(updatedActivities);
        message.success(
          CALENDAR_DETAIL_MESSAGES.returnedToSource(
            draggedActivity.title,
            resolveSourceMetaByKind('plan').title
          ),
          1
        );
      } else {
        const updatedActivities = activities.filter(
          (activity) => getActivityIdentity(activity) !== getActivityIdentity(draggedActivity)
        );
        setActivities(updatedActivities);
        onUpdate?.(updatedActivities);
        const sourceMeta = resolveSourceMeta(draggedActivity);
        message.success(
          sourceMeta.kind === 'shixing'
            ? CALENDAR_DETAIL_MESSAGES.returnedToSource(draggedActivity.title, sourceMeta.title)
            : CALENDAR_DETAIL_MESSAGES.removedFromCalendar(draggedActivity.title),
          1
        );
      }
    }

    clearDragState();
  }, [
    draggedActivity,
    planResources,
    setAvailablePlanResources,
    activities,
    getActivityIdentity,
    setActivities,
    onUpdate,
    clearDragState
  ]);

  return {
    draggedActivity,
    draggedResource,
    dropIndicator,
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleEventChipDragOver,
    handleEventChipDrop,
    handleResourceDrop,
    handleResourceDragStart,
    handleResourceDragEnd
  };
};

export default useCalendarDetailDragDrop;

