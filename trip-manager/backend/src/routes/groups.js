const express = require('express');
const router = express.Router();
const requireEditLock = require('../middleware/editLock');
const { bumpScheduleRevision } = require('../utils/scheduleRevision');
const {
  CANCELLED_STATUS,
  assignGroupCodeById,
  hydrateGroup,
  normalizeGroupPayload,
  isValidGroupType,
  buildGroupUpdateMutation
} = require('../services/groups/groupHelpers');

router.get('/', (req, res) => {
  const groups = req.db.prepare('SELECT * FROM groups ORDER BY created_at DESC').all();
  res.json(groups.map(hydrateGroup));
});

router.get('/:id', (req, res) => {
  const group = req.db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) {
    return res.status(404).json({ error: '\u56e2\u7ec4\u4e0d\u5b58\u5728' });
  }
  res.json(hydrateGroup(group));
});

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
      contact_phone, emergency_contact, emergency_phone, accommodation, tags, notes,
      notes_images, must_visit_mode, manual_must_visit_location_ids
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const selectStmt = req.db.prepare('SELECT * FROM groups WHERE id = ?');

  const createBatch = req.db.transaction((items) => {
    const created = [];

    items.forEach((item, index) => {
      const normalized = normalizeGroupPayload(item);

      if (!normalized.name || !normalized.type || !normalized.startDate || !normalized.endDate) {
        throw new Error(`第 ${index + 1} 行缺少必要字段`);
      }
      if (!isValidGroupType(normalized.type)) {
        throw new Error(`第 ${index + 1} 行团组类型无效（仅支持 primary/secondary/vip）`);
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
        normalized.notes,
        normalized.notesImages,
        normalized.mustVisitMode,
        normalized.manualMustVisitLocationIds
      );

      assignGroupCodeById(req.db, result.lastInsertRowid);
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
  const normalized = normalizeGroupPayload(req.body);

  if (!normalized.name || !normalized.type || !normalized.startDate || !normalized.endDate) {
    return res.status(400).json({
      error: '\u7f3a\u5c11\u5fc5\u9700\u5b57\u6bb5: name, type, start_date, end_date'
    });
  }
  if (!isValidGroupType(normalized.type)) {
    return res.status(400).json({ error: '\u56e2\u7ec4\u7c7b\u578b\u65e0\u6548\uff08\u4ec5\u652f\u6301 primary/secondary/vip\uff09' });
  }

  try {
    const result = req.db.prepare(`
      INSERT INTO groups (
        name, type, student_count, teacher_count,
        start_date, end_date, duration, color, itinerary_plan_id, status, contact_person,
        contact_phone, emergency_contact, emergency_phone, accommodation, tags, notes,
        notes_images, must_visit_mode, manual_must_visit_location_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      normalized.name,
      normalized.type,
      normalized.studentCount,
      normalized.teacherCount,
      normalized.startDate,
      normalized.endDate,
      normalized.duration,
      normalized.color,
      normalized.itineraryPlanId,
      normalized.status,
      normalized.contactPerson,
      normalized.contactPhone,
      normalized.emergencyContact ?? null,
      normalized.emergencyPhone ?? null,
      normalized.accommodation,
      normalized.tags,
      normalized.notes,
      normalized.notesImages,
      normalized.mustVisitMode,
      normalized.manualMustVisitLocationIds
    );

    assignGroupCodeById(req.db, result.lastInsertRowid);
    const newGroup = req.db.prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, group: hydrateGroup(newGroup) });
  } catch (error) {
    console.error('\u521b\u5efa\u56e2\u7ec4\u5931\u8d25:', error);
    res.status(500).json({ error: '\u521b\u5efa\u56e2\u7ec4\u5931\u8d25' });
  }
});

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
        bumpScheduleRevision(req.db, id);
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
  const { normalizedBody, updates, values } = buildGroupUpdateMutation(req.body);
  const shouldClearSchedules = normalizedBody.status === CANCELLED_STATUS;

  if (normalizedBody.type !== undefined && !isValidGroupType(normalizedBody.type)) {
    return res.status(400).json({ error: '\u56e2\u7ec4\u7c7b\u578b\u65e0\u6548\uff08\u4ec5\u652f\u6301 primary/secondary/vip\uff09' });
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '\u6ca1\u6709\u8981\u66f4\u65b0\u7684\u5b57\u6bb5' });
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
        bumpScheduleRevision(req.db, id);
      }

      const updatedGroup = req.db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
      return { updatedGroup: hydrateGroup(updatedGroup) };
    });

    const result = updateGroup();
    if (result?.notFound) {
      return res.status(404).json({ error: '\u56e2\u7ec4\u4e0d\u5b58\u5728' });
    }

    res.json({ success: true, group: result.updatedGroup });
  } catch (error) {
    console.error('\u66f4\u65b0\u56e2\u7ec4\u5931\u8d25:', error);
    res.status(500).json({ error: '\u66f4\u65b0\u56e2\u7ec4\u5931\u8d25' });
  }
});

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
