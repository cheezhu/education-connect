// 编辑锁中间件
const requireEditLock = (req, res, next) => {
  const lock = req.db.prepare('SELECT * FROM edit_lock WHERE id = 1').get();
  
  // 检查锁是否过期
  const now = new Date();
  if (lock.expires_at && new Date(lock.expires_at) < now) {
    // 自动释放过期的锁
    req.db.prepare(`
      UPDATE edit_lock 
      SET locked_by = NULL, locked_at = NULL, expires_at = NULL 
      WHERE id = 1
    `).run();
    
    return res.status(403).json({
      error: '编辑锁已过期，请重新获取编辑权限'
    });
  }
  
  // 检查用户是否持有锁
  if (!lock.locked_by || lock.locked_by !== req.user) {
    return res.status(403).json({
      error: '需要编辑权限才能进行此操作'
    });
  }
  
  next();
};

module.exports = requireEditLock;