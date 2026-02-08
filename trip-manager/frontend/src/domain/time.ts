// Frontend keeps importing from "@/domain" stable, but runtime truth comes from ../shared so
// backend + frontend stay in sync.
//
// Vite dev server is configured to allow importing from ../shared in `frontend/vite.config.js`.
// eslint-disable-next-line import/no-unresolved
import * as sharedTimeModule from '../../../shared/domain/time.mjs';

export type TimeSlotKey = 'MORNING' | 'AFTERNOON' | 'EVENING';

type SharedTime = {
  timeSlotKeys: TimeSlotKey[];
  timeSlotWindows: Record<TimeSlotKey, { start: string; end: string }>;
  toMinutes: (value: unknown) => number | null;
  getTimeSlotFromStart: (value: unknown) => TimeSlotKey;
  resolveTimeSlotByOverlap: (start: unknown, end: unknown) => TimeSlotKey;
  normalizeImportedTimeSlot: (value: unknown) => TimeSlotKey | '';
};

const shared = sharedTimeModule as unknown as SharedTime;

export const timeSlotKeys: TimeSlotKey[] = shared.timeSlotKeys;

export const timeSlotWindows: Record<TimeSlotKey, { start: string; end: string }> =
  shared.timeSlotWindows;

export const toMinutes = (timeValue: unknown): number | null => shared.toMinutes(timeValue);

export const calcDurationMinutes = (
  startTime: unknown,
  endTime: unknown,
  fallback = 60
): number => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const diff = Number.isFinite(start) && Number.isFinite(end) ? (end - start) : null;
  const minutes = diff && diff > 0 ? diff : fallback;
  return minutes;
};

export const calcDurationHours = (
  startTime: unknown,
  endTime: unknown,
  fallbackMinutes = 60
): number => Math.max(0.5, calcDurationMinutes(startTime, endTime, fallbackMinutes) / 60);

export const getTimeSlotFromStart = (startTime: unknown): TimeSlotKey => {
  return shared.getTimeSlotFromStart(startTime);
};

export const resolveTimeSlotByOverlap = (startTime: unknown, endTime: unknown): TimeSlotKey => {
  return shared.resolveTimeSlotByOverlap(startTime, endTime);
};

// Used by planning import/export; keep the accepted tokens narrow and explicit.
export const normalizeImportedTimeSlot = (value: unknown): TimeSlotKey | '' => {
  return shared.normalizeImportedTimeSlot(value);
};

