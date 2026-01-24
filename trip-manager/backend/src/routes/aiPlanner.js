const express = require('express');
const requireEditLock = require('../middleware/editLock');
const {
  DEFAULT_TIME_SLOTS,
  DEFAULT_AI_RULES,
  getAiRules,
  saveAiRules,
  resolveAiSettings
} = require('../utils/aiConfig');

const router = express.Router();
let fetchFn = global.fetch;
if (!fetchFn) {
  try {
    ({ fetch: fetchFn } = require('undici'));
  } catch (error) {
    fetchFn = () => Promise.reject(new Error('fetch is not available'));
  }
}
const DEFAULT_REQUEST_TIMEOUT_MS = 25000;

const AI_HISTORY_KEY = 'ai_itinerary_history';
const AI_HISTORY_LIMIT = 50;

const parseJsonSafe = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const parseBlockedWeekdays = (value) => {
  if (!value) return new Set();
  return new Set(
    String(value)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => Number(item))
  );
};

const getAiHistory = (db) => {
  const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(AI_HISTORY_KEY);
  if (!row || !row.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const appendAiHistory = (db, entry) => {
  const history = getAiHistory(db);
  const updated = [entry, ...history].slice(0, AI_HISTORY_LIMIT);
  const value = JSON.stringify(updated);
  const existing = db.prepare('SELECT key FROM system_config WHERE key = ?').get(AI_HISTORY_KEY);
  if (existing) {
    db.prepare('UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
      .run(value, AI_HISTORY_KEY);
  } else {
    db.prepare('INSERT INTO system_config (key, value, description) VALUES (?, ?, ?)')
      .run(AI_HISTORY_KEY, value, 'AI行程历史记录');
  }
};

const toMinutes = (timeValue) => {
  if (!timeValue) return null;
  const [hourStr, minuteStr] = String(timeValue).split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

const mapScheduleRow = (row) => ({
  id: row.id,
  groupId: row.group_id,
  date: row.activity_date,
  startTime: row.start_time,
  endTime: row.end_time,
  type: row.type,
  title: row.title,
  location: row.location,
  description: row.description,
  color: row.color,
  resourceId: row.resource_id,
  isFromResource: Boolean(row.is_from_resource),
  locationId: row.location_id
});

const enumerateDates = (startDate, endDate) => {
  const dates = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) {
    return dates;
  }
  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const getWeekday = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay();
};

const isLocationAvailable = (location, dateStr, slotKey, slotWindow) => {
  const weekday = getWeekday(dateStr);
  if (weekday === null) return false;

  const blocked = parseBlockedWeekdays(location.blocked_weekdays);
  if (blocked.has(weekday)) return false;

  const closedDates = parseJsonSafe(location.closed_dates, []);
  if (Array.isArray(closedDates) && closedDates.includes(dateStr)) return false;

  const openHours = parseJsonSafe(location.open_hours, null);
  if (!openHours) {
    return true;
  }

  const dayKey = String(weekday);
  const windows = openHours[dayKey] || openHours.default;
  if (!Array.isArray(windows) || windows.length === 0) {
    return false;
  }

  return windows.some((window) => {
    const start = Number(window.start);
    const end = Number(window.end);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return slotWindow.start >= start && slotWindow.end <= end;
  });
};

const normalizePreferences = (groups, locations, aiPreferences) => {
  const allLocationIds = locations.map(location => location.id);
  const locationSet = new Set(allLocationIds);
  const preferences = {};

  groups.forEach(group => {
    const raw = aiPreferences?.[group.id] || aiPreferences?.[String(group.id)];
    const list = Array.isArray(raw)
      ? raw
          .map(id => Number(id))
          .filter(id => locationSet.has(id))
      : [];

    const fallback = locations
      .filter(location => {
        if (!location.target_groups || location.target_groups === 'all') return true;
        return location.target_groups === group.type;
      })
      .sort((a, b) => b.capacity - a.capacity)
      .map(location => location.id);

    const merged = [...new Set([...list, ...fallback, ...allLocationIds])];
    preferences[group.id] = merged;
  });

  return preferences;
};

const buildAssignments = ({
  groups,
  locations,
  dateRange,
  timeSlots,
  preferences,
  existingUsage
}) => {
  const assignments = [];
  const conflicts = [];

  const timeSlotList = timeSlots.length > 0 ? timeSlots : Object.keys(DEFAULT_TIME_SLOTS);
  const timeSlotWindows = timeSlotList.reduce((acc, slotKey) => {
    acc[slotKey] = DEFAULT_TIME_SLOTS[slotKey] || DEFAULT_TIME_SLOTS.MORNING;
    return acc;
  }, {});

  const groupById = new Map(groups.map(group => [group.id, group]));

  dateRange.forEach(dateStr => {
    const activeGroups = groups.filter(group => {
      return dateStr >= group.start_date && dateStr <= group.end_date;
    });

    const orderedGroups = [...activeGroups].sort((a, b) => {
      const aCount = (a.student_count || 0) + (a.teacher_count || 0);
      const bCount = (b.student_count || 0) + (b.teacher_count || 0);
      return bCount - aCount;
    });

    timeSlotList.forEach(slotKey => {
      const slotWindow = timeSlotWindows[slotKey];
      const locationStates = locations
        .filter(location => isLocationAvailable(location, dateStr, slotKey, slotWindow))
        .map(location => {
          const usageKey = `${dateStr}|${slotKey}|${location.id}`;
          const used = existingUsage.get(usageKey) || 0;
          return {
            location,
            remaining: Math.max(0, (location.capacity || 0) - used)
          };
        });

      const locationMap = new Map(
        locationStates.map(state => [state.location.id, state])
      );

      orderedGroups.forEach(group => {
        const participants = (group.student_count || 0) + (group.teacher_count || 0);
        const prefList = preferences[group.id] || [];
        let assigned = false;

        for (const locationId of prefList) {
          const state = locationMap.get(locationId);
          if (!state) continue;
          const location = state.location;
          if (location.target_groups && location.target_groups !== 'all' && location.target_groups !== group.type) {
            continue;
          }
          if (state.remaining >= participants) {
            state.remaining -= participants;
            assignments.push({
              groupId: group.id,
              groupName: group.name,
              date: dateStr,
              timeSlot: slotKey,
              locationId: location.id,
              locationName: location.name,
              participants
            });
            assigned = true;
            break;
          }
        }

        if (!assigned) {
          conflicts.push({
            groupId: group.id,
            groupName: group.name,
            date: dateStr,
            timeSlot: slotKey,
            reason: '无可用容量或时间窗'
          });
        }
      });
    });
  });

  return { assignments, conflicts };
};

const extractJson = (text) => {
  if (!text) return null;
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  const jsonText = text.slice(first, last + 1);
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    return null;
  }
};

const fetchWithTimeout = async (url, options, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const fetchItineraryHintsFromAI = async ({ group, planItems, dateRange, timeSlots, aiConfig }) => {
  const apiKey = aiConfig?.apiKey || '';
  if (!apiKey || !apiKey.trim()) return null;

  const provider = aiConfig?.provider || 'openai';
  const defaultModel = provider === 'gemini' ? 'gemini-1.5-pro-latest' : 'gpt-4.1';
  const model = aiConfig?.model || defaultModel;
  const timeoutMs = aiConfig?.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
  const promptPayload = {
    task: 'Generate itinerary hints. Return JSON only.',
    rules: {
      oneActivityPerSlot: true,
      timeSlots
    },
    group: {
      id: group.id,
      name: group.name,
      type: group.type,
      participants: (group.student_count || 0) + (group.teacher_count || 0),
      start_date: group.start_date,
      end_date: group.end_date
    },
    dateRange,
    items: planItems.map(item => ({
      location_id: item.location_id,
      name: item.name,
      capacity: item.capacity || 0,
      target_groups: item.target_groups || 'all',
      blocked_weekdays: item.blocked_weekdays || '',
      open_hours: item.open_hours || null,
      closed_dates: item.closed_dates || null
    })),
    output: {
      items: [
        {
          location_id: '<locationId>',
          preferred_time_slots: ['MORNING', 'AFTERNOON'],
          preferred_date: 'YYYY-MM-DD'
        }
      ]
    }
  };

  if (provider === 'gemini') {
    const prompt = [
      'You are a scheduling assistant. Return JSON only.',
      JSON.stringify(promptPayload)
    ].join('\n');

    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      },
      timeoutMs
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI request failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('') || '';
    const parsed = extractJson(content);
    return parsed?.items ? parsed : null;
  }

  const payload = {
    model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: 'You are a scheduling assistant. Return JSON only.'
      },
      {
        role: 'user',
        content: JSON.stringify(promptPayload)
      }
    ]
  };

  const response = await fetchWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    },
    timeoutMs
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJson(content);
  return parsed?.items ? parsed : null;
};

