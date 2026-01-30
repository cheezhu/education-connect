const express = require('express');
const bcrypt = require('bcrypt');
const { requireRole, resolveUserRecord } = require('../middleware/permission');

const router = express.Router();

const normalizeRole = (value) => String(value || '').trim().toLowerCase();
const isValidRole = (role) => ['admin', 'editor', 'viewer'].includes(role);

const mapUser = (row) => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name || '',
  role: row.role,
  createdAt: row.created_at,
  lastLogin: row.last_login
});

router.get('/me', (req, res) => {
  const user = resolveUserRecord(req);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json(mapUser(user));
});

router.use(requireRole(['admin']));

router.get('/', (req, res) => {
  const rows = req.db.prepare(`
    SELECT id, username, display_name, role, created_at, last_login
    FROM users
    ORDER BY id DESC
  `).all();
  res.json(rows.map(mapUser));
});

router.post('/', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || req.body?.display_name || '').trim();
  const role = normalizeRole(req.body?.role || 'viewer');

  if (!username || !password) {
    return res.status(400).json({ error: 'username 和 password 为必填项' });
  }
  if (!isValidRole(role)) {
    return res.status(400).json({ error: '无效角色' });
  }

  const exists = req.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) {
    return res.status(409).json({ error: '用户名已存在' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = req.db.prepare(`
    INSERT INTO users (username, password, display_name, role)
    VALUES (?, ?, ?, ?)
  `).run(username, hash, displayName || null, role);

  const created = req.db.prepare(`
    SELECT id, username, display_name, role, created_at, last_login
    FROM users
    WHERE id = ?
  `).get(result.lastInsertRowid);

  res.json(mapUser(created));
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: '无效用户ID' });
  }

  const updates = [];
  const values = [];

  if (req.body.username !== undefined) {
    const username = String(req.body.username || '').trim();
    if (!username) {
      return res.status(400).json({ error: 'username 不能为空' });
    }
    const exists = req.db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
    if (exists) {
      return res.status(409).json({ error: '用户名已存在' });
    }
    updates.push('username = ?');
    values.push(username);
  }

  if (req.body.displayName !== undefined || req.body.display_name !== undefined) {
    const displayName = String(req.body.displayName || req.body.display_name || '').trim();
    updates.push('display_name = ?');
    values.push(displayName || null);
  }

  if (req.body.role !== undefined) {
    const role = normalizeRole(req.body.role);
    if (!isValidRole(role)) {
      return res.status(400).json({ error: '无效角色' });
    }
    updates.push('role = ?');
    values.push(role);
  }

  if (req.body.password !== undefined) {
    const password = String(req.body.password || '');
    if (!password) {
      return res.status(400).json({ error: 'password 不能为空' });
    }
    const hash = bcrypt.hashSync(password, 10);
    updates.push('password = ?');
    values.push(hash);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }

  values.push(id);

  try {
    const result = req.db.prepare(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    if (result.changes === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const updated = req.db.prepare(`
      SELECT id, username, display_name, role, created_at, last_login
      FROM users
      WHERE id = ?
    `).get(id);

    res.json(mapUser(updated));
  } catch (error) {
    console.error('更新用户失败:', error);
    res.status(500).json({ error: '更新用户失败' });
  }
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: '无效用户ID' });
  }

  try {
    const result = req.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

module.exports = router;
