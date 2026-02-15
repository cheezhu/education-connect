const express = require('express');
const router = express.Router();
const requireEditLock = require('../middleware/editLock');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const readBodyValue = (body, ...keys) => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      return body[key];
    }
  }
  return undefined;
};

const normalizeOpenHours = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'string') {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('open_hours must be a JSON object');
    }
    return JSON.stringify(parsed);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('open_hours must be an object');
  }
  return JSON.stringify(value);
};

const normalizeClosedDates = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) {
    throw new Error('closed_dates must be a JSON array');
  }
  const normalized = parsed.map((item) => String(item || '').trim()).filter(Boolean);
  const invalid = normalized.find((item) => !DATE_RE.test(item));
  if (invalid) {
    throw new Error(`closed_dates contains invalid date: ${invalid}`);
  }
  return JSON.stringify(normalized);
};

router.get('/', (req, res) => {
  const locations = req.db.prepare(
    'SELECT * FROM locations WHERE is_active = 1 ORDER BY name'
  ).all();
  res.json(locations);
});

router.get('/:id', (req, res) => {
  const location = req.db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  if (!location) {
    return res.status(404).json({ error: '地点不存在' });
  }
  return res.json(location);
});

router.post('/', requireEditLock, (req, res) => {
  const body = req.body || {};
  const name = String(readBodyValue(body, 'name') || '').trim();
  const address = readBodyValue(body, 'address') || null;
  const capacity = Number(readBodyValue(body, 'capacity') ?? 100);
  const clusterPreferSameDay = readBodyValue(body, 'cluster_prefer_same_day', 'clusterPreferSameDay') ? 1 : 0;
  const color = readBodyValue(body, 'color') || '#1890ff';
  const contactPerson = readBodyValue(body, 'contact_person', 'contactPerson') || null;
  const contactPhone = readBodyValue(body, 'contact_phone', 'contactPhone') || null;
  const blockedWeekdays = readBodyValue(body, 'blocked_weekdays', 'blockedWeekdays') || '';
  const targetGroups = readBodyValue(body, 'target_groups', 'targetGroups') || 'all';
  const notes = readBodyValue(body, 'notes') || null;

  if (!name) {
    return res.status(400).json({ error: '缺少必需字段: name' });
  }
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return res.status(400).json({ error: 'capacity 必须为正数' });
  }

  let openHours = null;
  let closedDates = null;
  try {
    openHours = normalizeOpenHours(readBodyValue(body, 'open_hours', 'openHours')) ?? null;
    closedDates = normalizeClosedDates(readBodyValue(body, 'closed_dates', 'closedDates')) ?? null;
  } catch (error) {
    return res.status(400).json({ error: `配置格式错误: ${error.message}` });
  }

  try {
    const result = req.db.prepare(`
      INSERT INTO locations (
        name, address, capacity, cluster_prefer_same_day, color, contact_person,
        contact_phone, blocked_weekdays, open_hours, closed_dates, target_groups, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      address,
      Math.floor(capacity),
      clusterPreferSameDay,
      color,
      contactPerson,
      contactPhone,
      blockedWeekdays,
      openHours,
      closedDates,
      targetGroups,
      notes
    );

    const newLocation = req.db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid);
    return res.json({ success: true, location: newLocation });
  } catch (error) {
    console.error('创建地点失败:', error);
    return res.status(500).json({ error: '创建地点失败' });
  }
});

router.put('/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const updates = [];
  const values = [];

  const updateMap = {
    name: readBodyValue(body, 'name'),
    address: readBodyValue(body, 'address'),
    capacity: readBodyValue(body, 'capacity'),
    color: readBodyValue(body, 'color'),
    contact_person: readBodyValue(body, 'contact_person', 'contactPerson'),
    contact_phone: readBodyValue(body, 'contact_phone', 'contactPhone'),
    blocked_weekdays: readBodyValue(body, 'blocked_weekdays', 'blockedWeekdays'),
    target_groups: readBodyValue(body, 'target_groups', 'targetGroups'),
    notes: readBodyValue(body, 'notes'),
    is_active: readBodyValue(body, 'is_active', 'isActive'),
    cluster_prefer_same_day: readBodyValue(body, 'cluster_prefer_same_day', 'clusterPreferSameDay')
  };

  try {
    const openHours = normalizeOpenHours(readBodyValue(body, 'open_hours', 'openHours'));
    if (openHours !== undefined) {
      updateMap.open_hours = openHours;
    }
    const closedDates = normalizeClosedDates(readBodyValue(body, 'closed_dates', 'closedDates'));
    if (closedDates !== undefined) {
      updateMap.closed_dates = closedDates;
    }
  } catch (error) {
    return res.status(400).json({ error: `配置格式错误: ${error.message}` });
  }

  for (const [field, rawValue] of Object.entries(updateMap)) {
    if (rawValue === undefined) continue;
    if (field === 'capacity') {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ error: 'capacity 必须为正数' });
      }
      updates.push(`${field} = ?`);
      values.push(Math.floor(parsed));
      continue;
    }
    if (field === 'cluster_prefer_same_day' || field === 'is_active') {
      updates.push(`${field} = ?`);
      values.push(rawValue ? 1 : 0);
      continue;
    }
    updates.push(`${field} = ?`);
    values.push(rawValue);
  }

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
    return res.json({ success: true, location: updatedLocation });
  } catch (error) {
    console.error('更新地点失败:', error);
    return res.status(500).json({ error: '更新地点失败' });
  }
});

router.delete('/:id', requireEditLock, (req, res) => {
  const { id } = req.params;
  const activityCount = req.db.prepare(
    'SELECT COUNT(*) as count FROM activities WHERE location_id = ?'
  ).get(id);

  if (activityCount.count > 0) {
    return res.status(400).json({
      error: '无法删除地点，存在关联的活动安排'
    });
  }

  try {
    const result = req.db.prepare(
      'UPDATE locations SET is_active = 0 WHERE id = ?'
    ).run(id);

    return res.json({
      success: result.changes > 0,
      message: result.changes > 0 ? '地点已禁用' : '地点不存在'
    });
  } catch (error) {
    console.error('删除地点失败:', error);
    return res.status(500).json({ error: '删除地点失败' });
  }
});

module.exports = router;
