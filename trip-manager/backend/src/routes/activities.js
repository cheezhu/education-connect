const express = require('express');
const router = express.Router();
const requireEditLock = require('../middleware/editLock');

const mapActivityRow = (row) => ({
  id: row.id,
  groupId: row.group_id,
  locationId: row.location_id,
  date: row.activity_date,
  timeSlot: row.time_slot,
  participantCount: row.participant_count,
  notes: row.notes,
  scheduleId: row.schedule_id,
  isPlanItem: Boolean(row.is_plan_item)
});

const toMinutes = (timeValue) => {
  if (!timeValue) return null;
  const [hourStr, minuteStr] = timeValue.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

const toTimeString = (totalMinutes) => {
  if (!Number.isFinite(totalMinutes)) return '09:00';
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const getDefaultTimeRange = (timeSlot) => {
  if (timeSlot === 'AFTERNOON') {
    return { startTime: '12:00', endTime: '18:00' };
  }
  if (timeSlot === 'EVENING') {
    return { startTime: '18:00', endTime: '20:45' };
  }
  return { startTime: '06:00', endTime: '12:00' };
};

const getSchedulePlacement = (db, groupId, date, timeSlot, excludeScheduleId) => {
  const params = [groupId, date];
  let query = `
    SELECT start_time, end_time
    FROM schedules
    WHERE group_id = ?
      AND activity_date = ?
  `;
  if (excludeScheduleId) {
    query += ' AND id != ?';
    params.push(excludeScheduleId);
  }

  const rows = db.prepare(query).all(...params);
  const slotWindow = getDefaultTimeRange(timeSlot);
  const windowStart = toMinutes(slotWindow.startTime);
  const windowEnd = toMinutes(slotWindow.endTime);
  const defaultDuration = 60;

  if (rows.length === 0 || !Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) {
    return getDefaultTimeRange(timeSlot);
  }

  const intervals = rows
    .map(row => ({
      start: toMinutes(row.start_time),
      end: toMinutes(row.end_time)
    }))
    .filter(item => Number.isFinite(item.start) && Number.isFinite(item.end))
    .sort((a, b) => a.start - b.start);

  if (intervals.length === 0) {
    return getDefaultTimeRange(timeSlot);
  }

  let candidateStart = windowStart;
  for (const interval of intervals) {
    if (interval.end <= candidateStart) {
      continue;
    }
    if (interval.start - candidateStart >= defaultDuration) {
      return {
        startTime: toTimeString(candidateStart),
        endTime: toTimeString(candidateStart + defaultDuration)
      };
    }
    candidateStart = Math.max(candidateStart, interval.end);
    if (candidateStart >= windowEnd) {
      break;
    }
  }

  if (windowEnd - candidateStart >= defaultDuration) {
    return {
      startTime: toTimeString(candidateStart),
      endTime: toTimeString(candidateStart + defaultDuration)
    };
  }

  const lastEnd = Math.max(...intervals.map(item => item.end));
  const fallbackStart = Math.max(lastEnd, windowEnd);
  return {
    startTime: toTimeString(fallbackStart),
    endTime: toTimeString(fallbackStart + defaultDuration)
  };
};

const syncActivityToSchedule = (db, activity, options = {}) => {
  const shouldReposition = Boolean(options.reposition);
  const existingSchedule = activity.schedule_id
    ? db.prepare(`
        SELECT id, type, title, location, description, color, resource_id, is_from_resource, start_time, end_time, location_id
        FROM schedules
        WHERE id = ?
      `).get(activity.schedule_id)
    : null;

  const group = db.prepare('SELECT name, color FROM groups WHERE id = ?').get(activity.group_id);
  const location = activity.location_id
    ? db.prepare('SELECT name, address FROM locations WHERE id = ?').get(activity.location_id)
    : null;

  const noteTitle = activity?.notes ? String(activity.notes).trim() : '';
  const defaultTitle = noteTitle || location?.name || group?.name || '行程活动';
  const resolvedTitle = existingSchedule?.title?.trim() ? existingSchedule.title : defaultTitle;
  const resolvedLocation = location?.name || existingSchedule?.location || '';
  const resolvedType = existingSchedule?.type || 'visit';
  const resolvedColor = existingSchedule?.color || group?.color || '#1890ff';
  const resolvedDescription = existingSchedule?.description || '';
  const resolvedResourceId = existingSchedule?.resource_id || null;
  const resolvedIsFromResource = existingSchedule?.is_from_resource ? 1 : 0;

  let startTime = existingSchedule?.start_time;
  let endTime = existingSchedule?.end_time;
  if (!existingSchedule || shouldReposition) {
    const placement = getSchedulePlacement(
      db,
      activity.group_id,
      activity.activity_date,
      activity.time_slot,
      existingSchedule?.id
    );
    startTime = placement.startTime;
    endTime = placement.endTime;
  }

  if (existingSchedule) {
    db.prepare(`
      UPDATE schedules
      SET activity_date = ?,
          start_time = ?,
          end_time = ?,
          type = ?,
          title = ?,
          location = ?,
          description = ?,
          color = ?,
          resource_id = ?,
          is_from_resource = ?,
          location_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      activity.activity_date,
      startTime,
      endTime,
      resolvedType,
      resolvedTitle,
      resolvedLocation,
      resolvedDescription,
      resolvedColor,
      resolvedResourceId,
      resolvedIsFromResource,
      activity.location_id ?? null,
      existingSchedule.id
    );

    return existingSchedule.id;
  }

  const result = db.prepare(`
    INSERT INTO schedules (
      group_id, activity_date, start_time, end_time, type,
      title, location, description, color, resource_id, is_from_resource, location_id,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run(
    activity.group_id,
    activity.activity_date,
    startTime,
    endTime,
    resolvedType,
    resolvedTitle,
    resolvedLocation,
    resolvedDescription,
    resolvedColor,
    resolvedResourceId,
    resolvedIsFromResource,
    activity.location_id ?? null
  );

  db.prepare('UPDATE activities SET schedule_id = ? WHERE id = ?')
    .run(result.lastInsertRowid, activity.id);

  return result.lastInsertRowid;
};

// 获取活动列表
router.get('/', (req, res) => {
  const { startDate, endDate, groupId, locationId } = req.query;
  
  let query = 'SELECT * FROM calendar_view WHERE 1=1';
  const params = [];
  
  if (startDate) {
    query += ' AND activity_date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND activity_date <= ?';
    params.push(endDate);
  }
  
  if (groupId) {
    query += ' AND group_id = ?';
    params.push(groupId);
  }
  
  if (locationId) {
    query += ' AND location_id = ?';
    params.push(locationId);
  }
  
  const activities = req.db.prepare(query).all(...params);
  
  // 转换为FullCalendar格式
  const events = activities.map(a => {
    const timeInfo = getTimeFromSlot(a.time_slot);
    if (!timeInfo) {
      return null;
    }
    const locationName = a.location_name || '未安排';

    return {
      id: a.id,
      title: `${a.group_name} - ${locationName}`,
      start: `${a.activity_date}T${timeInfo.start}`,
      end: `${a.activity_date}T${timeInfo.end}`,
      backgroundColor: a.group_color,
      extendedProps: {
        groupId: a.group_id,
        locationId: a.location_id,
        participantCount: a.participant_count,
        capacity: a.location_capacity ?? 0,
        timeSlot: a.time_slot
      }
    };
  }).filter(Boolean);
  
  res.json(events);
});

// 获取原始活动数据（用于团组管理页面）
router.get('/raw', (req, res) => {
  const activities = req.db.prepare(`
    SELECT id, schedule_id, is_plan_item, group_id, location_id, activity_date, time_slot, participant_count, notes
    FROM activities
    ORDER BY activity_date, time_slot
  `).all();

  res.json(activities.map(mapActivityRow));
});

// 创建活动（需要编辑锁）
router.post('/', requireEditLock, (req, res) => {
  const { groupId, locationId, date, timeSlot, participantCount, notes } = req.body;
  
  if (!groupId || !date || !timeSlot) {
    return res.status(400).json({ 
      error: '缺少必需字段: groupId, date, timeSlot' 
    });
  }
  
  // 检查冲突
  const conflicts = checkConflicts(req.db, {
    groupId, locationId, date, timeSlot, participantCount
  });
  
  if (conflicts.length > 0) {
    return res.status(400).json({ 
      error: '存在冲突',
      conflicts 
    });
  }
  
  try {
    // 创建活动
    const result = req.db.prepare(`
      INSERT INTO activities (group_id, location_id, activity_date, time_slot, participant_count, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(groupId, locationId ?? null, date, timeSlot, participantCount, notes ?? null);

    const activity = req.db.prepare('SELECT * FROM activities WHERE id = ?').get(result.lastInsertRowid);
    // Activities are the designer's source-of-truth now; schedules are synced explicitly via push/pull.
    res.json(mapActivityRow(activity));
  } catch (error) {
    console.error('创建活动失败:', error);
    res.status(500).json({ error: '创建活动失败' });
  }
});

// 更新活动（需要编辑锁）
router.put('/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  const { locationId, date, timeSlot, participantCount, notes, ignoreConflicts = false } = req.body;
  
  // 获取当前活动信息
  const activity = req.db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!activity) {
    return res.status(404).json({ error: '活动不存在' });
  }
  
  // 检查新的安排是否有冲突
  const hardConflicts = checkHardConstraints(req.db, {
    groupId: activity.group_id,
    locationId: locationId ?? activity.location_id,
    date: date ?? activity.activity_date
  });
  if (hardConflicts.length > 0) {
    return res.status(400).json({
      error: 'Hard constraints violated',
      conflicts: hardConflicts
    });
  }

  if (ignoreConflicts !== true) {
    const conflicts = checkConflicts(req.db, {
      groupId: activity.group_id,
      locationId: locationId ?? activity.location_id,
      date: date ?? activity.activity_date,
      timeSlot: timeSlot ?? activity.time_slot,
      participantCount: participantCount ?? activity.participant_count,
      excludeId: id
    });
    
    if (conflicts.length > 0) {
      return res.status(400).json({ 
        error: '瀛樺湪鍐茬獊',
        conflicts 
      });
    }
  }
  
  const updates = [];
  const values = [];

  // If the activity is moved/retargeted, its previous schedule link (if any) is no longer meaningful.
  const nextLocationId = locationId !== undefined ? (locationId ?? null) : activity.location_id;
  const nextDate = date !== undefined ? date : activity.activity_date;
  const nextTimeSlot = timeSlot !== undefined ? timeSlot : activity.time_slot;
  const invalidateScheduleLink = (
    nextLocationId !== activity.location_id
    || nextDate !== activity.activity_date
    || nextTimeSlot !== activity.time_slot
  );
  
  if (locationId !== undefined) {
    updates.push('location_id = ?');
    values.push(locationId ?? null);
  }
  if (date !== undefined) {
    updates.push('activity_date = ?');
    values.push(date);
  }
  if (timeSlot !== undefined) {
    updates.push('time_slot = ?');
    values.push(timeSlot);
  }
  if (participantCount !== undefined) {
    updates.push('participant_count = ?');
    values.push(participantCount);
  }
  if (notes !== undefined) {
    updates.push('notes = ?');
    values.push(notes ?? null);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }
  
  if (invalidateScheduleLink) {
    updates.push('schedule_id = NULL');
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  
  try {
    req.db.prepare(`
      UPDATE activities 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const updatedActivity = req.db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
    res.json(mapActivityRow(updatedActivity));
  } catch (error) {
    console.error('更新活动失败:', error);
    res.status(500).json({ error: '更新活动失败' });
  }
});

// 删除活动（需要编辑锁）
router.delete('/:id', requireEditLock, (req, res) => {
  try {
    const result = req.db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);

    res.json({ 
      success: result.changes > 0,
      message: result.changes > 0 ? '活动已删除' : '活动不存在'
    });
  } catch (error) {
    console.error('删除活动失败:', error);
    res.status(500).json({ error: '删除活动失败' });
  }
});

// 辅助函数：获取时间段
function getTimeFromSlot(slot) {
  const times = {
    'MORNING': { start: '06:00:00', end: '12:00:00' },
    'AFTERNOON': { start: '12:00:00', end: '18:00:00' },
    'EVENING': { start: '18:00:00', end: '20:45:00' }
  };
  return times[slot];
}

// 辅助函数：检查冲突
function parseDelimitedValues(value) {
  return String(value || "")
    .split(/[ ,|;]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function toDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateString(date) {
  if (!date) return "";
  return String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function checkHardConstraints(db, params) {
  const conflicts = [];
  const { groupId, locationId, date } = params;
  const targetDate = toDateOnly(date);

  if (groupId && targetDate) {
    const group = db.prepare("SELECT name, start_date, end_date FROM groups WHERE id = ?").get(groupId);
    if (group?.start_date && group?.end_date) {
      const startDate = toDateOnly(group.start_date);
      const endDate = toDateOnly(group.end_date);
      if (startDate && endDate && (targetDate < startDate || targetDate > endDate)) {
        conflicts.push({
          type: "group_date_range",
          message: (group.name || "Group") + " is outside travel date range"
        });
      }
    }
  }

  if (locationId && targetDate) {
    const location = db.prepare("SELECT name, is_active, blocked_weekdays, closed_dates FROM locations WHERE id = ?").get(locationId);
    if (location) {
      if (Number(location.is_active) === 0) {
        conflicts.push({
          type: "location_inactive",
          message: (location.name || "Location") + " is inactive"
        });
      }
      const dayOfWeek = targetDate.getDay();
      const blockedWeekdays = parseDelimitedValues(location.blocked_weekdays);
      if (blockedWeekdays.includes(String(dayOfWeek))) {
        conflicts.push({
          type: "location_weekday_blocked",
          message: (location.name || "Location") + " is not available on this weekday"
        });
      }
      const dateText = toDateString(targetDate);
      const closedDateSet = new Set(parseDelimitedValues(location.closed_dates));
      if (closedDateSet.has(dateText)) {
        conflicts.push({
          type: "location_closed_date",
          message: (location.name || "Location") + " is closed on " + dateText
        });
      }
    }
  }

  return conflicts;
}
function checkConflicts(db, params) {
  const conflicts = [];
  const { groupId, locationId, date, timeSlot, participantCount, excludeId } = params;
  const resolvedParticipantCount = Number.isFinite(Number(participantCount))
    ? Number(participantCount)
    : 0;
  
  // 1. 检查地点容量
  if (locationId) {
    const capacityQuery = `
      SELECT 
        l.capacity,
        l.name,
        COALESCE(SUM(a.participant_count), 0) as current_count
      FROM locations l
      LEFT JOIN activities a ON a.location_id = l.id 
        AND a.activity_date = ? 
        AND a.time_slot = ?
        ${excludeId ? 'AND a.id != ?' : ''}
      WHERE l.id = ?
      GROUP BY l.id
    `;
    
    const capacityParams = [date, timeSlot];
    if (excludeId) capacityParams.push(excludeId);
    capacityParams.push(locationId);
    
    const capacity = db.prepare(capacityQuery).get(...capacityParams);
    if (capacity && (capacity.current_count + resolvedParticipantCount > capacity.capacity)) {
      conflicts.push({
        type: 'capacity',
        message: `${capacity.name} 容量不足（当前${capacity.current_count}人，容量${capacity.capacity}人）`
      });
    }
  }
  
  // 2. 检查地点限制
  if (locationId) {
    const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(locationId);
    if (location) {
      // 检查星期限制
      const dayOfWeek = new Date(date).getDay();
      if (location.blocked_weekdays && location.blocked_weekdays.includes(dayOfWeek.toString())) {
        conflicts.push({
          type: 'weekday',
          message: `${location.name} 在该日期不开放`
        });
      }
      
      // 检查团组类型限制
      const group = db.prepare('SELECT type FROM groups WHERE id = ?').get(groupId);
      if (location.target_groups !== 'all' && location.target_groups !== group.type) {
        conflicts.push({
          type: 'group_type',
          message: `${location.name} 不接待${group.type === 'primary' ? '小学' : '中学'}团组`
        });
      }
    }
  }
  
  return conflicts;
}

module.exports = router;
