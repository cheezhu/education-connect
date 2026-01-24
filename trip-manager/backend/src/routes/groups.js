const express = require('express');
const router = express.Router();
const requireEditLock = require('../middleware/editLock');

// 获取所有团组
router.get('/', (req, res) => {
  const groups = req.db.prepare('SELECT * FROM groups ORDER BY created_at DESC').all();
  res.json(groups);
});

// 获取单个团组
router.get('/:id', (req, res) => {
  const group = req.db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) {
    return res.status(404).json({ error: '团组不存在' });
  }
  res.json(group);
});

const calculateDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 5;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

// 创建团组（需要编辑锁）
router.post('/', requireEditLock, (req, res) => {
  const { 
    name, 
    type, 
    studentCount, 
    teacherCount, 
    startDate,
    endDate,
    duration, 
    color = '#1890ff',
    itineraryPlanId,
    contactPerson,
    contactPhone,
    notes,
    student_count,
    teacher_count,
    start_date,
    end_date,
    itinerary_plan_id,
    contact_person,
    contact_phone
  } = req.body;

  const resolvedStartDate = startDate ?? start_date;
  const resolvedEndDate = endDate ?? end_date;
  const resolvedStudentCount = studentCount ?? student_count ?? 40;
  const resolvedTeacherCount = teacherCount ?? teacher_count ?? 4;
  const resolvedDuration = duration ?? calculateDuration(resolvedStartDate, resolvedEndDate);
  const resolvedContactPerson = contactPerson ?? contact_person;
  const resolvedContactPhone = contactPhone ?? contact_phone;
  const resolvedItineraryPlanId = itineraryPlanId ?? itinerary_plan_id ?? null;

  if (!name || !type || !resolvedStartDate || !resolvedEndDate) {
    return res.status(400).json({ 
      error: '缺少必需字段: name, type, start_date, end_date' 
    });
  }

  try {
    const result = req.db.prepare(`
      INSERT INTO groups (
        name, type, student_count, teacher_count, 
        start_date, end_date, duration, color, itinerary_plan_id, contact_person,
        contact_phone, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, type, resolvedStudentCount, resolvedTeacherCount,
      resolvedStartDate, resolvedEndDate, resolvedDuration, color, resolvedItineraryPlanId,
      resolvedContactPerson, resolvedContactPhone, notes
    );

    const newGroup = req.db.prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, group: newGroup });
  } catch (error) {
    console.error('创建团组失败:', error);
    res.status(500).json({ error: '创建团组失败' });
  }
});

// 更新团组（需要编辑锁）
router.put('/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  const updates = [];
  const values = [];

  // 构建更新字段
  const allowedFields = [
    'name', 'type', 'student_count', 'teacher_count',
    'start_date', 'end_date', 'duration', 'color', 'contact_person',
    'contact_phone', 'notes', 'itinerary_plan_id'
  ];

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  try {
    const result = req.db.prepare(`
      UPDATE groups 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    if (result.changes === 0) {
      return res.status(404).json({ error: '团组不存在' });
    }

    const updatedGroup = req.db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
    res.json({ success: true, group: updatedGroup });
  } catch (error) {
    console.error('更新团组失败:', error);
    res.status(500).json({ error: '更新团组失败' });
  }
});

// 删除团组（需要编辑锁）
router.delete('/:id', requireEditLock, (req, res) => {
  const { id } = req.params;

  // 检查是否有关联的活动
  const activityCount = req.db.prepare(
    'SELECT COUNT(*) as count FROM activities WHERE group_id = ?'
  ).get(id);

  if (activityCount.count > 0) {
    return res.status(400).json({ 
      error: '无法删除团组，存在关联的活动安排' 
    });
  }

  try {
    const result = req.db.prepare('DELETE FROM groups WHERE id = ?').run(id);
    
    res.json({ 
      success: result.changes > 0,
      message: result.changes > 0 ? '团组已删除' : '团组不存在'
    });
  } catch (error) {
    console.error('删除团组失败:', error);
    res.status(500).json({ error: '删除团组失败' });
  }
});

module.exports = router;
