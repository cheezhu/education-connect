const express = require('express');
const router = express.Router();
const requireEditLock = require('../middleware/editLock');

// 获取所有地点
router.get('/', (req, res) => {
  const locations = req.db.prepare(
    'SELECT * FROM locations WHERE is_active = 1 ORDER BY name'
  ).all();
  res.json(locations);
});

// 获取单个地点
router.get('/:id', (req, res) => {
  const location = req.db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  if (!location) {
    return res.status(404).json({ error: '地点不存在' });
  }
  res.json(location);
});

// 创建地点（需要编辑锁）
router.post('/', requireEditLock, (req, res) => {
  const { 
    name, 
    address,
    capacity = 100,
    contactPerson,
    contactPhone,
    blockedWeekdays = '',
    targetGroups = 'all',
    notes
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: '缺少必需字段: name' });
  }

  try {
    const result = req.db.prepare(`
      INSERT INTO locations (
        name, address, capacity, contact_person, 
        contact_phone, blocked_weekdays, target_groups, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, address, capacity, contactPerson,
      contactPhone, blockedWeekdays, targetGroups, notes
    );

    const newLocation = req.db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, location: newLocation });
  } catch (error) {
    console.error('创建地点失败:', error);
    res.status(500).json({ error: '创建地点失败' });
  }
});

// 更新地点（需要编辑锁）
router.put('/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  const updates = [];
  const values = [];

  // 构建更新字段
  const allowedFields = [
    'name', 'address', 'capacity', 'contact_person',
    'contact_phone', 'blocked_weekdays', 'target_groups', 
    'notes', 'is_active'
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

  values.push(id);

  try {
    const result = req.db.prepare(`
      UPDATE locations 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    if (result.changes === 0) {
      return res.status(404).json({ error: '地点不存在' });
    }

    const updatedLocation = req.db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
    res.json({ success: true, location: updatedLocation });
  } catch (error) {
    console.error('更新地点失败:', error);
    res.status(500).json({ error: '更新地点失败' });
  }
});

// 删除地点（软删除，需要编辑锁）
router.delete('/:id', requireEditLock, (req, res) => {
  const { id } = req.params;

  // 检查是否有关联的活动
  const activityCount = req.db.prepare(
    'SELECT COUNT(*) as count FROM activities WHERE location_id = ?'
  ).get(id);

  if (activityCount.count > 0) {
    return res.status(400).json({ 
      error: '无法删除地点，存在关联的活动安排' 
    });
  }

  try {
    // 软删除：将is_active设为0
    const result = req.db.prepare(
      'UPDATE locations SET is_active = 0 WHERE id = ?'
    ).run(id);
    
    res.json({ 
      success: result.changes > 0,
      message: result.changes > 0 ? '地点已禁用' : '地点不存在'
    });
  } catch (error) {
    console.error('删除地点失败:', error);
    res.status(500).json({ error: '删除地点失败' });
  }
});

module.exports = router;