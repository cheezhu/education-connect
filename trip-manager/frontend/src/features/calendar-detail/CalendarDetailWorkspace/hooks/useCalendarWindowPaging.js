import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildCalendarDays, computeWindow, generateTimeSlots } from '../model/calendarWindow';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const useCalendarWindowPaging = ({
  groupId,
  startDate,
  endDate,
  startHour,
  endHour,
  slotMinutes,
  defaultWindowDays,
  maxFullDays
}) => {
  const [viewStartIndex, setViewStartIndex] = useState(0);

  const days = useMemo(() => buildCalendarDays({
    startDate,
    endDate
  }), [startDate, endDate]);

  const timeSlots = useMemo(() => generateTimeSlots({
    startHour,
    endHour,
    slotMinutes
  }), [startHour, endHour, slotMinutes]);

  const viewSpan = defaultWindowDays;
  const {
    hasPaging,
    maxViewStartIndex,
    windowStartIndex,
    visibleDays
  } = computeWindow({
    days,
    viewStartIndex,
    viewSpan,
    maxFullDays
  });

  useEffect(() => {
    // Reset to the first window when switching groups.
    setViewStartIndex(0);
  }, [groupId]);

  useEffect(() => {
    if (!hasPaging) {
      if (viewStartIndex !== 0) {
        setViewStartIndex(0);
      }
      return;
    }
    if (viewStartIndex !== windowStartIndex) {
      setViewStartIndex(windowStartIndex);
    }
  }, [hasPaging, viewStartIndex, windowStartIndex]);

  const setWindowToIncludeDate = useCallback((dateStr) => {
    if (!hasPaging) return;
    if (!dateStr) return;
    const targetIndex = days.findIndex((day) => day.dateStr === dateStr);
    if (targetIndex < 0) return;
    const centeredStart = targetIndex - Math.floor(viewSpan / 2);
    setViewStartIndex(clamp(centeredStart, 0, maxViewStartIndex));
  }, [hasPaging, days, viewSpan, maxViewStartIndex]);

  const handleJumpPrevDay = useCallback(() => {
    if (!hasPaging) return;
    setViewStartIndex((prev) => clamp(prev - 1, 0, maxViewStartIndex));
  }, [hasPaging, maxViewStartIndex]);

  const handleJumpNextDay = useCallback(() => {
    if (!hasPaging) return;
    setViewStartIndex((prev) => clamp(prev + 1, 0, maxViewStartIndex));
  }, [hasPaging, maxViewStartIndex]);

  const handleJumpPrevChunk = useCallback(() => {
    if (!hasPaging) return;
    setViewStartIndex((prev) => clamp(prev - viewSpan, 0, maxViewStartIndex));
  }, [hasPaging, viewSpan, maxViewStartIndex]);

  const handleJumpNextChunk = useCallback(() => {
    if (!hasPaging) return;
    setViewStartIndex((prev) => clamp(prev + viewSpan, 0, maxViewStartIndex));
  }, [hasPaging, viewSpan, maxViewStartIndex]);

  return {
    days,
    timeSlots,
    viewSpan,
    hasPaging,
    maxViewStartIndex,
    windowStartIndex,
    visibleDays,
    setWindowToIncludeDate,
    handleJumpPrevDay,
    handleJumpNextDay,
    handleJumpPrevChunk,
    handleJumpNextChunk
  };
};

export default useCalendarWindowPaging;
