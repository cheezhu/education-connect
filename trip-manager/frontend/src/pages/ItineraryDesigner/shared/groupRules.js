import dayjs from 'dayjs';

export const normalizeMustVisitMode = (value, fallback = 'plan') => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'plan' || mode === 'manual') {
    return mode;
  }
  return fallback;
};

export const extractPlanLocationIds = (items = []) => (
  Array.from(new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => Number(item?.location_id ?? item?.locationId))
      .filter((id) => Number.isFinite(id) && id > 0)
  ))
);

export const normalizeManualMustVisitLocationIds = (value) => {
  if (Array.isArray(value)) {
    return Array.from(new Set(
      value
        .map(item => Number(item))
        .filter(id => Number.isFinite(id) && id > 0)
    ));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeManualMustVisitLocationIds(parsed);
      }
    } catch (error) {
      // ignore parse error and fallback to split
    }
    return Array.from(new Set(
      trimmed
        .split(/[,\uFF0C\u3001;|]/)
        .map(item => Number(item.trim()))
        .filter(id => Number.isFinite(id) && id > 0)
    ));
  }

  return [];
};

export const isDateWithinGroupRange = (group, dateString) => {
  if (!group?.start_date || !group?.end_date) return true;
  const target = dayjs(dateString);
  if (!target.isValid()) return false;
  return !target.isBefore(group.start_date, 'day') && !target.isAfter(group.end_date, 'day');
};

export const isGroupMissingMustVisitConfig = (group, itineraryPlanById) => {
  if (!group) return false;
  const manualIds = normalizeManualMustVisitLocationIds(group.manual_must_visit_location_ids);
  const normalizedMode = String(
    group.must_visit_mode || (manualIds.length > 0 ? 'manual' : 'plan')
  ).trim().toLowerCase();

  if (normalizedMode === 'manual') {
    return manualIds.length === 0;
  }

  const planId = Number(group.itinerary_plan_id);
  if (!Number.isFinite(planId) || planId <= 0) {
    return true;
  }

  const plan = itineraryPlanById?.get ? itineraryPlanById.get(planId) : null;
  return !plan || !Array.isArray(plan.items) || plan.items.length === 0;
};

