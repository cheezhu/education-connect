const LOCK_ID = 1;
const LOCK_TTL_MS = 5 * 60 * 1000;
const EDIT_ROLES = new Set(['admin', 'editor']);
const LOCK_MODE_KEY = 'edit_lock_mode';
const LOCK_MODE_DEFAULT = 'role_only';

const resolveLockMode = (db) => {
  try {
    const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(LOCK_MODE_KEY);
    const mode = String(row?.value || '').trim().toLowerCase();
    if (mode === 'global') return 'global';
  } catch (error) {
    // Fallback to role-only mode.
  }
  return LOCK_MODE_DEFAULT;
};

const requireEditLock = (req, res, next) => {
  const username = req.user || req.auth?.user;
  if (!username) {
    return res.status(401).json({ error: '未登录或登录态失效' });
  }

  const user = req.db.prepare('SELECT role FROM users WHERE username = ?').get(username);
  if (!user || !EDIT_ROLES.has(user.role)) {
    return res.status(403).json({ error: '仅管理员或编辑者可执行保存操作' });
  }

  const lockMode = resolveLockMode(req.db);
  if (lockMode !== 'global') {
    return next();
  }

  let lock = req.db.prepare('SELECT * FROM edit_lock WHERE id = ?').get(LOCK_ID);
  if (!lock) {
    req.db.prepare(`
      INSERT INTO edit_lock (id, locked_by, locked_at, expires_at, auto_release_at)
      VALUES (?, NULL, NULL, NULL, NULL)
    `).run(LOCK_ID);
    lock = req.db.prepare('SELECT * FROM edit_lock WHERE id = ?').get(LOCK_ID);
  }

  const now = Date.now();
  let lockedBy = lock?.locked_by ? String(lock.locked_by).trim() : null;
  const expiresAtMs = lock?.expires_at ? Date.parse(lock.expires_at) : NaN;
  const isExpired = lockedBy && Number.isFinite(expiresAtMs) && expiresAtMs <= now;

  if (isExpired) {
    req.db.prepare(`
      UPDATE edit_lock
      SET locked_by = NULL, locked_at = NULL, expires_at = NULL
      WHERE id = ?
    `).run(LOCK_ID);
    lockedBy = null;
    lock = req.db.prepare('SELECT * FROM edit_lock WHERE id = ?').get(LOCK_ID);
  }

  if (!lockedBy || lockedBy === username) {
    const newExpiry = new Date(now + LOCK_TTL_MS).toISOString();
    if (!lockedBy) {
      req.db.prepare(`
        UPDATE edit_lock
        SET locked_by = ?, locked_at = CURRENT_TIMESTAMP, expires_at = ?
        WHERE id = ?
      `).run(username, newExpiry, LOCK_ID);
    } else {
      req.db.prepare(`
        UPDATE edit_lock
        SET expires_at = ?
        WHERE id = ? AND locked_by = ?
      `).run(newExpiry, LOCK_ID, username);
    }
    return next();
  }

  return res.status(423).json({
    error: `当前编辑锁由 ${lockedBy} 占用，请稍后再试`,
    lockedBy,
    expiresAt: lock?.expires_at || null
  });
};

module.exports = requireEditLock;
