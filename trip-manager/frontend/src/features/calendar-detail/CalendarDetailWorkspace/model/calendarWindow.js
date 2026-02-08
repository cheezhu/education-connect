// Pure helpers for CalendarDetailWorkspace: date range -> days and paging windowing.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const generateTimeSlots = ({ startHour, endHour, slotMinutes }) => {
  const slots = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    for (let minute = 0; minute < 60; minute += slotMinutes) {
      slots.push(
        `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      );
    }
  }
  return slots;
};

export const buildCalendarDays = ({ startDate, endDate }) => {
  if (!startDate || !endDate) return [];

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const days = [];
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const dayNamesFull = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

    days.push({
      date: new Date(d),
      dateStr: d.toISOString().split('T')[0],
      dayName: dayNames[d.getDay()],
      dayNameFull: dayNamesFull[d.getDay()],
      month: d.getMonth() + 1,
      day: d.getDate(),
      isToday,
      isWeekend
    });
  }

  return days;
};

export const computeWindow = ({ days, viewStartIndex, viewSpan, maxFullDays }) => {
  const safeDays = Array.isArray(days) ? days : [];
  const safeSpan = Math.max(1, Number(viewSpan) || 1);
  const hasPaging = safeDays.length > maxFullDays;
  const maxViewStartIndex = hasPaging ? Math.max(0, safeDays.length - safeSpan) : 0;
  const windowStartIndex = hasPaging ? clamp(Number(viewStartIndex) || 0, 0, maxViewStartIndex) : 0;
  const visibleDays = hasPaging
    ? safeDays.slice(windowStartIndex, windowStartIndex + safeSpan)
    : safeDays;

  return {
    hasPaging,
    maxViewStartIndex,
    windowStartIndex,
    visibleDays
  };
};

