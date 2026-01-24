const express = require('express');

const router = express.Router();

const DEFAULT_TIME_SLOTS = {
  MORNING: { start: 9, end: 12 },
  AFTERNOON: { start: 14, end: 17 },
  EVENING: { start: 19, end: 21 }
};

const DEFAULT_AI_RULES = {
  timeSlots: ['MORNING', 'AFTERNOON'],
  slotWindows: DEFAULT_TIME_SLOTS,
  requireAllPlanItems: false,
  maxItemsPerGroup: 8
};

const AI_RULES_KEY = 'ai_schedule_rules';

const isValidDate = (value) => {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
};

const normalizeAiRules = (input = {}) => {
  const timeSlots = Array.isArray(input.timeSlots)
    ? input.timeSlots.filter(slot => DEFAULT_TIME_SLOTS[slot])
    : [];
  const normalizedSlots = timeSlots.length > 0
    ? timeSlots
    : DEFAULT_AI_RULES.timeSlots;

  const inputWindows = input.slotWindows && typeof input.slotWindows === 'object'
    ? input.slotWindows
    : {};
  const normalizedWindows = {};

  Object.entries(DEFAULT_TIME_SLOTS).forEach(([key, window]) => {
    const candidate = inputWindows[key] || {};
    const start = Number(candidate.start);
    const end = Number(candidate.end);
    normalizedWindows[key] = {
      start: Number.isFinite(start) ? start : window.start,
      end: Number.isFinite(end) ? end : window.end
    };
  });

  const maxItems = Number(input.maxItemsPerGroup);
  const normalizedMaxItems = Number.isFinite(maxItems) && maxItems > 0
    ? Math.floor(maxItems)
    : DEFAULT_AI_RULES.maxItemsPerGroup;

  return {
    timeSlots: normalizedSlots,
    slotWindows: normalizedWindows,
    requireAllPlanItems: input.requireAllPlanItems !== undefined
      ? Boolean(input.requireAllPlanItems)
      : DEFAULT_AI_RULES.requireAllPlanItems,
    maxItemsPerGroup: normalizedMaxItems
  };
};

const getAiRules = (db) => {
  const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(AI_RULES_KEY);
  if (!row || !row.value) return DEFAULT_AI_RULES;
  try {
    const parsed = JSON.parse(row.value);
    return normalizeAiRules(parsed);
  } catch (error) {
    return DEFAULT_AI_RULES;
  }
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

module.exports = router;
