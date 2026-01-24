const express = require('express');
const router = express.Router();
const requireEditLock = require('../middleware/editLock');

const mapPlanRow = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  created_at: row.created_at,
  updated_at: row.updated_at
});

const getPlanItems = (db, planId) => db.prepare(`
  SELECT
    i.id,
    i.plan_id,
    i.location_id,
    i.sort_order,
    l.name as location_name,
    l.address,
    l.capacity,
    l.color as location_color
  FROM itinerary_plan_items i
  JOIN locations l ON l.id = i.location_id
  WHERE i.plan_id = ?
  ORDER BY i.sort_order, i.id
`).all(planId);

// 获取全部行程方案
router.get('/', (req, res) => {
  const plans = req.db.prepare(`
    SELECT id, name, description, created_at, updated_at
    FROM itinerary_plans
    ORDER BY updated_at DESC, id DESC
  `).all();

  const data = plans.map(plan => ({
    ...mapPlanRow(plan),
    items: getPlanItems(req.db, plan.id)
  }));

  res.json(data);
});

// 获取单个行程方案
router.get('/:id', (req, res) => {
  const planId = Number(req.params.id);
  if (!Number.isFinite(planId)) {
    return res.status(400).json({ error: '无效方案ID' });
  }

  const plan = req.db.prepare(`
    SELECT id, name, description, created_at, updated_at
    FROM itinerary_plans
    WHERE id = ?
  `).get(planId);

  if (!plan) {
    return res.status(404).json({ error: '行程方案不存在' });
  }

  res.json({
    ...mapPlanRow(plan),
    items: getPlanItems(req.db, planId)
  });
});

// 创建行程方案（需要编辑锁）
router.post('/', requireEditLock, (req, res) => {
  const { name, description, locationIds } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '方案名称不能为空' });
  }

  const normalizedLocationIds = Array.isArray(locationIds)
    ? locationIds.map(id => Number(id)).filter(id => Number.isFinite(id))
    : [];

  const insertPlan = req.db.prepare(`
    INSERT INTO itinerary_plans (name, description)
    VALUES (?, ?)
  `);
  const insertItem = req.db.prepare(`
    INSERT INTO itinerary_plan_items (plan_id, location_id, sort_order)
    VALUES (?, ?, ?)
  `);

  const result = req.db.transaction(() => {
    const info = insertPlan.run(name.trim(), description || null);
    const planId = info.lastInsertRowid;

    normalizedLocationIds.forEach((locationId, index) => {
      insertItem.run(planId, locationId, index);
    });

    return planId;
  })();

  const plan = req.db.prepare(`
    SELECT id, name, description, created_at, updated_at
    FROM itinerary_plans
    WHERE id = ?
  `).get(result);

  res.json({
    ...mapPlanRow(plan),
    items: getPlanItems(req.db, plan.id)
  });
});

// 更新行程方案（需要编辑锁）
router.put('/:id', requireEditLock, (req, res) => {
  const planId = Number(req.params.id);
  if (!Number.isFinite(planId)) {
    return res.status(400).json({ error: '无效方案ID' });
  }

  const { name, description, locationIds } = req.body;
  const existing = req.db.prepare('SELECT id FROM itinerary_plans WHERE id = ?').get(planId);
  if (!existing) {
    return res.status(404).json({ error: '行程方案不存在' });
  }

  const updates = [];
  const values = [];
  if (name !== undefined) {
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '方案名称不能为空' });
    }
    updates.push('name = ?');
    values.push(name.trim());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description || null);
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(planId);

  const replaceItems = Array.isArray(locationIds)
    ? locationIds.map(id => Number(id)).filter(id => Number.isFinite(id))
    : null;

  const updatePlan = req.db.prepare(`
    UPDATE itinerary_plans
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  const insertItem = req.db.prepare(`
    INSERT INTO itinerary_plan_items (plan_id, location_id, sort_order)
    VALUES (?, ?, ?)
  `);

  req.db.transaction(() => {
    if (updates.length > 1) {
      updatePlan.run(...values);
    }

    if (replaceItems) {
      req.db.prepare('DELETE FROM itinerary_plan_items WHERE plan_id = ?').run(planId);
      replaceItems.forEach((locationId, index) => {
        insertItem.run(planId, locationId, index);
      });
    }
  })();

  const plan = req.db.prepare(`
    SELECT id, name, description, created_at, updated_at
    FROM itinerary_plans
    WHERE id = ?
  `).get(planId);

  res.json({
    ...mapPlanRow(plan),
    items: getPlanItems(req.db, planId)
  });
});

// 删除行程方案（需要编辑锁）
router.delete('/:id', requireEditLock, (req, res) => {
  const planId = Number(req.params.id);
  if (!Number.isFinite(planId)) {
    return res.status(400).json({ error: '无效方案ID' });
  }

  const result = req.db.prepare('DELETE FROM itinerary_plans WHERE id = ?').run(planId);
  res.json({
    success: result.changes > 0,
    message: result.changes > 0 ? '行程方案已删除' : '行程方案不存在'
  });
});

module.exports = router;
