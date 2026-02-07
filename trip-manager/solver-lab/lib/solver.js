const { iterateDateRange, clampDateRange } = require('./date');
const {
  makeUsageKey,
  makeGroupSlotKey,
  isLocationAvailable,
  hasCapacity
} = require('./constraints');

const createRng = (seedValue) => {
  let seed = Number(seedValue);
  if (!Number.isFinite(seed)) seed = 42;
  let state = (seed >>> 0) || 1;
  return () => {
    state = ((state * 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const solveGreedy = (input, options = {}) => {
  const rng = createRng(options.seed || 42);
  const groupById = new Map(input.groups.map((group) => [group.id, group]));
  const locationById = new Map(input.locations.map((location) => [location.id, location]));
  const requiredByGroup = input.requiredLocationsByGroup || {};
  const scopeStart = input.scope.startDate;
  const scopeEnd = input.scope.endDate;

  const groupSlotsById = new Map();
  input.groups.forEach((group) => {
    const clamped = clampDateRange(scopeStart, scopeEnd, group.startDate, group.endDate);
    if (!clamped) {
      groupSlotsById.set(group.id, []);
      return;
    }
    const slots = [];
    const dates = iterateDateRange(clamped.startDate, clamped.endDate);
    dates.forEach((date) => {
      input.slotKeys.forEach((slot) => {
        slots.push({ groupId: group.id, date, timeSlot: slot });
      });
    });
    groupSlotsById.set(group.id, slots);
  });

  const slotMap = new Map();
  const usageMap = new Map();
  const requiredCoverage = new Map();
  const diagnostics = {
    keptExisting: 0,
    addedRequired: 0,
    replacedForRequired: 0,
    droppedExisting: 0,
    reinsertedDropped: 0,
    requiredUnplaced: []
  };
  const droppedAssignments = [];

  const isRequiredLocation = (groupId, locationId) => {
    const requiredSet = requiredByGroup[String(groupId)];
    if (!requiredSet || !(requiredSet instanceof Set)) return false;
    return requiredSet.has(locationId);
  };

  const coverageKey = (groupId, locationId) => `${groupId}|${locationId}`;
  const coverageCount = (groupId, locationId) => Number(requiredCoverage.get(coverageKey(groupId, locationId)) || 0);
  const addCoverage = (groupId, locationId) => {
    if (!isRequiredLocation(groupId, locationId)) return;
    const key = coverageKey(groupId, locationId);
    requiredCoverage.set(key, coverageCount(groupId, locationId) + 1);
  };
  const removeCoverage = (groupId, locationId) => {
    if (!isRequiredLocation(groupId, locationId)) return;
    const key = coverageKey(groupId, locationId);
    const next = Math.max(0, coverageCount(groupId, locationId) - 1);
    requiredCoverage.set(key, next);
  };

  const removeAssignmentFromIndexes = (assignment) => {
    const usageKey = makeUsageKey(assignment.date, assignment.timeSlot, assignment.locationId);
    const used = Number(usageMap.get(usageKey) || 0);
    usageMap.set(usageKey, Math.max(0, used - assignment.participantCount));
    removeCoverage(assignment.groupId, assignment.locationId);
  };

  const placeAssignment = (candidate, source, allowReplace = false) => {
    const group = groupById.get(candidate.groupId);
    const location = locationById.get(candidate.locationId);
    if (!group || !location) return { ok: false, reason: 'missing_ref' };
    const slotWindow = input.slotWindows[candidate.timeSlot];
    if (!slotWindow) return { ok: false, reason: 'invalid_slot' };
    if (!isLocationAvailable(location, group, candidate.date, slotWindow)) {
      return { ok: false, reason: 'location_unavailable' };
    }

    const groupSlotKey = makeGroupSlotKey(candidate.groupId, candidate.date, candidate.timeSlot);
    const current = slotMap.get(groupSlotKey);
    if (current && !allowReplace) {
      return { ok: false, reason: 'occupied' };
    }

    if (current) {
      const currentIsRequired = isRequiredLocation(current.groupId, current.locationId);
      if (currentIsRequired && coverageCount(current.groupId, current.locationId) <= 1) {
        return { ok: false, reason: 'replace_required_blocked' };
      }
    }

    const replacingParticipants = current ? current.participantCount : 0;
    if (!hasCapacity(usageMap, location, candidate.date, candidate.timeSlot, candidate.participantCount, replacingParticipants)) {
      return { ok: false, reason: 'capacity' };
    }

    if (current) {
      removeAssignmentFromIndexes(current);
      droppedAssignments.push(current);
      diagnostics.droppedExisting += 1;
    }

    const assignment = {
      groupId: candidate.groupId,
      locationId: candidate.locationId,
      date: candidate.date,
      timeSlot: candidate.timeSlot,
      participantCount: candidate.participantCount,
      source
    };
    slotMap.set(groupSlotKey, assignment);
    const usageKey = makeUsageKey(candidate.date, candidate.timeSlot, candidate.locationId);
    usageMap.set(usageKey, Number(usageMap.get(usageKey) || 0) + candidate.participantCount);
    addCoverage(candidate.groupId, candidate.locationId);
    return { ok: true, replaced: Boolean(current) };
  };

  const assignmentSortKey = (item) => {
    const requiredRank = isRequiredLocation(item.groupId, item.locationId) ? 0 : 1;
    return [
      requiredRank,
      item.groupId,
      item.date,
      input.slotKeys.indexOf(item.timeSlot),
      item.locationId
    ];
  };

  const existingSorted = [...input.existingAssignments].sort((left, right) => {
    const a = assignmentSortKey(left);
    const b = assignmentSortKey(right);
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] < b[i]) return -1;
      if (a[i] > b[i]) return 1;
    }
    return 0;
  });

  existingSorted.forEach((row) => {
    const group = groupById.get(row.groupId);
    if (!group) return;
    const participants = Math.max(1, Number(row.participantCount || group.participantCount || 1));
    const placed = placeAssignment(
      {
        groupId: row.groupId,
        locationId: row.locationId,
        date: row.date,
        timeSlot: row.timeSlot,
        participantCount: participants
      },
      'keep-existing',
      false
    );
    if (placed.ok) diagnostics.keptExisting += 1;
  });

  const pickBestCandidate = (candidates) => {
    if (!candidates.length) return null;
    candidates.sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      const tie = rng() - 0.5;
      if (tie < 0) return -1;
      if (tie > 0) return 1;
      return 0;
    });
    return candidates[0];
  };

  const placeRequiredLocation = (group, requiredLocationId) => {
    const groupSlots = groupSlotsById.get(group.id) || [];
    const candidates = [];
    groupSlots.forEach((slot, index) => {
      const location = locationById.get(requiredLocationId);
      if (!location) return;
      const slotWindow = input.slotWindows[slot.timeSlot];
      if (!isLocationAvailable(location, group, slot.date, slotWindow)) return;
      const key = makeGroupSlotKey(group.id, slot.date, slot.timeSlot);
      const current = slotMap.get(key);
      let replacePenalty = 0;
      let replacingParticipants = 0;
      if (current) {
        const currentIsRequired = isRequiredLocation(current.groupId, current.locationId);
        if (currentIsRequired && coverageCount(current.groupId, current.locationId) <= 1) {
          return;
        }
        replacePenalty = currentIsRequired ? 150 : 80;
        replacingParticipants = current.participantCount;
      }
      if (!hasCapacity(usageMap, location, slot.date, slot.timeSlot, group.participantCount, replacingParticipants)) {
        return;
      }
      candidates.push({
        groupId: group.id,
        locationId: requiredLocationId,
        date: slot.date,
        timeSlot: slot.timeSlot,
        participantCount: group.participantCount,
        score: replacePenalty + index
      });
    });

    const best = pickBestCandidate(candidates);
    if (!best) return false;
    const placed = placeAssignment(best, 'add-required', true);
    if (!placed.ok) return false;
    if (placed.replaced) diagnostics.replacedForRequired += 1;
    diagnostics.addedRequired += 1;
    return true;
  };

  input.groups.forEach((group) => {
    const requiredSet = requiredByGroup[String(group.id)];
    if (!requiredSet || !(requiredSet instanceof Set) || requiredSet.size === 0) return;
    Array.from(requiredSet).forEach((locationId) => {
      if (coverageCount(group.id, locationId) > 0) return;
      const ok = placeRequiredLocation(group, locationId);
      if (!ok) {
        diagnostics.requiredUnplaced.push({
          groupId: group.id,
          groupName: group.name,
          locationId
        });
      }
    });
  });

  const tryReinsertDropped = (item) => {
    const group = groupById.get(item.groupId);
    if (!group) return false;
    const slots = groupSlotsById.get(group.id) || [];
    const sameDateFirst = slots
      .slice()
      .sort((left, right) => {
        const leftRank = left.date === item.date ? 0 : 1;
        const rightRank = right.date === item.date ? 0 : 1;
        if (leftRank !== rightRank) return leftRank - rightRank;
        if (left.date !== right.date) return left.date.localeCompare(right.date);
        return input.slotKeys.indexOf(left.timeSlot) - input.slotKeys.indexOf(right.timeSlot);
      });

    for (const slot of sameDateFirst) {
      const key = makeGroupSlotKey(group.id, slot.date, slot.timeSlot);
      if (slotMap.has(key)) continue;
      const placed = placeAssignment(
        {
          groupId: item.groupId,
          locationId: item.locationId,
          date: slot.date,
          timeSlot: slot.timeSlot,
          participantCount: item.participantCount
        },
        'reinsert-dropped',
        false
      );
      if (placed.ok) return true;
    }
    return false;
  };

  droppedAssignments.forEach((item) => {
    const ok = tryReinsertDropped(item);
    if (ok) diagnostics.reinsertedDropped += 1;
  });

  const assignments = Array.from(slotMap.values())
    .sort((left, right) => {
      if (left.groupId !== right.groupId) return left.groupId - right.groupId;
      if (left.date !== right.date) return left.date.localeCompare(right.date);
      return input.slotKeys.indexOf(left.timeSlot) - input.slotKeys.indexOf(right.timeSlot);
    })
    .map((item) => ({
      groupId: item.groupId,
      locationId: item.locationId,
      date: item.date,
      timeSlot: item.timeSlot,
      participantCount: item.participantCount,
      notes: item.source
    }));

  return {
    assignments,
    diagnostics
  };
};

module.exports = {
  solveGreedy
};

