const express = require('express');
const requireEditLock = require('../middleware/editLock');
const { DEFAULT_TIME_SLOTS, getAiRules } = require('../utils/aiConfig');
const { bumpScheduleRevision } = require('../utils/scheduleRevision');

const router = express.Router();

const isValidDate = (value) => {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
};

const parseJsonSafe = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const parseObjectSafe = (value) => {
  const parsed = parseJsonSafe(value, null);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return null;
  }
  return parsed;
};

const parseArraySafe = (value) => {
  const parsed = parseJsonSafe(value, null);
  return Array.isArray(parsed) ? parsed : [];
};

const parseBlockedWeekdays = (value) => {
  if (!value) return new Set();
  return new Set(
    String(value)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  );
};

const DEFAULT_RESULT_SCHEMA = 'ec-planning-result@1';

const normalizeSlotWindows = (input) => {
  if (!input || typeof input !== 'object') {
    return DEFAULT_TIME_SLOTS;
  }
  const result = {};
  Object.entries(DEFAULT_TIME_SLOTS).forEach(([key, window]) => {
    const candidate = input[key] || {};
    const start = Number(candidate.start);
    const end = Number(candidate.end);
    result[key] = {
      start: Number.isFinite(start) ? start : window.start,
      end: Number.isFinite(end) ? end : window.end
    };
  });
  return result;
};

const normalizeTimeSlots = (input) => {
  if (!Array.isArray(input)) {
    return Object.keys(DEFAULT_TIME_SLOTS);
  }
  const normalized = input
    .map(slot => String(slot).toUpperCase())
    .filter(slot => DEFAULT_TIME_SLOTS[slot]);
  return normalized.length > 0 ? normalized : Object.keys(DEFAULT_TIME_SLOTS);
};

const getDateRangeFromAssignments = (assignments) => {
  const dates = assignments
    .map(item => item.date)
    .filter(isValidDate)
    .sort();
  if (dates.length === 0) return null;
  return { startDate: dates[0], endDate: dates[dates.length - 1] };
};

const getWeekday = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay();
};

