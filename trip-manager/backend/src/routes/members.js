const express = require('express');
const requireEditLock = require('../middleware/editLock');

const router = express.Router();

const mapMemberRow = (row) => ({
  id: row.id,
  groupId: row.group_id,
  name: row.name,
  gender: row.gender,
  age: row.age,
  id_number: row.id_number,
  phone: row.phone,
  parent_phone: row.parent_phone,
  role: row.role,
  room_number: row.room_number,
  special_needs: row.special_needs,
  emergency_contact: row.emergency_contact
});

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeText = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

// 获取团组成员列表
router.get('/groups/:groupId/members', (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) {
    return res.status(400).json({ error: '无效团组ID' });
  }

  const rows = req.db.prepare(`
    SELECT id, group_id, name, gender, age, id_number, phone, parent_phone,
           role, room_number, special_needs, emergency_contact
    FROM group_members
    WHERE group_id = ?
    ORDER BY id DESC
  `).all(groupId);

  res.json(rows.map(mapMemberRow));
});

// 添加团组成员（需要编辑锁）
router.post('/groups/:groupId/members', requireEditLock, (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId)) {
    return res.status(400).json({ error: '无效团组ID' });
  }

  const name = normalizeText(req.body?.name);
  if (!name) {
    return res.status(400).json({ error: '缺少姓名' });
  }

  const payload = {
    group_id: groupId,
    name,
    gender: normalizeText(req.body?.gender),
    age: toNumberOrNull(req.body?.age),
    id_number: normalizeText(req.body?.id_number),
    phone: normalizeText(req.body?.phone),
    parent_phone: normalizeText(req.body?.parent_phone),
    role: normalizeText(req.body?.role),
    room_number: normalizeText(req.body?.room_number),
    special_needs: normalizeText(req.body?.special_needs),
    emergency_contact: normalizeText(req.body?.emergency_contact)
  };

  try {
    const result = req.db.prepare(`
      INSERT INTO group_members (
        group_id, name, gender, age, id_number, phone, parent_phone,
        role, room_number, special_needs, emergency_contact,
        created_at, updated_at
      ) VALUES (
        @group_id, @name, @gender, @age, @id_number, @phone, @parent_phone,
        @role, @room_number, @special_needs, @emergency_contact,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(payload);

    const row = req.db.prepare(`
      SELECT id, group_id, name, gender, age, id_number, phone, parent_phone,
             role, room_number, special_needs, emergency_contact
      FROM group_members
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.json(mapMemberRow(row));
  } catch (error) {
    console.error('创建成员失败:', error);
    res.status(500).json({ error: '创建成员失败' });
  }
});

// 更新团组成员（需要编辑锁）
router.put('/groups/:groupId/members/:memberId', requireEditLock, (req, res) => {
  const groupId = Number(req.params.groupId);
  const memberId = Number(req.params.memberId);
  if (!Number.isFinite(groupId) || !Number.isFinite(memberId)) {
    return res.status(400).json({ error: '无效参数' });
  }

  const existing = req.db.prepare(`
    SELECT id
    FROM group_members
    WHERE id = ? AND group_id = ?
  `).get(memberId, groupId);

  if (!existing) {
    return res.status(404).json({ error: '成员不存在' });
  }

  const updates = [];
  const values = [];
  const allowedFields = [
    'name',
    'gender',
    'age',
    'id_number',
    'phone',
    'parent_phone',
    'role',
    'room_number',
    'special_needs',
    'emergency_contact'
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      let value = req.body[field];
      if (field === 'age') {
        value = toNumberOrNull(value);
      } else {
        value = normalizeText(value);
      }
      updates.push(`${field} = ?`);
      values.push(value);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(memberId, groupId);

  try {
    req.db.prepare(`
      UPDATE group_members
      SET ${updates.join(', ')}
      WHERE id = ? AND group_id = ?
    `).run(...values);

    const row = req.db.prepare(`
      SELECT id, group_id, name, gender, age, id_number, phone, parent_phone,
             role, room_number, special_needs, emergency_contact
      FROM group_members
      WHERE id = ?
    `).get(memberId);

    res.json(mapMemberRow(row));
  } catch (error) {
    console.error('更新成员失败:', error);
    res.status(500).json({ error: '更新成员失败' });
  }
});

// 删除团组成员（需要编辑锁）
router.delete('/groups/:groupId/members/:memberId', requireEditLock, (req, res) => {
  const groupId = Number(req.params.groupId);
  const memberId = Number(req.params.memberId);
  if (!Number.isFinite(groupId) || !Number.isFinite(memberId)) {
    return res.status(400).json({ error: '无效参数' });
  }

  try {
    const result = req.db.prepare(`
      DELETE FROM group_members
      WHERE id = ? AND group_id = ?
    `).run(memberId, groupId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '成员不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('删除成员失败:', error);
    res.status(500).json({ error: '删除成员失败' });
  }
});

module.exports = router;
