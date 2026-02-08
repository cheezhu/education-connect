import type { ResourceId } from './resourceId';

export type ScheduleType =
  | 'visit'
  | 'meal'
  | 'transport'
  | 'rest'
  | 'activity'
  | 'free'
  | string;

// Frontend schedule shape used by Calendar Detail (backend/src/routes/schedules.js mapScheduleRow()).
export type Schedule = {
  id: number | null;
  groupId: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type?: ScheduleType;
  title?: string;
  location?: string;
  description?: string;
  color?: string | null;
  resourceId?: ResourceId | null;
  isFromResource?: boolean;
  locationId?: number | null;
};

export const normalizeSchedule = (s: any): Schedule => ({
  id: Number.isFinite(s?.id) ? s.id : (s?.id ?? null),
  groupId: Number(s?.groupId ?? s?.group_id ?? 0) || 0,
  date: String(s?.date ?? s?.activity_date ?? ''),
  startTime: String(s?.startTime ?? s?.start_time ?? ''),
  endTime: String(s?.endTime ?? s?.end_time ?? ''),
  type: s?.type,
  title: s?.title,
  location: s?.location,
  description: s?.description,
  color: s?.color ?? null,
  resourceId: (s?.resourceId ?? s?.resource_id ?? null) as any,
  isFromResource: Boolean(s?.isFromResource ?? s?.is_from_resource),
  locationId: (s?.locationId ?? s?.location_id ?? null) as any,
});