router.get('/rules', (req, res) => {
  res.json(getAiRules(req.db));
});

router.put('/rules', requireEditLock, (req, res) => {
  const rules = saveAiRules(req.db, req.body || {});
  res.json(rules);
});

router.get('/history', (req, res) => {
  res.json({ items: getAiHistory(req.db) });
});

const fetchPreferencesFromAI = async ({ groups, locations, timeSlots, aiConfig }) => {
  const apiKey = aiConfig?.apiKey || '';
  if (!apiKey || !apiKey.trim()) return null;

  const provider = aiConfig?.provider || 'openai';
  const defaultModel = provider === 'gemini' ? 'gemini-1.5-pro-latest' : 'gpt-4.1';
  const model = aiConfig?.model || defaultModel;
  const timeoutMs = aiConfig?.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;

  const promptPayload = {
    task: 'Provide location preference ranking for each group.',
    timeSlots,
    groups: groups.map(group => ({
      id: group.id,
      name: group.name,
      type: group.type,
      participants: (group.student_count || 0) + (group.teacher_count || 0),
      start_date: group.start_date,
      end_date: group.end_date
    })),
    locations: locations.map(location => ({
      id: location.id,
      name: location.name,
      capacity: location.capacity || 0,
      target_groups: location.target_groups || 'all',
      blocked_weekdays: location.blocked_weekdays || '',
      open_hours: location.open_hours || null,
      closed_dates: location.closed_dates || null
    })),
    output: {
      preferences: {
        '<groupId>': ['<locationId>', '<locationId>']
      }
    }
  };

  if (provider === 'gemini') {
    const prompt = [
      'You are a scheduling assistant. Return JSON only.',
      JSON.stringify(promptPayload)
    ].join('\n');

    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      },
      timeoutMs
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI request failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('') || '';
    const parsed = extractJson(content);
    return parsed?.preferences || null;
  }

  const payload = {
    model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: 'You are a scheduling assistant. Return JSON only.'
      },
      {
        role: 'user',
        content: JSON.stringify(promptPayload)
      }
    ]
  };

  const response = await fetchWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    },
    timeoutMs
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJson(content);
  return parsed?.preferences || null;
};

