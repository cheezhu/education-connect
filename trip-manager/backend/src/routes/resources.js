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
      AND TRIM(name) <> ''
      AND TRIM(name) <> '[object Object]'
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
      AND TRIM(name) <> ''
      AND TRIM(name) <> '[object Object]'
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
      AND TRIM(plate) <> ''
      AND TRIM(plate) <> '[object Object]'
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

// 餐厅资源
router.get('/resources/restaurants', (req, res) => {
  const rows = req.db.prepare(`
    SELECT * FROM resource_restaurants
    WHERE is_active = 1
      AND (
        (name IS NOT NULL AND TRIM(name) <> '' AND TRIM(name) <> '[object Object]')
        OR (address IS NOT NULL AND TRIM(address) <> '' AND TRIM(address) <> '[object Object]')
      )
    ORDER BY name, address
  `).all();
  res.json(rows);
});

router.post('/resources/restaurants', requireEditLock, (req, res) => {
  const { name = '', address = '', city = '', notes = '' } = req.body;
  if (!String(name || '').trim() && !String(address || '').trim()) {
    return res.status(400).json({ error: '缺少必需字段: name 或 address' });
  }

  try {
    const result = req.db.prepare(`
      INSERT INTO resource_restaurants (name, address, city, notes)
      VALUES (?, ?, ?, ?)
    `).run(name, address, city, notes);
    const row = req.db.prepare('SELECT * FROM resource_restaurants WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, restaurant: row });
  } catch (error) {
    console.error('创建餐厅资源失败:', error);
    res.status(500).json({ error: '创建餐厅资源失败' });
  }
});

router.put('/resources/restaurants/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  const allowed = ['name', 'address', 'city', 'notes', 'is_active'];
  const { updates, values } = buildUpdate(req.body, allowed);
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  try {
    const result = req.db.prepare(`
      UPDATE resource_restaurants
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);
    if (result.changes === 0) {
      return res.status(404).json({ error: '餐厅资源不存在' });
    }
    const row = req.db.prepare('SELECT * FROM resource_restaurants WHERE id = ?').get(id);
    res.json({ success: true, restaurant: row });
  } catch (error) {
    console.error('更新餐厅资源失败:', error);
    res.status(500).json({ error: '更新餐厅资源失败' });
  }
});

router.delete('/resources/restaurants/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  try {
    const result = req.db.prepare(`
      UPDATE resource_restaurants
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    res.json({ success: result.changes > 0 });
  } catch (error) {
    console.error('删除餐厅资源失败:', error);
    res.status(500).json({ error: '删除餐厅资源失败' });
  }
});

// 航班/航司资源
router.get('/resources/flights', (req, res) => {
  const rows = req.db.prepare(`
    SELECT * FROM resource_flights
    WHERE is_active = 1
      AND (
        (flight_no IS NOT NULL AND TRIM(flight_no) <> '' AND TRIM(flight_no) <> '[object Object]')
        OR (airline IS NOT NULL AND TRIM(airline) <> '' AND TRIM(airline) <> '[object Object]')
      )
    ORDER BY flight_no, airline
  `).all();
  res.json(rows);
});

router.post('/resources/flights', requireEditLock, (req, res) => {
  const { flight_no = '', airline = '', notes = '' } = req.body;
  if (!String(flight_no || '').trim() && !String(airline || '').trim()) {
    return res.status(400).json({ error: '缺少必需字段: flight_no 或 airline' });
  }

  try {
    const result = req.db.prepare(`
      INSERT INTO resource_flights (flight_no, airline, notes)
      VALUES (?, ?, ?)
    `).run(flight_no, airline, notes);
    const row = req.db.prepare('SELECT * FROM resource_flights WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, flight: row });
  } catch (error) {
    console.error('创建航班资源失败:', error);
    res.status(500).json({ error: '创建航班资源失败' });
  }
});

router.put('/resources/flights/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  const allowed = ['flight_no', 'airline', 'notes', 'is_active'];
  const { updates, values } = buildUpdate(req.body, allowed);
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  try {
    const result = req.db.prepare(`
      UPDATE resource_flights
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);
    if (result.changes === 0) {
      return res.status(404).json({ error: '航班资源不存在' });
    }
    const row = req.db.prepare('SELECT * FROM resource_flights WHERE id = ?').get(id);
    res.json({ success: true, flight: row });
  } catch (error) {
    console.error('更新航班资源失败:', error);
    res.status(500).json({ error: '更新航班资源失败' });
  }
});

router.delete('/resources/flights/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  try {
    const result = req.db.prepare(`
      UPDATE resource_flights
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    res.json({ success: result.changes > 0 });
  } catch (error) {
    console.error('删除航班资源失败:', error);
    res.status(500).json({ error: '删除航班资源失败' });
  }
});

module.exports = router;
