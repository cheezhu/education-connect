// 编辑锁中间件
const requireEditLock = (req, res, next) => {
  const lock = req.db.prepare('SELECT * FROM edit_lock WHERE id = 1').get();
  
  // 检查锁是否过期
  const now = new Date();
  let lockedBy = lock.locked_by;
  if (lock.expires_at && new Date(lock.expires_at) < now) {
    // 自动释放过期的锁
    req.db.prepare(`
      UPDATE edit_lock 
      SET locked_by = NULL, locked_at = NULL, expires_at = NULL 
      WHERE id = 1
    `).run();
    lockedBy = null;
  }

  // 如果未持有锁，尝试为管理员自动获取
  if (!lockedBy) {
    const user = req.db.prepare('SELECT role FROM users WHERE username = ?').get(req.user);
    if (user && (user.role === 'admin' || user.role === 'editor')) {
      const newExpiry = new Date(Date.now() + 5 * 60 * 1000);
      req.db.prepare(`
        UPDATE edit_lock 
        SET locked_by = ?, locked_at = CURRENT_TIMESTAMP, expires_at = ?
        WHERE id = 1
      `).run(req.user, newExpiry.toISOString());
      return next();
    }

    return res.status(403).json({
      error: '需要编辑权限才能进行此操作'
    });
  }

  // 检查用户是否持有锁
  if (lockedBy !== req.user) {
    return res.status(403).json({
      error: '需要编辑权限才能进行此操作'
    });
  }
  
  next();
};

module.exports = requireEditLock;
