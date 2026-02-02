const express = require('express');
const requireEditLock = require('../middleware/editLock');

const router = express.Router();

const buildUpdate = (payload, allowedFields) => {
  const updates = [];
  const values = [];

  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(payload[field]);
    }
  });

  return { updates, values };
};

// 人员资源
router.get('/resources/people', (req, res) => {
  const rows = req.db.prepare(`
    SELECT * FROM resource_people
    WHERE is_active = 1
      AND name IS NOT NULL
      AND name <> ''
      AND name <> '[object Object]'
    ORDER BY role, name
  `).all();
  res.json(rows);
});

router.post('/resources/people', requireEditLock, (req, res) => {
  const { role, name, phone = '', notes = '' } = req.body;
  if (!role || !name) {
    return res.status(400).json({ error: '缺少必需字段: role, name' });
  }

  try {
    const result = req.db.prepare(`
      INSERT INTO resource_people (role, name, phone, notes)
      VALUES (?, ?, ?, ?)
    `).run(role, name, phone, notes);
    const row = req.db.prepare('SELECT * FROM resource_people WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, person: row });
  } catch (error) {
    console.error('创建人员资源失败:', error);
    res.status(500).json({ error: '创建人员资源失败' });
  }
});

router.put('/resources/people/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  const allowed = ['role', 'name', 'phone', 'notes', 'is_active'];
  const { updates, values } = buildUpdate(req.body, allowed);
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  try {
    const result = req.db.prepare(`
      UPDATE resource_people
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);
    if (result.changes === 0) {
      return res.status(404).json({ error: '人员资源不存在' });
    }
    const row = req.db.prepare('SELECT * FROM resource_people WHERE id = ?').get(id);
    res.json({ success: true, person: row });
  } catch (error) {
    console.error('更新人员资源失败:', error);
    res.status(500).json({ error: '更新人员资源失败' });
  }
});

router.delete('/resources/people/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  try {
    const result = req.db.prepare(`
      UPDATE resource_people
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    res.json({ success: result.changes > 0 });
  } catch (error) {
    console.error('删除人员资源失败:', error);
    res.status(500).json({ error: '删除人员资源失败' });
  }
});

// 住宿资源
router.get('/resources/hotels', (req, res) => {
  const rows = req.db.prepare(`
    SELECT * FROM resource_hotels
    WHERE is_active = 1
      AND name IS NOT NULL
      AND name <> ''
      AND name <> '[object Object]'
    ORDER BY name
  `).all();
  res.json(rows);
});

router.post('/resources/hotels', requireEditLock, (req, res) => {
  const {
    name,
    address = '',
    city = '',
    star = null,
    price = '',
    contact_person = '',
    contact_phone = '',
    notes = ''
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: '缺少必需字段: name' });
  }

  try {
    const result = req.db.prepare(`
      INSERT INTO resource_hotels (
        name, address, city, star, price, contact_person, contact_phone, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, address, city, star, price, contact_person, contact_phone, notes);
    const row = req.db.prepare('SELECT * FROM resource_hotels WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, hotel: row });
  } catch (error) {
    console.error('创建住宿资源失败:', error);
    res.status(500).json({ error: '创建住宿资源失败' });
  }
});

router.put('/resources/hotels/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  const allowed = [
    'name', 'address', 'city', 'star', 'price',
    'contact_person', 'contact_phone', 'notes', 'is_active'
  ];
  const { updates, values } = buildUpdate(req.body, allowed);
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  try {
    const result = req.db.prepare(`
      UPDATE resource_hotels
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);
    if (result.changes === 0) {
      return res.status(404).json({ error: '住宿资源不存在' });
    }
    const row = req.db.prepare('SELECT * FROM resource_hotels WHERE id = ?').get(id);
    res.json({ success: true, hotel: row });
  } catch (error) {
    console.error('更新住宿资源失败:', error);
    res.status(500).json({ error: '更新住宿资源失败' });
  }
});

router.delete('/resources/hotels/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  try {
    const result = req.db.prepare(`
      UPDATE resource_hotels
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    res.json({ success: result.changes > 0 });
  } catch (error) {
    console.error('删除住宿资源失败:', error);
    res.status(500).json({ error: '删除住宿资源失败' });
  }
});

// 车辆资源
router.get('/resources/vehicles', (req, res) => {
  const rows = req.db.prepare(`
    SELECT * FROM resource_vehicles
    WHERE is_active = 1
      AND plate IS NOT NULL
      AND plate <> ''
      AND plate <> '[object Object]'
    ORDER BY plate
  `).all();
  res.json(rows);
});

router.post('/resources/vehicles', requireEditLock, (req, res) => {
  const { plate, brand = '', model = '', seats = null, notes = '' } = req.body;
  if (!plate) {
    return res.status(400).json({ error: '缺少必需字段: plate' });
  }

  try {
    const result = req.db.prepare(`
      INSERT INTO resource_vehicles (plate, brand, model, seats, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(plate, brand, model, seats, notes);
    const row = req.db.prepare('SELECT * FROM resource_vehicles WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, vehicle: row });
  } catch (error) {
    console.error('创建车辆资源失败:', error);
    res.status(500).json({ error: '创建车辆资源失败' });
  }
});

router.put('/resources/vehicles/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  const allowed = ['plate', 'brand', 'model', 'seats', 'notes', 'is_active'];
  const { updates, values } = buildUpdate(req.body, allowed);
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  try {
    const result = req.db.prepare(`
      UPDATE resource_vehicles
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);
    if (result.changes === 0) {
      return res.status(404).json({ error: '车辆资源不存在' });
    }
    const row = req.db.prepare('SELECT * FROM resource_vehicles WHERE id = ?').get(id);
    res.json({ success: true, vehicle: row });
  } catch (error) {
    console.error('更新车辆资源失败:', error);
    res.status(500).json({ error: '更新车辆资源失败' });
  }
});

router.delete('/resources/vehicles/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  try {
    const result = req.db.prepare(`
      UPDATE resource_vehicles
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    res.json({ success: result.changes > 0 });
  } catch (error) {
    console.error('删除车辆资源失败:', error);
    res.status(500).json({ error: '删除车辆资源失败' });
  }
});

module.exports = router;
