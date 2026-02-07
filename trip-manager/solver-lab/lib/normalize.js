const { isValidDateString } = require('./date');

const DEFAULT_SLOT_WINDOWS = {
  MORNING: { start: 6, end: 12 },
  AFTERNOON: { start: 12, end: 18 },
  EVENING: { start: 18, end: 20.75 }
};

const toPositiveNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
};

const parseBlockedWeekdays = (value) => {
  if (Array.isArray(value)) {
    return new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
    );
  }
  if (typeof value !== 'string') return new Set();
  return new Set(
    value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
  );
};

const parseClosedDates = (value) => {
  if (Array.isArray(value)) {
    return new Set(value.filter(isValidDateString));
  }
  if (typeof value !== 'string') return new Set();
  return new Set(
    value
      .split(/[,\uFF0C\u3001;|]/)
      .map((item) => item.trim())
      .filter(isValidDateString)
  );
};

const normalizeSlotWindows = (rules = {}) => {
  const input = rules.slotWindows && typeof rules.slotWindows === 'object'
    ? rules.slotWindows
    : {};
  const result = {};
  Object.entries(DEFAULT_SLOT_WINDOWS).forEach(([slotKey, defaults]) => {
    const candidate = input[slotKey] || {};
    result[slotKey] = {
      start: toPositiveNumber(candidate.start, defaults.start),
      end: toPositiveNumber(candidate.end, defaults.end)
    };
  });
  return result;
};

const normalizeInput = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Input payload must be an object');
  }
  if (payload.schema !== 'ec-planning-input@2') {
    throw new Error(`Unsupported schema: ${payload.schema || 'unknown'}`);
  }
  const scope = payload.scope || {};
  const startDate = String(scope.startDate || '').trim();
  const endDate = String(scope.endDate || '').trim();
  if (!isValidDateString(startDate) || !isValidDateString(endDate) || startDate > endDate) {
    throw new Error('Invalid scope date range');
  }

  const rules = payload.rules && typeof payload.rules === 'object' ? payload.rules : {};
  const slotWindows = normalizeSlotWindows(rules);
  const slotKeysRaw = Array.isArray(rules.timeSlots) ? rules.timeSlots : Object.keys(slotWindows);
  const slotKeys = Array.from(new Set(
    slotKeysRaw
      .map((slot) => String(slot || '').toUpperCase().trim())
      .filter((slot) => Boolean(slotWindows[slot]))
  ));
  if (slotKeys.length === 0) {
    slotKeys.push('MORNING', 'AFTERNOON');
  }

  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const locations = Array.isArray(data.locations) ? data.locations : [];
  const existingAssignments = Array.isArray(data.existingAssignments)
    ? data.existingAssignments
    : [];

  const normalizedGroups = groups
    .map((group) => {
      const id = Number(group.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      const start = String(group.startDate || '').trim();
      const end = String(group.endDate || '').trim();
      if (!isValidDateString(start) || !isValidDateString(end) || start > end) return null;
      const studentCount = Math.max(0, Math.floor(toPositiveNumber(group.studentCount, 0)));
      const teacherCount = Math.max(0, Math.floor(toPositiveNumber(group.teacherCount, 0)));
      const participantCount = Math.max(
        1,
        Math.floor(toPositiveNumber(group.participantCount, studentCount + teacherCount || 1))
      );
      return {
        id,
        name: String(group.name || '').trim() || `#${id}`,
        type: String(group.type || '').trim() || 'all',
        startDate: start,
        endDate: end,
        participantCount
      };
    })
    .filter(Boolean);

  const normalizedLocations = locations
    .map((location) => {
      const id = Number(location.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      const capacity = toPositiveNumber(location.capacity, 0);
      const openHours = location.openHours && typeof location.openHours === 'object'
        ? location.openHours
        : null;
      return {
        id,
        name: String(location.name || '').trim() || `#${id}`,
        targetGroups: String(location.targetGroups || 'all').trim() || 'all',
        isActive: Boolean(location.isActive),
        capacity: Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : 0,
        blockedWeekdays: parseBlockedWeekdays(location.blockedWeekdays),
        closedDates: parseClosedDates(location.closedDates),
        openHours
      };
    })
    .filter(Boolean);

  const requiredLocationsByGroup = {};
  const rawRequired = data.requiredLocationsByGroup && typeof data.requiredLocationsByGroup === 'object'
    ? data.requiredLocationsByGroup
    : {};
  Object.entries(rawRequired).forEach(([groupKey, row]) => {
    const ids = Array.isArray(row?.locationIds) ? row.locationIds : [];
    const normalizedIds = Array.from(new Set(
      ids
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)
    ));
    requiredLocationsByGroup[String(groupKey)] = new Set(normalizedIds);
  });

  const normalizedExistingAssignments = existingAssignments
    .map((item) => {
      const groupId = Number(item.groupId);
      const locationId = Number(item.locationId);
      const date = String(item.date || '').trim();
      const timeSlot = String(item.timeSlot || '').toUpperCase().trim();
      const participantCount = Math.max(1, Math.floor(toPositiveNumber(item.participantCount, 1)));
      if (!Number.isFinite(groupId) || groupId <= 0) return null;
      if (!Number.isFinite(locationId) || locationId <= 0) return null;
      if (!isValidDateString(date)) return null;
      if (!slotKeys.includes(timeSlot)) return null;
      return {
        groupId,
        locationId,
        date,
        timeSlot,
        participantCount
      };
    })
    .filter(Boolean);

  return {
    raw: payload,
    scope: { startDate, endDate },
    slotKeys,
    slotWindows,
    groups: normalizedGroups,
    locations: normalizedLocations,
    requiredLocationsByGroup,
    existingAssignments: normalizedExistingAssignments
  };
};

module.exports = {
  normalizeInput
};

