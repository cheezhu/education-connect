const express = require('express');
const router = express.Router();

const EDIT_ROLES = new Set(['admin', 'editor']);

const getUserRole = (req) => {
  if (!req.user) return null;
  const row = req.db.prepare('SELECT role FROM users WHERE username = ?').get(req.user);
  return row?.role || null;
};

const releaseLock = (db) => {
  db.prepare(`
    UPDATE edit_lock
    SET locked_by = NULL, locked_at = NULL, expires_at = NULL
    WHERE id = 1
  `).run();
};

router.get('/status', (req, res) => {
  const role = getUserRole(req);
  if (!role) {
    return res.status(403).json({ error: '无访问权限' });
  }

  let lock = req.db.prepare('SELECT * FROM edit_lock WHERE id = 1').get();
  const now = Date.now();
  const expiresAt = lock?.expires_at ? Date.parse(lock.expires_at) : NaN;
  const isExpired = Number.isFinite(expiresAt) && expiresAt < now;

  if (isExpired) {
    releaseLock(req.db);
    lock = req.db.prepare('SELECT * FROM edit_lock WHERE id = 1').get();
  }

  const canWrite = EDIT_ROLES.has(role);
  const lockOwner = lock?.locked_by || null;
  const isLocked = Boolean(lockOwner);

  return res.json({
    isLocked,
    lockedBy: lockOwner,
    expiresAt: lock?.expires_at || null,
    canEdit: canWrite && (!isLocked || lockOwner === req.user)
  });
});

router.post('/acquire', (req, res) => {
  const role = getUserRole(req);
  if (role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '只有管理员可以编辑'
    });
  }

  const result = req.db.transaction(() => {
    const lock = req.db.prepare('SELECT * FROM edit_lock WHERE id = 1').get();
    const expiresAt = lock?.expires_at ? Date.parse(lock.expires_at) : NaN;
    const stillLocked = lock?.locked_by && Number.isFinite(expiresAt) && expiresAt > Date.now();

    if (stillLocked) {
      if (lock.locked_by === req.user) {
        const renewedAt = new Date(Date.now() + 5 * 60 * 1000);
        req.db.prepare('UPDATE edit_lock SET expires_at = ? WHERE id = 1').run(renewedAt.toISOString());
        return { success: true, expiresAt: renewedAt.toISOString() };
      }
      return {
        success: false,
        message: `${lock.locked_by} 正在编辑，请稍后再试`
      };
    }

    const nextExpiry = new Date(Date.now() + 5 * 60 * 1000);
    req.db.prepare(`
      UPDATE edit_lock
      SET locked_by = ?, locked_at = CURRENT_TIMESTAMP, expires_at = ?
      WHERE id = 1
    `).run(req.user, nextExpiry.toISOString());

    return { success: true, expiresAt: nextExpiry.toISOString() };
  })();

  return res.json(result);
});

router.post('/release', (req, res) => {
  if (!req.user) {
    return res.status(403).json({ success: false, message: '无访问权限' });
  }

  const result = req.db.prepare(`
    UPDATE edit_lock
    SET locked_by = NULL, locked_at = NULL, expires_at = NULL
    WHERE id = 1 AND locked_by = ?
  `).run(req.user);

  return res.json({
    success: result.changes > 0,
    message: result.changes > 0 ? '已退出编辑模式' : '您未持有编辑锁'
  });
});

router.post('/renew', (req, res) => {
  if (!req.user) {
    return res.status(403).json({ success: false, message: '无访问权限' });
  }

  const lock = req.db.prepare('SELECT * FROM edit_lock WHERE id = 1').get();
  if (!lock || lock.locked_by !== req.user) {
    return res.status(403).json({
      success: false,
      message: '您未持有编辑锁'
    });
  }

  const nextExpiry = new Date(Date.now() + 5 * 60 * 1000);
  req.db.prepare('UPDATE edit_lock SET expires_at = ? WHERE id = 1 AND locked_by = ?')
    .run(nextExpiry.toISOString(), req.user);

  return res.json({ success: true, expiresAt: nextExpiry.toISOString() });
});

module.exports = router;