const isWithinOpenHours = (openHours, weekday, slotWindow) => {
  if (!openHours) return true;
  const dayKey = String(weekday);
  const windows = openHours[dayKey] || openHours.default;
  if (!Array.isArray(windows) || windows.length === 0) return false;
  return windows.some((window) => {
    const start = Number(window.start);
    const end = Number(window.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return slotWindow.start >= start && slotWindow.end <= end;
  });
};

const buildSnapshotId = () => {
  const timestamp = new Date().toISOString();
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}_${random}`;
};

const buildFilename = (snapshotId) => {
  const safe = snapshotId.replace(/[:.]/g, '-');
  return `planning_input_${safe}.json`;
};

router.post('/export', (req, res) => {
  const {
    groupIds,
    startDate,
    endDate,
    includeExistingActivities = true,
    includeExistingSchedules = true,
    includePlanItemsByGroup = true
  } = req.body || {};

  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return res.status(400).json({ error: '缺少团组ID' });
  }

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return res.status(400).json({ error: '日期范围无效' });
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return res.status(400).json({ error: '日期范围无效' });
  }

  const uniqueGroupIds = Array.from(new Set(groupIds.map(id => Number(id)).filter(Number.isFinite)));
  if (uniqueGroupIds.length === 0) {
    return res.status(400).json({ error: '团组ID无效' });
  }

  const placeholders = uniqueGroupIds.map(() => '?').join(', ');
  const groups = req.db.prepare(`
    SELECT id, name, type, student_count, teacher_count, start_date, end_date, itinerary_plan_id
    FROM groups
    WHERE id IN (${placeholders})
  `).all(...uniqueGroupIds);

  if (!groups || groups.length === 0) {
    return res.status(400).json({ error: '团组不存在' });
  }

  const filteredGroups = groups.filter(group => (
    group.start_date <= endDate && group.end_date >= startDate
  ));

  if (filteredGroups.length === 0) {
    return res.status(400).json({ error: '日期范围内无团组' });
  }

  const filteredGroupIds = filteredGroups.map(group => group.id);
  const filteredPlaceholders = filteredGroupIds.map(() => '?').join(', ');

  const locations = req.db.prepare(`
    SELECT id, name, address, capacity, blocked_weekdays, open_hours, closed_dates, target_groups, is_active
    FROM locations
    WHERE is_active = 1
  `).all();

  const planItemsByGroup = {};
  if (includePlanItemsByGroup) {
    const planItemQuery = req.db.prepare(`
      SELECT location_id, sort_order
      FROM itinerary_plan_items
      WHERE plan_id = ?
      ORDER BY sort_order, id
    `);

    filteredGroups.forEach(group => {
      if (!group.itinerary_plan_id) {
        planItemsByGroup[String(group.id)] = [];
        return;
      }
      planItemsByGroup[String(group.id)] = planItemQuery.all(group.itinerary_plan_id)
        .map(item => ({
          location_id: item.location_id,
          sort_order: item.sort_order
        }));
    });
  }

  const activities = includeExistingActivities
    ? req.db.prepare(`
        SELECT group_id, location_id, activity_date, time_slot, participant_count
        FROM activities
        WHERE activity_date BETWEEN ? AND ?
      `).all(startDate, endDate)
    : [];

  const schedules = includeExistingSchedules
    ? req.db.prepare(`
        SELECT group_id, activity_date, start_time, end_time, is_from_resource, location_id
        FROM schedules
        WHERE group_id IN (${filteredPlaceholders})
          AND activity_date BETWEEN ? AND ?
      `).all(...filteredGroupIds, startDate, endDate)
    : [];

  const snapshotId = buildSnapshotId();
  const exportedAt = new Date().toISOString();

  const payload = {
    schema: 'ec-planning-input@1',
    snapshot_id: snapshotId,
    exported_at: exportedAt,
    range: { startDate, endDate },
    rules: getAiRules(req.db),
    groups: filteredGroups.map(group => ({
      id: group.id,
      name: group.name,
      type: group.type,
      student_count: group.student_count,
      teacher_count: group.teacher_count,
      start_date: group.start_date,
      end_date: group.end_date,
      itinerary_plan_id: group.itinerary_plan_id
    })),
    locations: locations.map(location => ({
      id: location.id,
      name: location.name,
      address: location.address,
      capacity: location.capacity,
      blocked_weekdays: location.blocked_weekdays ?? '',
      closed_dates: parseArraySafe(location.closed_dates),
      open_hours: parseObjectSafe(location.open_hours),
      target_groups: location.target_groups,
      is_active: location.is_active ? 1 : 0
    })),
    plan_items_by_group: includePlanItemsByGroup ? planItemsByGroup : {},
    existing: {
      activities,
      schedules
    }
  };

  const filename = buildFilename(snapshotId);
  const body = JSON.stringify(payload, null, 2);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);
  res.send(body);
});

router.post('/import', requireEditLock, (req, res) => {
  const body = req.body || {};
  const payload = body?.payload && typeof body.payload === 'object'
    ? body.payload
    : body;
  const options = body?.payload ? (body.options || {}) : (body.options || {});

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  if (payload.schema !== DEFAULT_RESULT_SCHEMA) {
    return res.status(400).json({ error: 'Unsupported schema' });
  }

  const rawAssignments = Array.isArray(payload.assignments) ? payload.assignments : null;
  if (!rawAssignments) {
    return res.status(400).json({ error: 'Assignments should be an array' });
  }

  const normalizedAssignments = rawAssignments.map((item, index) => {
    const groupId = Number(item.groupId ?? item.group_id);
    const locationId = Number(item.locationId ?? item.location_id);
    const timeSlotRaw = item.timeSlot ?? item.time_slot;
    const timeSlot = timeSlotRaw ? String(timeSlotRaw).toUpperCase() : '';
    const participantRaw = item.participantCount ?? item.participant_count;
    const participantCount = Number.isFinite(Number(participantRaw))
      ? Math.floor(Number(participantRaw))
      : null;
    return {
      index,
      groupId,
      locationId,
      date: item.date,
      timeSlot,
      participantCount,
      notes: item.notes ?? item.note ?? null
    };
  });

  const invalidAssignments = normalizedAssignments.filter(item => (
    !Number.isFinite(item.groupId) || item.groupId <= 0 ||
    !Number.isFinite(item.locationId) || item.locationId <= 0 ||
    !isValidDate(item.date) ||
    !item.timeSlot
  ));

  if (invalidAssignments.length > 0) {
    return res.status(400).json({
      error: 'Invalid assignment fields',
      details: invalidAssignments.slice(0, 20).map(item => ({
        index: item.index,
        groupId: item.groupId,
        locationId: item.locationId,
        date: item.date,
        timeSlot: item.timeSlot
      }))
    });
  }

  const assignmentGroupIds = Array.from(new Set(
    normalizedAssignments.map(item => item.groupId)
  ));
  let selectedGroupIds = Array.isArray(options.groupIds)
    ? options.groupIds
    : assignmentGroupIds;
  selectedGroupIds = Array.from(new Set(
    selectedGroupIds.map(id => Number(id)).filter(Number.isFinite)
  ));

  if (selectedGroupIds.length === 0) {
    return res.status(400).json({ error: 'Missing groupIds' });
  }

  const selectedGroupSet = new Set(selectedGroupIds);
  const filteredAssignments = normalizedAssignments.filter(item => selectedGroupSet.has(item.groupId));

  const payloadRange = payload.range || {};
  let startDate = payloadRange.startDate || payloadRange.start_date || payload.startDate || payload.start_date;
  let endDate = payloadRange.endDate || payloadRange.end_date || payload.endDate || payload.end_date;
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    const derivedRange = getDateRangeFromAssignments(filteredAssignments);
    startDate = derivedRange?.startDate;
    endDate = derivedRange?.endDate;
  }

  if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
    return res.status(400).json({ error: 'Invalid date range' });
  }

  const placeholders = selectedGroupIds.map(() => '?').join(', ');
  const groups = req.db.prepare(`
    SELECT id, name, type, student_count, teacher_count, start_date, end_date, color
    FROM groups
    WHERE id IN (${placeholders})
  `).all(...selectedGroupIds);

  if (!groups || groups.length === 0) {
    return res.status(400).json({ error: 'Groups not found' });
  }

  const groupMap = new Map(groups.map(group => [group.id, group]));
  const missingGroupIds = selectedGroupIds.filter(id => !groupMap.has(id));
  if (missingGroupIds.length > 0) {
    return res.status(400).json({ error: 'Groups not found', missingGroupIds });
  }

  const locations = req.db.prepare(`
    SELECT id, name, capacity, blocked_weekdays, open_hours, closed_dates, target_groups, is_active
    FROM locations
  `).all();
  const locationMap = new Map(locations.map(location => [location.id, location]));
  const assignmentLocationIds = Array.from(new Set(
    filteredAssignments.map(item => item.locationId)
  ));
  const missingLocationIds = assignmentLocationIds.filter(id => !locationMap.has(id));
  if (missingLocationIds.length > 0) {
    return res.status(400).json({ error: 'Locations not found', missingLocationIds });
  }

  const systemRules = getAiRules(req.db);
  const ruleSource = payload.rules && typeof payload.rules === 'object' ? payload.rules : {};
  const timeSlots = normalizeTimeSlots(ruleSource.timeSlots || systemRules.timeSlots);
  const slotWindows = normalizeSlotWindows(
    ruleSource.slotWindows || ruleSource.slot_windows || systemRules.slotWindows
  );
  const slotOrder = new Map(timeSlots.map((slot, index) => [slot, index]));

  const replaceExisting = options.replaceExisting !== undefined
    ? Boolean(options.replaceExisting)
    : payload.mode === 'replaceExisting';
  const skipConflicts = options.skipConflicts !== undefined ? Boolean(options.skipConflicts) : true;
  const createPlans = false;
  const dryRun = options.dryRun === true;

  const groupSizeRows = req.db.prepare(`
    SELECT id, student_count, teacher_count
    FROM groups
  `).all();
  const groupSizeMap = new Map(
    groupSizeRows.map(row => [row.id, (row.student_count || 0) + (row.teacher_count || 0)])
  );

  const existingActivities = req.db.prepare(`
    SELECT group_id, location_id, activity_date, time_slot, participant_count
    FROM activities
    WHERE activity_date BETWEEN ? AND ?
  `).all(startDate, endDate);

  const existingUsage = new Map();
  const existingGroupSlots = new Set();
  existingActivities.forEach(row => {
    if (replaceExisting && selectedGroupSet.has(row.group_id)) return;
    if (!row.activity_date || !row.time_slot) return;
    existingGroupSlots.add(`${row.group_id}|${row.activity_date}|${row.time_slot}`);
    if (!row.location_id) return;
    const rawCount = Number(row.participant_count);
    const resolvedCount = Number.isFinite(rawCount) && rawCount > 0
      ? rawCount
      : (groupSizeMap.get(row.group_id) || 0);
    const usageKey = `${row.activity_date}|${row.time_slot}|${row.location_id}`;
    existingUsage.set(usageKey, (existingUsage.get(usageKey) || 0) + resolvedCount);
  });

  const resolvedAssignments = filteredAssignments.map(item => {
    const group = groupMap.get(item.groupId);
    const fallbackCount = group ? (group.student_count || 0) + (group.teacher_count || 0) : 0;
    const participantCount = Number.isFinite(item.participantCount) && item.participantCount > 0
      ? item.participantCount
      : fallbackCount;
    return {
      ...item,
      participantCount
    };
  });

  const sortedAssignments = [...resolvedAssignments].sort((a, b) => {
    if (a.groupId !== b.groupId) return a.groupId - b.groupId;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (slotOrder.get(a.timeSlot) || 0) - (slotOrder.get(b.timeSlot) || 0);
  });

  const conflicts = [];
  const accepted = [];
  const groupSlotSet = new Set(existingGroupSlots);
  const usageMap = new Map(existingUsage);

  const buildConflict = (item, group, location, reasons) => ({
    groupId: item.groupId,
    groupName: group?.name || '',
    date: item.date,
    timeSlot: item.timeSlot,
    locationId: item.locationId,
    locationName: location?.name || '',
    reason: reasons[0],
    reasons
  });

  sortedAssignments.forEach(item => {
    const group = groupMap.get(item.groupId);
    const location = locationMap.get(item.locationId);
    const reasons = [];

    if (!timeSlots.includes(item.timeSlot)) {
      reasons.push('INVALID_TIME_SLOT');
    }

    if (item.date < startDate || item.date > endDate) {
      reasons.push('OUT_OF_RANGE');
    }

    if (group && (item.date < group.start_date || item.date > group.end_date)) {
      reasons.push('OUT_OF_RANGE');
    }

    const groupSlotKey = `${item.groupId}|${item.date}|${item.timeSlot}`;
    if (groupSlotSet.has(groupSlotKey)) {
      reasons.push('GROUP_TIME_CONFLICT');
    }

    if (location) {
      if (!location.is_active) {
        reasons.push('INACTIVE_LOCATION');
      }

      const targetGroups = location.target_groups || 'all';
      if (targetGroups !== 'all' && group && targetGroups !== group.type) {
        reasons.push('GROUP_TYPE');
      }

      const weekday = getWeekday(item.date);
      if (weekday === null) {
        reasons.push('INVALID_DATE');
      } else {
        const blocked = parseBlockedWeekdays(location.blocked_weekdays);
        if (blocked.has(String(weekday))) {
          reasons.push('BLOCKED_WEEKDAY');
        }

        const closedDates = Array.isArray(location.closed_dates)
          ? location.closed_dates
          : parseArraySafe(location.closed_dates);
        if (Array.isArray(closedDates) && closedDates.includes(item.date)) {
          reasons.push('CLOSED_DATE');
        }

        const openHours = (location.open_hours && typeof location.open_hours === 'object')
          ? location.open_hours
          : parseObjectSafe(location.open_hours);
        const slotWindow = slotWindows[item.timeSlot] || DEFAULT_TIME_SLOTS.MORNING;
        if (openHours && !isWithinOpenHours(openHours, weekday, slotWindow)) {
          reasons.push('OPEN_HOURS');
        }
      }

      const capacity = Number(location.capacity);
      if (Number.isFinite(capacity) && capacity > 0) {
        const usageKey = `${item.date}|${item.timeSlot}|${item.locationId}`;
        const used = usageMap.get(usageKey) || 0;
        if (used + item.participantCount > capacity) {
          reasons.push('CAPACITY');
        }
      }
    }

    if (reasons.length > 0) {
      conflicts.push(buildConflict(item, group, location, reasons));
      return;
    }

    const slotWindow = slotWindows[item.timeSlot] || DEFAULT_TIME_SLOTS.MORNING;
    accepted.push({
      ...item,
      groupName: group?.name || '',
      groupColor: group?.color || '#1890ff',
      locationName: location?.name || '',
      slotWindow
    });

    groupSlotSet.add(groupSlotKey);
    const usageKey = `${item.date}|${item.timeSlot}|${item.locationId}`;
    usageMap.set(usageKey, (usageMap.get(usageKey) || 0) + item.participantCount);
  });

  const totalAssignments = resolvedAssignments.length;
  const summary = {
    groups: groups.length,
    assignments: totalAssignments,
    inserted: accepted.length,
    skipped: totalAssignments - accepted.length,
    conflicts: conflicts.length
  };

  if (conflicts.length > 0 && !skipConflicts) {
    return res.status(409).json({
      error: 'Conflicts detected',
      summary: {
        ...summary,
        inserted: 0,
        skipped: totalAssignments
      },
      conflicts
    });
  }

  if (dryRun) {
    return res.json({ summary, conflicts });
  }

  const deleteActivities = req.db.prepare(`
    DELETE FROM activities
    WHERE group_id IN (${placeholders})
      AND activity_date BETWEEN ? AND ?
  `);

  const deleteSchedules = req.db.prepare(`
    DELETE FROM schedules
    WHERE group_id IN (${placeholders})
      AND activity_date BETWEEN ? AND ?
      AND is_from_resource = 1
  `);

  const insertSchedule = req.db.prepare(`
    INSERT INTO schedules (
      group_id, activity_date, start_time, end_time,
      type, title, location, description, color,
      resource_id, is_from_resource, location_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertActivity = req.db.prepare(`
    INSERT INTO activities (
      schedule_id, group_id, location_id, activity_date,
      time_slot, participant_count, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = req.db.transaction(() => {
    if (replaceExisting) {
      deleteActivities.run(...selectedGroupIds, startDate, endDate);
      deleteSchedules.run(...selectedGroupIds, startDate, endDate);
    }

    if (createPlans) {
      // no-op: keep existing itinerary plan bindings unchanged
    }

    const resourcePrefix = payload.snapshot_id
      ? `import-${payload.snapshot_id}`
      : 'import';

    accepted.forEach(item => {
      const startTime = `${String(item.slotWindow.start).padStart(2, '0')}:00`;
      const endTime = `${String(item.slotWindow.end).padStart(2, '0')}:00`;
      const scheduleResult = insertSchedule.run(
        item.groupId,
        item.date,
        startTime,
        endTime,
        'visit',
        item.locationName || item.groupName || 'Visit',
        item.locationName || '',
        item.notes || 'Imported',
        item.groupColor || '#1890ff',
        `${resourcePrefix}-loc-${item.locationId}`,
        1,
        item.locationId
      );

      insertActivity.run(
        scheduleResult.lastInsertRowid,
        item.groupId,
        item.locationId,
        item.date,
        item.timeSlot,
        item.participantCount,
        item.notes || null
      );
    });
  });

  transaction();

  const touchedGroupIds = new Set();
  if (replaceExisting) {
    selectedGroupIds.forEach(id => touchedGroupIds.add(id));
  }
  accepted.forEach(item => {
    if (Number.isFinite(item.groupId)) {
      touchedGroupIds.add(item.groupId);
    }
  });
  touchedGroupIds.forEach(id => {
    bumpScheduleRevision(req.db, id);
  });

  res.json({ summary, conflicts });
});

module.exports = router;
