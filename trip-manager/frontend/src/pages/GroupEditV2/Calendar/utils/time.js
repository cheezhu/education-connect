export const toMinutes = (timeValue) => {
  if (!timeValue) return null;
  const [hourStr, minuteStr] = String(timeValue).split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

export const calcDurationMinutes = (startTime, endTime, fallback = 60) => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const diff = Number.isFinite(start) && Number.isFinite(end) ? (end - start) : null;
  const minutes = diff && diff > 0 ? diff : fallback;
  return minutes;
};

export const calcDurationHours = (startTime, endTime, fallbackMinutes = 60) => (
  Math.max(0.5, calcDurationMinutes(startTime, endTime, fallbackMinutes) / 60)
);