router.post('/plan/global', async (req, res) => {
  const {
    groupIds,
    startDate,
    endDate,
    timeSlots = Object.keys(DEFAULT_TIME_SLOTS),
    planNamePrefix = 'AI方案',
    replaceExisting = true,
    useAI = true,
    dryRun = false
  } = req.body || {};

  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return res.status(400).json({ error: '缺少团组ID' });
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ error: '缺少日期范围' });
  }

  const placeholders = groupIds.map(() => '?').join(',');
  const groups = req.db.prepare(
    `SELECT * FROM groups WHERE id IN (${placeholders})`
  ).all(...groupIds);

  const locations = req.db.prepare(
    'SELECT * FROM locations WHERE is_active = 1'
  ).all();

  if (groups.length === 0 || locations.length === 0) {
    return res.status(400).json({ error: '团组或场地数据为空' });
  }

  const dateRange = enumerateDates(startDate, endDate);
  if (dateRange.length === 0) {
    return res.status(400).json({ error: '日期范围无效' });
  }

  const existingUsage = new Map();
  const existingRows = req.db.prepare(`
    SELECT location_id, activity_date, time_slot, SUM(participant_count) as used
    FROM activities
    WHERE activity_date BETWEEN ? AND ?
    GROUP BY location_id, activity_date, time_slot
  `).all(startDate, endDate);

  existingRows.forEach(row => {
    const key = `${row.activity_date}|${row.time_slot}|${row.location_id}`;
    existingUsage.set(key, row.used || 0);
  });

  let aiPreferences = null;
  const aiConfig = resolveAiSettings(req.db);
  if (useAI && aiConfig.apiKeyPresent) {
    try {
      aiPreferences = await fetchPreferencesFromAI({
        groups,
        locations,
        timeSlots,
        aiConfig
      });
    } catch (error) {
      console.error('AI preference fetch failed:', error.message);
    }
  }

  const preferences = normalizePreferences(groups, locations, aiPreferences);
  const { assignments, conflicts } = buildAssignments({
    groups,
    locations,
    dateRange,
    timeSlots,
    preferences,
    existingUsage
  });

  if (dryRun) {
    return res.json({
      summary: {
        groups: groups.length,
        days: dateRange.length,
        assignments: assignments.length,
        conflicts: conflicts.length
      },
      assignments,
      conflicts
    });
  }

  const timeSlotWindows = timeSlots.reduce((acc, slotKey) => {
    acc[slotKey] = DEFAULT_TIME_SLOTS[slotKey] || DEFAULT_TIME_SLOTS.MORNING;
    return acc;
  }, {});

  const deleteActivities = () => {
    const slotPlaceholders = timeSlots.map(() => '?').join(',');
    req.db.prepare(`
      DELETE FROM activities
      WHERE group_id IN (${placeholders})
        AND activity_date BETWEEN ? AND ?
        AND time_slot IN (${slotPlaceholders})
    `).run(...groupIds, startDate, endDate, ...timeSlots);
  };

  const deleteSchedules = () => {
    req.db.prepare(`
      DELETE FROM schedules
      WHERE group_id IN (${placeholders})
        AND activity_date BETWEEN ? AND ?
        AND is_from_resource = 1
    `).run(...groupIds, startDate, endDate);
  };

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

  const insertPlan = req.db.prepare(`
    INSERT INTO itinerary_plans (name, description)
    VALUES (?, ?)
  `);

  const insertPlanItem = req.db.prepare(`
    INSERT INTO itinerary_plan_items (plan_id, location_id, sort_order)
    VALUES (?, ?, ?)
  `);

  const updateGroupPlan = req.db.prepare(`
    UPDATE groups SET itinerary_plan_id = ? WHERE id = ?
  `);

  const transaction = req.db.transaction(() => {
    if (replaceExisting) {
      deleteActivities();
      deleteSchedules();
    }

    const planIds = {};
    const assignmentsByGroup = {};

    assignments.forEach(item => {
      if (!assignmentsByGroup[item.groupId]) {
        assignmentsByGroup[item.groupId] = [];
      }
      assignmentsByGroup[item.groupId].push(item);
    });

    Object.entries(assignmentsByGroup).forEach(([groupId, items]) => {
      const group = groups.find(g => g.id === Number(groupId));
      const planName = `${planNamePrefix}-${group?.name || groupId}`;
      const planResult = insertPlan.run(planName, 'AI生成行程方案');
      const planId = planResult.lastInsertRowid;
      planIds[groupId] = planId;

      const sortedItems = items.sort((a, b) => {
        if (a.date === b.date) {
          return timeSlots.indexOf(a.timeSlot) - timeSlots.indexOf(b.timeSlot);
        }
        return a.date.localeCompare(b.date);
      });

      sortedItems.forEach((item, index) => {
        insertPlanItem.run(planId, item.locationId, index + 1);

        const slotWindow = timeSlotWindows[item.timeSlot] || DEFAULT_TIME_SLOTS.MORNING;
        const startTime = `${String(slotWindow.start).padStart(2, '0')}:00`;
        const endTime = `${String(slotWindow.end).padStart(2, '0')}:00`;
        const scheduleResult = insertSchedule.run(
          item.groupId,
          item.date,
          startTime,
          endTime,
          'visit',
          item.locationName,
          item.locationName,
          'AI生成',
          '#1890ff',
          `ai-${item.locationId}`,
          1,
          item.locationId
        );

        insertActivity.run(
          scheduleResult.lastInsertRowid,
          item.groupId,
          item.locationId,
          item.date,
          item.timeSlot,
          item.participants,
          'AI生成'
        );
      });

      updateGroupPlan.run(planId, groupId);
    });

    return planIds;
  });

  const planIds = transaction();

  res.json({
    summary: {
      groups: groups.length,
      days: dateRange.length,
      assignments: assignments.length,
      conflicts: conflicts.length
    },
    assignments,
    conflicts,
    planIds
  });
});

