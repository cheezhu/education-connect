import { useCallback, useState } from 'react';

const useCalendarDetailResize = ({
  activities,
  setActivities,
  calendarRef,
  slotHeight,
  timeSlots,
  headerHeight,
  timeToGridRow,
  getActivityIdentity,
  onUpdate,
  setSaveStatus,
  saveTimeoutRef
}) => {
  const [resizingActivity, setResizingActivity] = useState(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = useCallback((event, activity) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    setResizingActivity(activity);
    setIsResizing(true);

    let latestActivities = activities;
    let isResizingNow = true;
    const initialMouseY = event.clientY;
    let hasMovedEnough = false;

    const handleMouseMove = (moveEvent) => {
      if (!isResizingNow || moveEvent.buttons !== 1) {
        handleMouseUp();
        return;
      }

      const mouseDelta = moveEvent.clientY - initialMouseY;
      if (!hasMovedEnough && Math.abs(mouseDelta) < 10) {
        return;
      }
      hasMovedEnough = true;

      const scrollWrapper = calendarRef.current?.querySelector('.calendar-scroll-wrapper');
      const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');

      if (!scrollWrapper || !calendarGrid) return;

      const wrapperRect = scrollWrapper.getBoundingClientRect();
      const scrollTop = scrollWrapper.scrollTop;
      const relativeY = moveEvent.clientY - wrapperRect.top + scrollTop;

      const adjustedY = relativeY - headerHeight;
      const slotIndex = Math.max(0, Math.round(adjustedY / slotHeight));

      const maxSlots = timeSlots.length - 1;
      const constrainedSlotIndex = Math.min(slotIndex, maxSlots);

      const newEndTime = timeSlots[constrainedSlotIndex];
      if (!newEndTime) return;

      const startRow = timeToGridRow(activity.startTime);
      const endRow = timeToGridRow(newEndTime);

      if (endRow > startRow) {
        const updatedActivities = latestActivities.map((act) => (
          getActivityIdentity(act) === getActivityIdentity(activity)
            ? { ...act, endTime: newEndTime }
            : act
        ));

        latestActivities = updatedActivities;
        setActivities(updatedActivities);
      }
    };

    const handleMouseUp = () => {
      if (!isResizingNow) return;

      isResizingNow = false;
      setIsResizing(false);
      setResizingActivity(null);

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseUp);

      setSaveStatus('saving');
      onUpdate?.(latestActivities);

      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saved');
      }, 500);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp);
  }, [
    activities,
    setActivities,
    calendarRef,
    headerHeight,
    slotHeight,
    timeSlots,
    timeToGridRow,
    getActivityIdentity,
    setSaveStatus,
    onUpdate,
    saveTimeoutRef
  ]);

  return {
    resizingActivity,
    isResizing,
    handleResizeStart
  };
};

export default useCalendarDetailResize;
