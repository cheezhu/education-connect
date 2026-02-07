export const timeSlotKeys = ['MORNING', 'AFTERNOON', 'EVENING'];

export const timeSlotWindows = {
  MORNING: { start: '06:00', end: '12:00' },
  AFTERNOON: { start: '12:00', end: '18:00' },
  EVENING: { start: '18:00', end: '20:45' }
};

export const toMinutes = (timeValue) => {
  if (!timeValue || typeof timeValue !== 'string') return null;
  const [hourStr, minuteStr] = timeValue.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

export const getTimeSlotFromStart = (startTime) => {
  const minutes = toMinutes(startTime);
  if (minutes === null) return 'MORNING';
  if (minutes < 12 * 60) return 'MORNING';
  if (minutes < 18 * 60) return 'AFTERNOON';
  return 'EVENING';
};

export const resolveTimeSlotByOverlap = (startTime, endTime) => {
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return getTimeSlotFromStart(startTime);
  }

  let bestSlot = null;
  let bestOverlap = -1;
  Object.entries(timeSlotWindows).forEach(([slotKey, window]) => {
    const windowStart = toMinutes(window.start);
    const windowEnd = toMinutes(window.end);
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) return;
    const overlap = Math.max(
      0,
      Math.min(endMinutes, windowEnd) - Math.max(startMinutes, windowStart)
    );
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestSlot = slotKey;
    }
  });

  if (bestSlot && bestOverlap > 0) {
    return bestSlot;
  }
  return getTimeSlotFromStart(startTime);
};

export const normalizeImportedTimeSlot = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized === '上午') return 'MORNING';
  if (normalized === '下午') return 'AFTERNOON';
  if (normalized === '晚上') return 'EVENING';
  if (normalized === 'MORNING' || normalized === 'AFTERNOON' || normalized === 'EVENING') {
    return normalized;
  }
  return '';
};

