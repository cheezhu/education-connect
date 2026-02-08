const express = require('express');
const router = express.Router();
const requireEditLock = require('../middleware/editLock');
const { getScheduleRevision, bumpScheduleRevision } = require('../utils/scheduleRevision');
const { requireRole } = require('../middleware/permission');

const { resolveTimeSlotByOverlap, timeSlotWindows } = require('../../../shared/domain/time.cjs');
const { isPlanResourceId } = require('../../../shared/domain/resourceId.cjs');

const syncSchedulesToActivities = (db, groupId) => {
  const syncableSchedules = db.prepare(`
    SELECT id, group_id, activity_date, start_time, end_time, location_id, resource_id
    FROM schedules
    WHERE group_id = ?
      AND location_id IS NOT NULL
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
      schedule_id, is_plan_item, group_id, location_id, activity_date, time_slot, participant_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const updateActivity = db.prepare(`
    UPDATE activities
    SET is_plan_item = ?, group_id = ?, location_id = ?, activity_date = ?, time_slot = ?, participant_count = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const findActivityBySchedule = db.prepare(`
    SELECT id
    FROM activities
    WHERE schedule_id = ?
  `);

  syncableSchedules.forEach((schedule) => {
    const timeSlot = resolveTimeSlotByOverlap(schedule.start_time, schedule.end_time);
    const isPlanItem = isPlanResourceId(schedule.resource_id);
    const existing = findActivityBySchedule.get(schedule.id);
    if (existing) {
      updateActivity.run(
        isPlanItem ? 1 : 0,
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
        isPlanItem ? 1 : 0,
        groupId,
        schedule.location_id ?? null,
        schedule.activity_date,
        timeSlot,
        participantCount
      );
    }
  });

  if (syncableSchedules.length === 0) {
    db.prepare('DELETE FROM activities WHERE group_id = ? AND schedule_id IS NOT NULL').run(groupId);
  } else {
    const scheduleIds = syncableSchedules.map((item) => item.id);
    const placeholders = scheduleIds.map(() => '?').join(', ');
    db.prepare(`
      DELETE FROM activities
      WHERE group_id = ?
        AND schedule_id IS NOT NULL
        AND schedule_id NOT IN (${placeholders})
    `).run(groupId, ...scheduleIds);
  }
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

const normalizeScheduleId = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
};

// 鑾峰彇鎸囧畾鍥㈢粍鐨勬棩绋嬭鎯?
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

  res.setHeader('x-schedule-revision', getScheduleRevision(req.db, groupId));
  res.json(rows.map(mapScheduleRow));
});

// 从行程设计器拉取可同步的行程点（仅行程点，不包含自定义）
router.get('/groups/:groupId/schedules/designer-source', requireRole(['admin']), (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) {
    return res.status(400).json({ error: 'Invalid group id' });
  }

  const rows = req.db.prepare(`
    SELECT
      a.id AS activity_id,
      a.group_id,
      a.activity_date,
      a.time_slot,
      a.location_id,
      s.id AS schedule_id,
      s.start_time,
      s.end_time,
      s.type AS schedule_type,
      s.title AS schedule_title,
      s.description AS schedule_description,
      s.color AS schedule_color,
      s.resource_id AS schedule_resource_id,
      l.name AS location_name,
      l.color AS location_color
    FROM activities a
    LEFT JOIN schedules s ON s.id = a.schedule_id
    LEFT JOIN locations l ON l.id = a.location_id
    WHERE a.group_id = ?
      AND a.location_id IS NOT NULL
    ORDER BY
      a.activity_date,
      CASE a.time_slot
        WHEN 'MORNING' THEN 1
        WHEN 'AFTERNOON' THEN 2
        WHEN 'EVENING' THEN 3
        ELSE 4
      END,
      a.id
  `).all(groupId);

  const scheduleList = rows.map((row) => {
    const slotWindow = timeSlotWindows[row.time_slot] || timeSlotWindows.MORNING;
    const title = (row.schedule_title && String(row.schedule_title).trim())
      ? row.schedule_title
      : (row.location_name || '行程点');

    return {
      id: normalizeScheduleId(row.schedule_id),
      groupId: row.group_id,
      date: row.activity_date,
      startTime: row.start_time || slotWindow.start,
      endTime: row.end_time || slotWindow.end,
      type: row.schedule_type || 'visit',
      title,
      location: row.location_name || '',
      description: row.schedule_description || '',
      color: row.schedule_color || row.location_color || null,
      resourceId: row.schedule_resource_id || `plan-sync-${row.location_id}`,
      isFromResource: true,
      locationId: row.location_id
    };
  });

  res.json({
    available: scheduleList.length > 0,
    count: scheduleList.length,
    source: 'designer-plan-items',
    scheduleList
  });
});