router.post('/plan/itinerary', async (req, res) => {
  const { groupId, planId } = req.body || {};
  const resolvedGroupId = Number(groupId);
  if (!Number.isFinite(resolvedGroupId)) {
    return res.status(400).json({ error: '缺少团组ID' });
  }

  const group = req.db.prepare('SELECT * FROM groups WHERE id = ?').get(resolvedGroupId);
  if (!group) {
    return res.status(404).json({ error: '团组不存在' });
  }
  const aiConfig = resolveAiSettings(req.db);

  const resolvedPlanId = Number.isFinite(Number(planId))
    ? Number(planId)
    : group.itinerary_plan_id;

  if (!Number.isFinite(resolvedPlanId)) {
    return res.status(400).json({ error: '团组未绑定行程方案' });
  }

  const planRow = req.db.prepare('SELECT name FROM itinerary_plans WHERE id = ?').get(resolvedPlanId);
  const planName = planRow?.name || '';

  const rules = getAiRules(req.db);
  const timeSlots = rules.timeSlots.length > 0 ? rules.timeSlots : DEFAULT_AI_RULES.timeSlots;
  const slotWindows = rules.slotWindows || DEFAULT_TIME_SLOTS;

  const dateRange = enumerateDates(group.start_date, group.end_date);
  if (dateRange.length === 0) {
    return res.status(400).json({ error: '日期范围无效' });
  }

  const planItems = req.db.prepare(`
    SELECT
      i.id,
      i.location_id,
      i.sort_order,
      l.name,
      l.capacity,
      l.address,
      l.target_groups,
      l.blocked_weekdays,
      l.open_hours,
      l.closed_dates
    FROM itinerary_plan_items i
    JOIN locations l ON l.id = i.location_id
    WHERE i.plan_id = ?
    ORDER BY i.sort_order, i.id
  `).all(resolvedPlanId);

  if (!planItems || planItems.length === 0) {
    return res.status(400).json({ error: '行程方案暂无行程点' });
  }

  const existingSchedules = req.db.prepare(`
    SELECT id, group_id, activity_date, start_time, end_time, type,
           title, location, description, color, resource_id, is_from_resource, location_id
    FROM schedules
    WHERE group_id = ?
      AND activity_date BETWEEN ? AND ?
    ORDER BY activity_date, start_time, id
  `).all(resolvedGroupId, group.start_date, group.end_date);

  const usedResourceIds = new Set(
    existingSchedules
      .map(item => item.resource_id)
      .filter(Boolean)
  );

  const pendingItems = planItems.filter(item => {
    const resourceId = `plan-${resolvedPlanId}-loc-${item.location_id}`;
    return !usedResourceIds.has(resourceId);
  });

  if (pendingItems.length === 0) {
    return res.json({
      summary: {
        total: planItems.length,
        planned: 0,
        conflicts: 0
      },
      scheduleList: existingSchedules.map(mapScheduleRow),
      conflicts: []
    });
  }

  const existingUsage = new Map();
  const usageRows = req.db.prepare(`
    SELECT location_id, activity_date, time_slot, SUM(participant_count) as used
    FROM activities
    WHERE activity_date BETWEEN ? AND ?
    GROUP BY location_id, activity_date, time_slot
  `).all(group.start_date, group.end_date);

  usageRows.forEach(row => {
    const key = `${row.activity_date}|${row.time_slot}|${row.location_id}`;
    existingUsage.set(key, row.used || 0);
  });

  const scheduleMap = new Map();
  const addScheduleWindow = (dateStr, startTime, endTime) => {
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    if (startMinutes === null || endMinutes === null) return;
    if (!scheduleMap.has(dateStr)) {
      scheduleMap.set(dateStr, []);
    }
    scheduleMap.get(dateStr).push({ startMinutes, endMinutes });
  };

  existingSchedules.forEach(item => {
    addScheduleWindow(item.activity_date, item.start_time, item.end_time);
  });

  const hasGroupOverlap = (dateStr, slotWindow) => {
    const startTime = `${String(slotWindow.start).padStart(2, '0')}:00`;
    const endTime = `${String(slotWindow.end).padStart(2, '0')}:00`;
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    if (startMinutes === null || endMinutes === null) return true;
    const windows = scheduleMap.get(dateStr) || [];
    return windows.some(window => startMinutes < window.endMinutes && endMinutes > window.startMinutes);
  };

  let aiHints = null;
  if (aiConfig.apiKeyPresent) {
    try {
      aiHints = await fetchItineraryHintsFromAI({
        group,
        planItems: pendingItems,
        dateRange,
        timeSlots,
        aiConfig
      });
    } catch (error) {
      console.error('AI itinerary hints failed:', error.message);
    }
  }

  const aiUsed = Boolean(aiHints);
  const historyProvider = aiUsed ? aiConfig.provider : 'rules';
  const historyModel = aiUsed ? aiConfig.model : 'rules';

  const aiOrder = new Map();
  const aiSlotPrefs = new Map();
  const aiDatePrefs = new Map();

  if (aiHints && Array.isArray(aiHints.items)) {
    aiHints.items.forEach((item, index) => {
      const locationId = Number(item.location_id);
      if (!Number.isFinite(locationId)) return;
      aiOrder.set(locationId, index);
      if (Array.isArray(item.preferred_time_slots)) {
        aiSlotPrefs.set(
          locationId,
          item.preferred_time_slots.filter(slot => timeSlots.includes(slot))
        );
      }
      if (item.preferred_date && dateRange.includes(item.preferred_date)) {
        aiDatePrefs.set(locationId, item.preferred_date);
      }
    });
  }

  const orderedPendingItems = [...pendingItems].sort((a, b) => {
    const aOrder = aiOrder.has(a.location_id)
      ? aiOrder.get(a.location_id)
      : (a.sort_order ?? 0) + pendingItems.length;
    const bOrder = aiOrder.has(b.location_id)
      ? aiOrder.get(b.location_id)
      : (b.sort_order ?? 0) + pendingItems.length;
    return aOrder - bOrder;
  });

  const participants = (group.student_count || 0) + (group.teacher_count || 0);
  const assignments = [];
  const conflicts = [];

  orderedPendingItems.forEach(item => {
    const location = {
      id: item.location_id,
      name: item.name,
      capacity: item.capacity,
      target_groups: item.target_groups,
      blocked_weekdays: item.blocked_weekdays,
      open_hours: item.open_hours,
      closed_dates: item.closed_dates
    };

    let placed = false;
    const preferredDate = aiDatePrefs.get(item.location_id);
    const dateCandidates = preferredDate
      ? [preferredDate, ...dateRange.filter(dateStr => dateStr !== preferredDate)]
      : dateRange;
    const preferredSlots = aiSlotPrefs.get(item.location_id) || [];
    const slotCandidates = [
      ...preferredSlots,
      ...timeSlots.filter(slot => !preferredSlots.includes(slot))
    ];

    for (const dateStr of dateCandidates) {
      for (const slotKey of slotCandidates) {
        const slotWindow = slotWindows[slotKey] || DEFAULT_TIME_SLOTS[slotKey] || DEFAULT_TIME_SLOTS.MORNING;
        if (!isLocationAvailable(location, dateStr, slotKey, slotWindow)) {
          continue;
        }
        if (location.target_groups && location.target_groups !== 'all' && location.target_groups !== group.type) {
          continue;
        }
        if (hasGroupOverlap(dateStr, slotWindow)) {
          continue;
        }

        const capacityValue = Number(location.capacity);
        const hasCapacity = Number.isFinite(capacityValue) && capacityValue > 0;
        const usageKey = `${dateStr}|${slotKey}|${location.id}`;
        const used = existingUsage.get(usageKey) || 0;
        if (hasCapacity && used + participants > capacityValue) {
          continue;
        }

        assignments.push({
          location,
          dateStr,
          slotKey,
          slotWindow
        });
        existingUsage.set(usageKey, used + participants);
        addScheduleWindow(
          dateStr,
          `${String(slotWindow.start).padStart(2, '0')}:00`,
          `${String(slotWindow.end).padStart(2, '0')}:00`
        );
        placed = true;
        break;
      }
      if (placed) break;
    }

    if (!placed) {
      conflicts.push({
        locationId: item.location_id,
        locationName: item.name,
        reason: '无可用时段/容量'
      });
    }
  });

  if (rules.requireAllPlanItems && conflicts.length > 0) {
    appendAiHistory(req.db, {
      id: Date.now(),
      created_at: new Date().toISOString(),
      provider: historyProvider,
      model: historyModel,
      groupId: group.id,
      groupName: group.name,
      planId: resolvedPlanId,
      planName,
      summary: {
        total: pendingItems.length,
        planned: assignments.length,
        conflicts: conflicts.length
      },
      conflicts
    });
    return res.status(409).json({
      summary: {
        total: pendingItems.length,
        planned: assignments.length,
        conflicts: conflicts.length
      },
      conflicts
    });
  }

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

  req.db.transaction(() => {
    assignments.forEach((assignment) => {
      const { location, dateStr, slotKey, slotWindow } = assignment;
      const startTime = `${String(slotWindow.start).padStart(2, '0')}:00`;
      const endTime = `${String(slotWindow.end).padStart(2, '0')}:00`;
      const resourceId = `plan-${resolvedPlanId}-loc-${location.id}`;

      const scheduleResult = insertSchedule.run(
        resolvedGroupId,
        dateStr,
        startTime,
        endTime,
        'visit',
        location.name,
        location.name,
        'AI行程',
        '#1890ff',
        resourceId,
        1,
        location.id
      );

      insertActivity.run(
        scheduleResult.lastInsertRowid,
        resolvedGroupId,
        location.id,
        dateStr,
        slotKey,
        participants,
        'AI行程'
      );
    });
  })();

  const updatedSchedules = req.db.prepare(`
    SELECT id, group_id, activity_date, start_time, end_time, type,
           title, location, description, color, resource_id, is_from_resource, location_id
    FROM schedules
    WHERE group_id = ?
      AND activity_date BETWEEN ? AND ?
    ORDER BY activity_date, start_time, id
  `).all(resolvedGroupId, group.start_date, group.end_date);

  res.json({
    summary: {
      total: pendingItems.length,
      planned: assignments.length,
      conflicts: conflicts.length
    },
    scheduleList: updatedSchedules.map(mapScheduleRow),
    conflicts
  });

  appendAiHistory(req.db, {
    id: Date.now(),
    created_at: new Date().toISOString(),
    provider: historyProvider,
    model: historyModel,
    groupId: group.id,
    groupName: group.name,
    planId: resolvedPlanId,
    planName,
    summary: {
      total: pendingItems.length,
      planned: assignments.length,
      conflicts: conflicts.length
    },
    conflicts
  });
});

module.exports = router;
