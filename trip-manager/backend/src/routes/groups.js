const express = require('express');
const router = express.Router();
const requireEditLock = require('../middleware/editLock');
const CANCELLED_STATUS = '已取消';

// 获取所有团组
router.get('/', (req, res) => {
  const groups = req.db.prepare('SELECT * FROM groups ORDER BY created_at DESC').all();
  res.json(groups.map(hydrateGroup));
});

// 获取单个团组
router.get('/:id', (req, res) => {
  const group = req.db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) {
    return res.status(404).json({ error: '团组不存在' });
  }
  res.json(hydrateGroup(group));
});

const calculateDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 5;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

const GROUP_COLOR_PALETTE = [
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#eb2f96',
  '#13c2c2',
  '#722ed1',
  '#f5222d',
  '#fa541c',
  '#2f54eb',
  '#a0d911'
];

const getRandomGroupColor = () => (
  GROUP_COLOR_PALETTE[Math.floor(Math.random() * GROUP_COLOR_PALETTE.length)] || '#1890ff'
);

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).map(item => String(item).trim()).filter(Boolean);
      }
    } catch (error) {
      // ignore parse errors
    }
    return trimmed.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [];
};

const serializeTags = (value) => JSON.stringify(normalizeTags(value));

const hydrateGroup = (group) => {
  if (!group) return group;
  return {
    ...group,
    tags: normalizeTags(group.tags)
  };
};


const normalizeGroupPayload = (payload = {}) => {
  const name = payload.name?.trim();
  const type = payload.type;
  const startDate = payload.startDate ?? payload.start_date;
  const endDate = payload.endDate ?? payload.end_date;
  const studentCount = payload.studentCount ?? payload.student_count ?? 40;
  const teacherCount = payload.teacherCount ?? payload.teacher_count ?? 4;
  const duration = payload.duration ?? calculateDuration(startDate, endDate);
  const color = payload.color ?? getRandomGroupColor();
  const itineraryPlanId = payload.itineraryPlanId ?? payload.itinerary_plan_id ?? null;
  const status = payload.status ?? null;
  const contactPerson = payload.contactPerson ?? payload.contact_person;
  const contactPhone = payload.contactPhone ?? payload.contact_phone;
  const emergencyContact = payload.emergencyContact ?? payload.emergency_contact;
  const emergencyPhone = payload.emergencyPhone ?? payload.emergency_phone;
  const accommodation = payload.accommodation ?? '';
  const tags = serializeTags(payload.tags);
  const notes = payload.notes ?? '';

  return {
    name,
    type,
    startDate,
    endDate,
    studentCount,
    teacherCount,
    duration,
    color,
    itineraryPlanId,
    status,
    contactPerson,
    contactPhone,
    emergencyContact,
    emergencyPhone,
    accommodation,
    tags,
    notes
  };
};

// Batch create groups (requires edit lock)
router.post('/batch', requireEditLock, (req, res) => {
  const { groups } = req.body;

  if (!Array.isArray(groups) || groups.length === 0) {
    return res.status(400).json({ error: '缺少团组列表' });
  }

  const insertStmt = req.db.prepare(`
    INSERT INTO groups (
      name, type, student_count, teacher_count,
      start_date, end_date, duration, color, itinerary_plan_id, contact_person,
      contact_phone, emergency_contact, emergency_phone, accommodation, tags, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const selectStmt = req.db.prepare('SELECT * FROM groups WHERE id = ?');

  const createBatch = req.db.transaction((items) => {
    const created = [];

    items.forEach((item, index) => {
      const normalized = normalizeGroupPayload(item);

      if (!normalized.name || !normalized.type || !normalized.startDate || !normalized.endDate) {
        throw new Error(`第 ${index + 1} 行缺少必要字段`);
      }

      const result = insertStmt.run(
        normalized.name,
        normalized.type,
        normalized.studentCount,
        normalized.teacherCount,
        normalized.startDate,
        normalized.endDate,
        normalized.duration,
        normalized.color,
        normalized.itineraryPlanId,
        normalized.contactPerson,
        normalized.contactPhone,
        normalized.emergencyContact,
        normalized.emergencyPhone,
        normalized.accommodation,
        normalized.tags,
        normalized.notes
      );

      created.push(selectStmt.get(result.lastInsertRowid));
    });

    return created;
  });

  try {
    const createdGroups = createBatch(groups);
    res.json({ success: true, count: createdGroups.length, groups: createdGroups.map(hydrateGroup) });
  } catch (error) {
    console.error('批量创建团组失败:', error);
    res.status(400).json({ error: '批量创建团组失败', message: error.message });
  }
});

router.post('/', requireEditLock, (req, res) => {
  const { 
    name, 
    type, 
    studentCount, 
    teacherCount, 
    startDate,
    endDate,
    duration, 
    color,
    itineraryPlanId,
    status,
    contactPerson,
    contactPhone,
    emergencyContact,
    emergencyPhone,
    accommodation,
    tags,
    notes,
    student_count,
    teacher_count,
    start_date,
    end_date,
    itinerary_plan_id,
    contact_person,
    contact_phone,
    emergency_contact,
    emergency_phone
  } = req.body;

  const resolvedStartDate = startDate ?? start_date;
  const resolvedEndDate = endDate ?? end_date;
  const resolvedStudentCount = studentCount ?? student_count ?? 40;
  const resolvedTeacherCount = teacherCount ?? teacher_count ?? 4;
  const resolvedDuration = duration ?? calculateDuration(resolvedStartDate, resolvedEndDate);
  const resolvedColor = color ?? getRandomGroupColor();
  const resolvedStatus = status ?? null;
  const resolvedContactPerson = contactPerson ?? contact_person;
  const resolvedContactPhone = contactPhone ?? contact_phone;
  const resolvedEmergencyContact = emergencyContact ?? emergency_contact ?? null;
  const resolvedEmergencyPhone = emergencyPhone ?? emergency_phone ?? null;
  const resolvedItineraryPlanId = itineraryPlanId ?? itinerary_plan_id ?? null;
  const resolvedAccommodation = accommodation ?? '';
  const resolvedTags = serializeTags(tags);

  if (!name || !type || !resolvedStartDate || !resolvedEndDate) {
    return res.status(400).json({ 
      error: '缺少必需字段: name, type, start_date, end_date' 
    });
  }

  try {
    const result = req.db.prepare(`
      INSERT INTO groups (
        name, type, student_count, teacher_count, 
        start_date, end_date, duration, color, itinerary_plan_id, status, contact_person,
        contact_phone, emergency_contact, emergency_phone, accommodation, tags, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, type, resolvedStudentCount, resolvedTeacherCount,
      resolvedStartDate, resolvedEndDate, resolvedDuration, resolvedColor, resolvedItineraryPlanId,
      resolvedStatus, resolvedContactPerson, resolvedContactPhone, resolvedEmergencyContact, resolvedEmergencyPhone,
      resolvedAccommodation, resolvedTags, notes
    );

    const newGroup = req.db.prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, group: hydrateGroup(newGroup) });
  } catch (error) {
    console.error('创建团组失败:', error);
    res.status(500).json({ error: '创建团组失败' });
  }
});

