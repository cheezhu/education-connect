const { getWeekdayUtc } = require('./date');

const makeUsageKey = (date, slot, locationId) => `${date}|${slot}|${locationId}`;
const makeGroupSlotKey = (groupId, date, slot) => `${groupId}|${date}|${slot}`;

const isGroupTypeAllowed = (location, group) => {
  if (!location) return false;
  const target = String(location.targetGroups || 'all');
  if (target === 'all') return true;
  return target === group.type;
};

const isWithinOpenHours = (location, date, slotWindow) => {
  if (!location.openHours || typeof location.openHours !== 'object') return true;
  const weekday = getWeekdayUtc(date);
  if (weekday < 0) return false;
  const windows = location.openHours[String(weekday)] || location.openHours.default;
  if (!Array.isArray(windows) || windows.length === 0) return false;
  return windows.some((window) => {
    const start = Number(window?.start);
    const end = Number(window?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return slotWindow.start >= start && slotWindow.end <= end;
  });
};

const isLocationAvailable = (location, group, date, slotWindow) => {
  if (!location || !group) return false;
  if (!location.isActive) return false;
  if (!isGroupTypeAllowed(location, group)) return false;
  const weekday = getWeekdayUtc(date);
  if (weekday < 0) return false;
  if (location.blockedWeekdays.has(weekday)) return false;
  if (location.closedDates.has(date)) return false;
  if (!isWithinOpenHours(location, date, slotWindow)) return false;
  return true;
};

const hasCapacity = (usageMap, location, date, slot, participants, replacingParticipants = 0) => {
  const capacity = Number(location.capacity || 0);
  if (!Number.isFinite(capacity) || capacity <= 0) return true;
  const key = makeUsageKey(date, slot, location.id);
  const used = Number(usageMap.get(key) || 0);
  return used - replacingParticipants + participants <= capacity;
};

module.exports = {
  makeUsageKey,
  makeGroupSlotKey,
  isLocationAvailable,
  hasCapacity
};

