export type GroupType = 'primary' | 'secondary' | 'vip' | string;

export type MustVisitMode = 'plan' | 'manual' | string;

// Backend returns mostly snake_case for groups (see backend/src/routes/groups.js hydrateGroup()).
export type Group = {
  id: number;
  name: string;
  type: GroupType;
  student_count?: number;
  teacher_count?: number;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  duration?: number;
  color?: string;
  group_code?: string;
  itinerary_plan_id?: number | null;

  must_visit_mode?: MustVisitMode;
  manual_must_visit_location_ids?: number[]; // hydrated to array

  status?: string;
  contact_person?: string;
  contact_phone?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  accommodation?: string;
  tags?: string[]; // hydrated to array
  notes?: string;
  notes_images?: string[];

  created_at?: string;
  updated_at?: string;
};

export const getGroupHeadcount = (group: Group | null | undefined): number => {
  const students = Number(group?.student_count ?? 0) || 0;
  const teachers = Number(group?.teacher_count ?? 0) || 0;
  return students + teachers;
};

const normalizeGroupType = (type: GroupType | null | undefined): string => {
  const raw = String(type || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  if (normalized === 'primary' || raw === '小学' || raw === '小學' || raw === '灏忓' || raw === 'å°å­¦') {
    return 'primary';
  }
  if (normalized === 'secondary' || raw === '中学' || raw === '中學' || raw === '涓' || raw === 'ä¸­å­¦') {
    return 'secondary';
  }
  if (normalized === 'vip') {
    return 'vip';
  }
  return normalized;
};

export const getGroupTypeLabel = (type: GroupType | null | undefined): string => {
  const normalized = normalizeGroupType(type);
  if (!normalized) return '';
  if (normalized === 'primary') return '小学';
  if (normalized === 'secondary') return '中学';
  if (normalized === 'vip') return 'VIP';
  return String(type);
};

export const isDateWithinGroupRange = (group: Group | null | undefined, dateStr: string): boolean => {
  if (!dateStr) return true;
  const start = String(group?.start_date || '').trim();
  const end = String(group?.end_date || '').trim();
  if (!start || !end) return true;
  // Dates are YYYY-MM-DD, lexicographic compare works.
  return dateStr >= start && dateStr <= end;
};
