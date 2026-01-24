const express = require('express');
const router = express.Router();
const requireEditLock = require('../middleware/editLock');

const toMinutes = (timeValue) => {
  if (!timeValue) return null;
  const [hourStr, minuteStr] = timeValue.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

const SLOT_WINDOWS = {
  MORNING: { start: '06:00', end: '12:00' },
  AFTERNOON: { start: '12:00', end: '18:00' },
  EVENING: { start: '18:00', end: '20:45' }
};

const getTimeSlotFromStart = (startTime) => {
  const minutes = toMinutes(startTime);
  if (minutes === null) return 'MORNING';
  if (minutes < 12 * 60) return 'MORNING';
  if (minutes < 18 * 60) return 'AFTERNOON';
  return 'EVENING';
};

const getTimeSlotFromRange = (startTime, endTime) => {
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return getTimeSlotFromStart(startTime);
  }

  let bestSlot = null;
  let bestOverlap = -1;
  Object.entries(SLOT_WINDOWS).forEach(([slotKey, window]) => {
    const windowStart = toMinutes(window.start);
    const windowEnd = toMinutes(window.end);
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) return;
    const overlap = Math.max(
      0,
      Math.min(endMinutes, windowEnd) - Math.max(startMinutes, windowStart)
    );
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestSlot = slotKey;
    }
  });

  if (bestSlot) {
    return bestSlot;
  }
  return getTimeSlotFromStart(startTime);
};

const syncSchedulesToActivities = (db, groupId) => {
  const schedules = db.prepare(`
    SELECT id, group_id, activity_date, start_time, end_time, location_id
    FROM schedules
    WHERE group_id = ?
  `).all(groupId);

  const group = db.prepare(`
    SELECT student_count, teacher_count
    FROM groups
    WHERE id = ?
  `).get(groupId);

  const participantCount = group
    ? (group.student_count || 0) + (group.teacher_count || 0)
    : 0;

  const insertActivity = db.prepare(`
    INSERT INTO activities (
      schedule_id, group_id, location_id, activity_date, time_slot, participant_count
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const updateActivity = db.prepare(`
    UPDATE activities
    SET group_id = ?, location_id = ?, activity_date = ?, time_slot = ?, participant_count = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const findActivityBySchedule = db.prepare(`
    SELECT id
    FROM activities
    WHERE schedule_id = ?
  `);

  schedules.forEach((schedule) => {
    const timeSlot = getTimeSlotFromRange(schedule.start_time, schedule.end_time);
    const existing = findActivityBySchedule.get(schedule.id);
    if (existing) {
      updateActivity.run(
        groupId,
        schedule.location_id ?? null,
        schedule.activity_date,
        timeSlot,
        participantCount,
        existing.id
      );
    } else {
      insertActivity.run(
        schedule.id,
        groupId,
        schedule.location_id ?? null,
        schedule.activity_date,
        timeSlot,
        participantCount
      );
    }
  });

  if (schedules.length === 0) {
    db.prepare('DELETE FROM activities WHERE group_id = ? AND schedule_id IS NOT NULL').run(groupId);
    return;
  }

  const scheduleIds = schedules.map((item) => item.id);
  const placeholders = scheduleIds.map(() => '?').join(', ');
  db.prepare(`
    DELETE FROM activities
    WHERE group_id = ?
      AND schedule_id IS NOT NULL
      AND schedule_id NOT IN (${placeholders})
  `).run(groupId, ...scheduleIds);
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

// 获取指定团组的日程详情
router.get('/groups/:groupId/schedules', (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) {
    return res.status(400).json({ error: '无效团组ID' });
  }

  const rows = req.db.prepare(`
    SELECT id, group_id, activity_date, start_time, end_time, type,
           title, location, description, color, resource_id, is_from_resource, location_id
    FROM schedules
    WHERE group_id = ?
    ORDER BY activity_date, start_time, id
  `).all(groupId);

  res.json(rows.map(mapScheduleRow));
});

// 获取所有日程（调试用途）
router.get('/schedules', (req, res) => {
  const rows = req.db.prepare(`
    SELECT id, group_id, activity_date, start_time, end_time, type,
           title, location, description, color, resource_id, is_from_resource, location_id
    FROM schedules
    ORDER BY activity_date, start_time, id
  `).all();

  res.json(rows.map(mapScheduleRow));
});

// 批量保存团组日程（替换该团组的全部日程）
router.post('/groups/:groupId/schedules/batch', requireEditLock, (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) {
    return res.status(400).json({ error: '无效团组ID' });
  }

  const scheduleList = Array.isArray(req.body.scheduleList) ? req.body.scheduleList : [];

  const invalid = scheduleList.find((item) => !item.date || !item.startTime || !item.endTime);
  if (invalid) {
    return res.status(400).json({ error: '日程数据缺少日期或时间' });
  }

  const insert = req.db.prepare(`
    INSERT INTO schedules (
      id, group_id, activity_date, start_time, end_time, type,
      title, location, description, color, resource_id, is_from_resource, location_id,
      created_at, updated_at
    ) VALUES (
      @id, @groupId, @date, @startTime, @endTime, @type,
      @title, @location, @description, @color, @resourceId, @isFromResource, @locationId,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);

  const replaceAll = req.db.transaction((items) => {
    req.db.prepare('DELETE FROM schedules WHERE group_id = ?').run(groupId);

    items.forEach((item) => {
      insert.run({
        id: item.id ?? null,
        groupId,
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime,
        type: item.type || 'visit',
        title: item.title || '',
        location: item.location || '',
        description: item.description || '',
        color: item.color || null,
        resourceId: item.resourceId || null,
        isFromResource: item.isFromResource ? 1 : 0,
        locationId: item.locationId ?? null
      });
    });
  });

  try {
    replaceAll(scheduleList);

    syncSchedulesToActivities(req.db, groupId);

    const rows = req.db.prepare(`
      SELECT id, group_id, activity_date, start_time, end_time, type,
             title, location, description, color, resource_id, is_from_resource, location_id
      FROM schedules
      WHERE group_id = ?
      ORDER BY activity_date, start_time, id
    `).all(groupId);

    res.json(rows.map(mapScheduleRow));
  } catch (error) {
    console.error('批量保存日程失败:', error);
    res.status(500).json({ error: '批量保存日程失败' });
  }
});

module.exports = router;
