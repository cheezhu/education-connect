// Shared domain (CJS): time-slot definitions and helpers used by the backend (Node/Express).
// Keep this file pure (no framework imports) so it can be consumed from routes/services.

/**
 * @typedef {'MORNING'|'AFTERNOON'|'EVENING'} TimeSlotKey
 */

/** @type {TimeSlotKey[]} */
const timeSlotKeys = ['MORNING', 'AFTERNOON', 'EVENING'];

/** @type {Record<TimeSlotKey, {start: string, end: string}>} */
const timeSlotWindows = {
  MORNING: { start: '06:00', end: '12:00' },
  AFTERNOON: { start: '12:00', end: '18:00' },
  EVENING: { start: '18:00', end: '20:45' }
};

/**
 * Accepts "HH:MM" or "HH:MM:SS" (or a number already in minutes).
 * @param {unknown} timeValue
 * @returns {number|null}
 */
function toMinutes(timeValue) {
  if (timeValue === null || timeValue === undefined) return null;

  if (typeof timeValue === 'number') {
    return Number.isFinite(timeValue) ? timeValue : null;
  }

  const text = String(timeValue).trim();
  if (!text) return null;

  const parts = text.split(':');
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 48) return null;
  if (minute < 0 || minute >= 60) return null;
  return hour * 60 + minute;
}

/**
 * @param {unknown} startTime
 * @returns {TimeSlotKey}
 */
function getTimeSlotFromStart(startTime) {
  const minutes = toMinutes(startTime);
  if (minutes === null) return 'MORNING';
  if (minutes < 12 * 60) return 'MORNING';
  if (minutes < 18 * 60) return 'AFTERNOON';
  return 'EVENING';
}

/**
 * Resolve slot by overlap with windows. Falls back to start-time heuristic if times are invalid.
 * @param {unknown} startTime
 * @param {unknown} endTime
 * @returns {TimeSlotKey}
 */
function resolveTimeSlotByOverlap(startTime, endTime) {
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return getTimeSlotFromStart(startTime);
  }

  /** @type {TimeSlotKey|null} */
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
      bestSlot = /** @type {TimeSlotKey} */ (slotKey);
    }
  });

  if (bestSlot && bestOverlap > 0) return bestSlot;
  return getTimeSlotFromStart(startTime);
}

/**
 * Used by planning import/export; keep accepted tokens narrow and explicit.
 * @param {unknown} value
 * @returns {TimeSlotKey|''}
 */
function normalizeImportedTimeSlot(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (raw === '上午' || upper === 'MORNING') return 'MORNING';
  if (raw === '下午' || upper === 'AFTERNOON') return 'AFTERNOON';
  if (raw === '晚上' || upper === 'EVENING') return 'EVENING';
  return '';
}

/**
 * Convert "HH:MM" -> "HH:MM:00". If already has seconds, returns unchanged.
 * @param {unknown} value
 * @returns {string}
 */
function toSqlTimeString(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const parts = text.split(':');
  if (parts.length >= 3) return text;
  const hh = String(parts[0] || '').padStart(2, '0');
  const mm = String(parts[1] || '0').padStart(2, '0');
  return `${hh}:${mm}:00`;
}

/**
 * Convert "HH:MM" to a decimal hour number (e.g. 20:45 => 20.75).
 * @param {unknown} value
 * @returns {number|null}
 */
function toHours(value) {
  const minutes = toMinutes(value);
  if (!Number.isFinite(minutes)) return null;
  return minutes / 60;
}

module.exports = {
  timeSlotKeys,
  timeSlotWindows,
  toMinutes,
  toHours,
  getTimeSlotFromStart,
  resolveTimeSlotByOverlap,
  normalizeImportedTimeSlot,
  toSqlTimeString
};