// 鑾峰彇鎵€鏈夋棩绋嬶紙璋冭瘯鐢ㄩ€旓級
router.get('/schedules', (req, res) => {
  const rows = req.db.prepare(`
    SELECT id, group_id, activity_date, start_time, end_time, type,
           title, location, description, color, resource_id, is_from_resource, location_id
    FROM schedules
    ORDER BY activity_date, start_time, id
  `).all();

  res.json(rows.map(mapScheduleRow));
});

// 鎵归噺淇濆瓨鍥㈢粍鏃ョ▼锛堟浛鎹㈣鍥㈢粍鐨勫叏閮ㄦ棩绋嬶級
router.post('/groups/:groupId/schedules/batch', requireEditLock, (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) {
    return res.status(400).json({ error: '无效团组ID' });
  }

  const currentRevision = getScheduleRevision(req.db, groupId);
  const clientRevision = Number(req.body?.revision);
  if (!Number.isFinite(clientRevision) || clientRevision !== currentRevision) {
    res.setHeader('x-schedule-revision', currentRevision);
    return res.status(409).json({
      error: 'Schedule revision mismatch',
      currentRevision
    });
  }

  const scheduleList = Array.isArray(req.body.scheduleList) ? req.body.scheduleList : [];

  const invalid = scheduleList.find((item) => !item.date || !item.startTime || !item.endTime);
  if (invalid) {
    return res.status(400).json({ error: 'Missing required schedule fields: date/startTime/endTime' });
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
        id: normalizeScheduleId(item.id),
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

    const nextRevision = bumpScheduleRevision(req.db, groupId);

    const rows = req.db.prepare(`
      SELECT id, group_id, activity_date, start_time, end_time, type,
             title, location, description, color, resource_id, is_from_resource, location_id
      FROM schedules
      WHERE group_id = ?
      ORDER BY activity_date, start_time, id
    `).all(groupId);

    res.setHeader('x-schedule-revision', nextRevision);
    res.json(rows.map(mapScheduleRow));
  } catch (error) {
    console.error('批量保存日程失败:', error);
    res.status(500).json({ error: '批量保存日程失败' });
  }
});


// 将“日历详情”的行程点推送到行程设计器（写入 activities，仅推送 locationId 非空项）
router.post(
  '/groups/:groupId/schedules/push-to-designer',
  requireRole(['admin']),
  requireEditLock,
  (req, res) => {
    const groupId = Number(req.params.groupId);
    if (!Number.isFinite(groupId)) {
      return res.status(400).json({ error: 'Invalid group id' });
    }

    const group = req.db.prepare(`
      SELECT student_count, teacher_count
      FROM groups
      WHERE id = ?
    `).get(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const participantCount = (group.student_count || 0) + (group.teacher_count || 0);
    const incoming = Array.isArray(req.body?.scheduleList) ? req.body.scheduleList : null;
    const sourceSchedules = incoming || req.db.prepare(`
      SELECT id, activity_date as date, start_time as startTime, end_time as endTime, location_id as locationId
      FROM schedules
      WHERE group_id = ?
        AND location_id IS NOT NULL
      ORDER BY activity_date, start_time, id
    `).all(groupId);

    const planItems = (sourceSchedules || [])
      .map((item) => {
        const date = item?.date || item?.activity_date;
        const startTime = item?.startTime || item?.start_time;
        const endTime = item?.endTime || item?.end_time;
        const locationId = Number(item?.locationId ?? item?.location_id);
        if (!date || !startTime || !endTime) return null;
        if (!Number.isFinite(locationId) || locationId <= 0) return null;
        return {
          scheduleId: normalizeScheduleId(item?.id),
          date,
          timeSlot: resolveTimeSlotByOverlap(startTime, endTime),
          locationId
        };
      })
      .filter(Boolean);

    const deleteExisting = req.db.prepare(`
      DELETE FROM activities
      WHERE group_id = ?
        AND location_id IS NOT NULL
    `);
    const insertActivity = req.db.prepare(`
      INSERT INTO activities (
        schedule_id, is_plan_item, group_id, location_id, activity_date, time_slot, participant_count
      ) VALUES (?, 1, ?, ?, ?, ?, ?)
    `);

    const transaction = req.db.transaction(() => {
      const deleted = deleteExisting.run(groupId).changes || 0;
      planItems.forEach((row) => {
        insertActivity.run(
          row.scheduleId ?? null,
          groupId,
          row.locationId,
          row.date,
          row.timeSlot,
          participantCount
        );
      });
      return { deleted, inserted: planItems.length };
    });

    try {
      const result = transaction();
      res.json({
        ok: true,
        groupId,
        deleted: result.deleted,
        inserted: result.inserted
      });
    } catch (error) {
      console.error('Push schedules to designer failed:', error);
      res.status(500).json({ error: 'Push failed' });
    }
  }
);
module.exports = router;



