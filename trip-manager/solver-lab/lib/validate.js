const {
  makeUsageKey,
  makeGroupSlotKey,
  isLocationAvailable
} = require('./constraints');

const validateSolution = (input, assignments) => {
  const hardViolations = [];
  const mustVisitMissing = [];
  const groupById = new Map(input.groups.map((group) => [group.id, group]));
  const locationById = new Map(input.locations.map((location) => [location.id, location]));
  const groupSlotSet = new Set();
  const usageMap = new Map();
  const coverageMap = new Map();

  const addViolation = (type, message, meta = {}) => {
    hardViolations.push({ type, message, ...meta });
  };

  const addCoverage = (groupId, locationId) => {
    const key = `${groupId}|${locationId}`;
    coverageMap.set(key, Number(coverageMap.get(key) || 0) + 1);
  };

  (Array.isArray(assignments) ? assignments : []).forEach((item, index) => {
    const groupId = Number(item.groupId ?? item.group_id);
    const locationId = Number(item.locationId ?? item.location_id);
    const date = String(item.date || '').trim();
    const timeSlot = String(item.timeSlot || item.time_slot || '').toUpperCase().trim();
    const participantRaw = (item.participantCount ?? item.participant_count ?? 1);
    const participantCount = Math.max(1, Number(participantRaw));
    const group = groupById.get(groupId);
    const location = locationById.get(locationId);

    if (!group) {
      addViolation('missing_group', `Assignment[${index}] group not found`, { groupId });
      return;
    }
    if (!location) {
      addViolation('missing_location', `Assignment[${index}] location not found`, { locationId });
      return;
    }
    if (!input.slotKeys.includes(timeSlot)) {
      addViolation('invalid_slot', `Assignment[${index}] invalid slot`, { timeSlot });
      return;
    }
    if (date < input.scope.startDate || date > input.scope.endDate) {
      addViolation('out_of_scope', `Assignment[${index}] date out of scope`, { date });
      return;
    }
    if (date < group.startDate || date > group.endDate) {
      addViolation('out_of_group_range', `Assignment[${index}] date out of group range`, {
        groupId,
        date
      });
      return;
    }

    const groupSlotKey = makeGroupSlotKey(groupId, date, timeSlot);
    if (groupSlotSet.has(groupSlotKey)) {
      addViolation('group_slot_conflict', `Duplicate assignment in group/date/slot`, {
        groupId,
        date,
        timeSlot
      });
      return;
    }
    groupSlotSet.add(groupSlotKey);

    const slotWindow = input.slotWindows[timeSlot];
    if (!isLocationAvailable(location, group, date, slotWindow)) {
      addViolation('location_unavailable', `Location unavailable for assignment`, {
        groupId,
        locationId,
        date,
        timeSlot
      });
      return;
    }

    const usageKey = makeUsageKey(date, timeSlot, locationId);
    usageMap.set(usageKey, Number(usageMap.get(usageKey) || 0) + participantCount);
    addCoverage(groupId, locationId);
  });

  usageMap.forEach((used, key) => {
    const parts = key.split('|');
    const locationId = Number(parts[2]);
    const location = locationById.get(locationId);
    if (!location) return;
    const capacity = Number(location.capacity || 0);
    if (Number.isFinite(capacity) && capacity > 0 && used > capacity) {
      addViolation('capacity', `Capacity exceeded`, {
        date: parts[0],
        timeSlot: parts[1],
        locationId,
        used,
        capacity
      });
    }
  });

  Object.entries(input.requiredLocationsByGroup || {}).forEach(([groupKey, requiredSet]) => {
    if (!(requiredSet instanceof Set)) return;
    Array.from(requiredSet).forEach((locationId) => {
      const key = `${groupKey}|${locationId}`;
      if (Number(coverageMap.get(key) || 0) > 0) return;
      mustVisitMissing.push({
        groupId: Number(groupKey),
        locationId
      });
    });
  });

  return {
    hardViolations,
    mustVisitMissing
  };
};

module.exports = {
  validateSolution
};
