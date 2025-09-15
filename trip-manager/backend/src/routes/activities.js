const express = require('express');
const router = express.Router();
const requireEditLock = require('../middleware/editLock');

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
  const events = activities.map(a => ({
    id: a.id,
    title: `${a.group_name} - ${a.location_name}`,
    start: `${a.activity_date}T${getTimeFromSlot(a.time_slot).start}`,
    end: `${a.activity_date}T${getTimeFromSlot(a.time_slot).end}`,
    backgroundColor: a.group_color,
    extendedProps: {
      groupId: a.group_id,
      locationId: a.location_id,
      participantCount: a.participant_count,
      capacity: a.location_capacity,
      timeSlot: a.time_slot
    }
  }));
  
  res.json(events);
});

// 创建活动（需要编辑锁）
router.post('/', requireEditLock, (req, res) => {
  const { groupId, locationId, date, timeSlot, participantCount } = req.body;
  
  if (!groupId || !locationId || !date || !timeSlot) {
    return res.status(400).json({ 
      error: '缺少必需字段: groupId, locationId, date, timeSlot' 
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
      INSERT INTO activities (group_id, location_id, activity_date, time_slot, participant_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(groupId, locationId, date, timeSlot, participantCount);
    
    res.json({ 
      success: true, 
      id: result.lastInsertRowid 
    });
  } catch (error) {
    console.error('创建活动失败:', error);
    res.status(500).json({ error: '创建活动失败' });
  }
});

// 更新活动（需要编辑锁）
router.put('/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  const { locationId, date, timeSlot, participantCount } = req.body;
  
  // 获取当前活动信息
  const activity = req.db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!activity) {
    return res.status(404).json({ error: '活动不存在' });
  }
  
  // 检查新的安排是否有冲突
  const conflicts = checkConflicts(req.db, {
    groupId: activity.group_id,
    locationId: locationId || activity.location_id,
    date: date || activity.activity_date,
    timeSlot: timeSlot || activity.time_slot,
    participantCount: participantCount || activity.participant_count,
    excludeId: id
  });
  
  if (conflicts.length > 0) {
    return res.status(400).json({ 
      error: '存在冲突',
      conflicts 
    });
  }
  
  // 更新活动
  const updates = [];
  const values = [];
  
  if (locationId) {
    updates.push('location_id = ?');
    values.push(locationId);
  }
  if (date) {
    updates.push('activity_date = ?');
    values.push(date);
  }
  if (timeSlot) {
    updates.push('time_slot = ?');
    values.push(timeSlot);
  }
  if (participantCount) {
    updates.push('participant_count = ?');
    values.push(participantCount);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  
  try {
    req.db.prepare(`
      UPDATE activities 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);
    
    res.json({ success: true });
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
    'AM': { start: '09:30:00', end: '11:30:00' },
    'PM1': { start: '14:00:00', end: '15:30:00' },
    'PM2': { start: '16:00:00', end: '17:30:00' }
  };
  return times[slot];
}

// 辅助函数：检查冲突
function checkConflicts(db, params) {
  const conflicts = [];
  const { groupId, locationId, date, timeSlot, participantCount, excludeId } = params;
  
  // 1. 检查团组时间冲突
  let query = `
    SELECT * FROM activities 
    WHERE group_id = ? AND activity_date = ? AND time_slot = ?
  `;
  const queryParams = [groupId, date, timeSlot];
  
  if (excludeId) {
    query += ' AND id != ?';
    queryParams.push(excludeId);
  }
  
  const groupConflict = db.prepare(query).get(...queryParams);
  if (groupConflict) {
    conflicts.push({
      type: 'group_time',
      message: '该团组在此时段已有其他活动'
    });
  }
  
  // 2. 检查地点容量
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
  if (capacity && (capacity.current_count + participantCount > capacity.capacity)) {
    conflicts.push({
      type: 'capacity',
      message: `${capacity.name} 容量不足（当前${capacity.current_count}人，容量${capacity.capacity}人）`
    });
  }
  
  // 3. 检查地点限制
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
  
  return conflicts;
}

module.exports = router;