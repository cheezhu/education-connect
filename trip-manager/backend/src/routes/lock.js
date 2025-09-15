const express = require('express');
const router = express.Router();

// 获取锁状态
router.get('/status', (req, res) => {
  const lock = req.db.prepare('SELECT * FROM edit_lock WHERE id = 1').get();
  
  const now = new Date();
  const isExpired = lock.expires_at && new Date(lock.expires_at) < now;
  
  if (isExpired) {
    // 自动释放过期的锁
    req.db.prepare(`
      UPDATE edit_lock 
      SET locked_by = NULL, locked_at = NULL, expires_at = NULL 
      WHERE id = 1
    `).run();
    
    return res.json({
      isLocked: false,
      canEdit: req.auth.user === 'admin'
    });
  }
  
  res.json({
    isLocked: !!lock.locked_by,
    lockedBy: lock.locked_by,
    expiresAt: lock.expires_at,
    canEdit: lock.locked_by === req.user || !lock.locked_by
  });
});

// 获取编辑锁
router.post('/acquire', (req, res) => {
  // 只有admin可以获取编辑锁
  const user = req.db.prepare('SELECT role FROM users WHERE username = ?')
    .get(req.user);
    
  if (user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: '只有管理员可以编辑' 
    });
  }
  
  const result = req.db.transaction(() => {
    const lock = req.db.prepare('SELECT * FROM edit_lock WHERE id = 1').get();
    
    // 检查锁是否被占用
    if (lock.locked_by && new Date(lock.expires_at) > new Date()) {
      if (lock.locked_by === req.user) {
        // 自己持有锁，续期
        const newExpiry = new Date(Date.now() + 5 * 60 * 1000);
        req.db.prepare(`
          UPDATE edit_lock SET expires_at = ? WHERE id = 1
        `).run(newExpiry.toISOString());
        
        return { success: true, expiresAt: newExpiry };
      }
      
      return { 
        success: false, 
        message: `${lock.locked_by} 正在编辑，请稍后再试` 
      };
    }
    
    // 获取锁
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    req.db.prepare(`
      UPDATE edit_lock 
      SET locked_by = ?, locked_at = CURRENT_TIMESTAMP, expires_at = ?
      WHERE id = 1
    `).run(req.user, expiresAt.toISOString());
    
    return { success: true, expiresAt };
  })();
  
  res.json(result);
});

// 释放锁
router.post('/release', (req, res) => {
  const result = req.db.prepare(`
    UPDATE edit_lock 
    SET locked_by = NULL, locked_at = NULL, expires_at = NULL
    WHERE id = 1 AND locked_by = ?
  `).run(req.user);
  
  res.json({ 
    success: result.changes > 0,
    message: result.changes > 0 ? '已退出编辑模式' : '您未持有编辑锁'
  });
});

// 续期
router.post('/renew', (req, res) => {
  const lock = req.db.prepare('SELECT * FROM edit_lock WHERE id = 1').get();
  
  if (lock.locked_by !== req.user) {
    return res.status(403).json({ 
      success: false, 
      message: '您未持有编辑锁' 
    });
  }
  
  const newExpiry = new Date(Date.now() + 5 * 60 * 1000);
  req.db.prepare(`
    UPDATE edit_lock SET expires_at = ? WHERE id = 1 AND locked_by = ?
  `).run(newExpiry.toISOString(), req.user);
  
  res.json({ success: true, expiresAt: newExpiry });
});

module.exports = router;