// 批量更新团组状态（需要编辑锁）
router.put('/batch-status', requireEditLock, (req, res) => {
  const { ids, status } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '缺少团组ID列表' });
  }

  const nextStatus = status === undefined ? null : status;
  const shouldClearSchedules = nextStatus === CANCELLED_STATUS;
  const updateStmt = req.db.prepare(`
    UPDATE groups
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const deleteSchedulesStmt = req.db.prepare('DELETE FROM schedules WHERE group_id = ?');
  const deleteActivitiesStmt = req.db.prepare('DELETE FROM activities WHERE group_id = ?');
  const selectStmt = req.db.prepare('SELECT id FROM groups WHERE id = ?');

  const updateBatch = req.db.transaction((items) => {
    const updatedIds = [];
    const missingIds = [];

    items.forEach((id) => {
      const exists = selectStmt.get(id);
      if (!exists) {
        missingIds.push(id);
        return;
      }
      updateStmt.run(nextStatus, id);
      if (shouldClearSchedules) {
        deleteSchedulesStmt.run(id);
        deleteActivitiesStmt.run(id);
      }
      updatedIds.push(id);
    });

    return { updatedIds, missingIds };
  });

  try {
    const result = updateBatch(ids);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('批量更新团组状态失败:', error);
    res.status(500).json({ error: '批量更新团组状态失败' });
  }
});

// 批量删除团组（需要编辑锁）
router.post('/batch-delete', requireEditLock, (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '缺少团组ID列表' });
  }

  const deleteStmt = req.db.prepare('DELETE FROM groups WHERE id = ?');
  const selectStmt = req.db.prepare('SELECT id FROM groups WHERE id = ?');

  const deleteBatch = req.db.transaction((items) => {
    const deletedIds = [];
    const missingIds = [];

    items.forEach((id) => {
      const exists = selectStmt.get(id);
      if (!exists) {
        missingIds.push(id);
        return;
      }
      deleteStmt.run(id);
      deletedIds.push(id);
    });

    return { deletedIds, missingIds };
  });

  try {
    const result = deleteBatch(ids);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('批量删除团组失败:', error);
    res.status(500).json({ error: '批量删除团组失败' });
  }
});

// 更新团组（需要编辑锁）
router.put('/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  const updates = [];
  const values = [];
  const shouldClearSchedules = req.body.status === CANCELLED_STATUS;

  // 构建更新字段
  const allowedFields = [
    'name', 'type', 'student_count', 'teacher_count',
    'start_date', 'end_date', 'duration', 'color', 'contact_person',
    'contact_phone', 'emergency_contact', 'emergency_phone',
    'accommodation', 'tags', 'notes', 'itinerary_plan_id', 'status'
  ];

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (field === 'tags') {
        values.push(serializeTags(req.body[field]));
      } else {
        values.push(req.body[field]);
      }
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  try {
    const updateGroup = req.db.transaction(() => {
      const result = req.db.prepare(`
        UPDATE groups 
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);

      if (result.changes === 0) {
        return { notFound: true };
      }

      if (shouldClearSchedules) {
        req.db.prepare('DELETE FROM schedules WHERE group_id = ?').run(id);
        req.db.prepare('DELETE FROM activities WHERE group_id = ?').run(id);
      }

      const updatedGroup = req.db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
      return { updatedGroup: hydrateGroup(updatedGroup) };
    });

    const result = updateGroup();
    if (result?.notFound) {
      return res.status(404).json({ error: '团组不存在' });
    }

    res.json({ success: true, group: result.updatedGroup });
  } catch (error) {
    console.error('更新团组失败:', error);
    res.status(500).json({ error: '更新团组失败' });
  }
});

// 删除团组（需要编辑锁）
router.delete('/:id', requireEditLock, (req, res) => {
  const { id } = req.params;

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
