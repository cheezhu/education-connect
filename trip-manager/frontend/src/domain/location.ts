export type TargetGroups = 'primary' | 'secondary' | 'all' | string;

// Backend returns locations as DB rows (snake_case).
export type Location = {
  id: number;
  name: string;
  address?: string;
  capacity?: number;
  color?: string;
  contact_person?: string;
  contact_phone?: string;
  blocked_weekdays?: string; // e.g. "3,4"
  open_hours?: string | null; // JSON string
  closed_dates?: string | null; // JSON array string
  target_groups?: TargetGroups;
  notes?: string;
  is_active?: number | boolean;

  // Newer field used for solver clustering preference (stored as 0/1 in DB).
  cluster_prefer_same_day?: number | boolean;

  created_at?: string;
  updated_at?: string;
};

export const isLocationActive = (location: Location | null | undefined): boolean => {
  const raw = location?.is_active;
  if (raw === undefined || raw === null) return true;
  if (typeof raw === 'boolean') return raw;
  return Number(raw) !== 0;
};

export const prefersSameDayClustering = (location: Location | null | undefined): boolean => {
  const raw = location?.cluster_prefer_same_day;
  if (raw === undefined || raw === null) return false;
  if (typeof raw === 'boolean') return raw;
  return Number(raw) !== 0;
};

