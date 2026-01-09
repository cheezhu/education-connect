const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../db/trip.db');
const sqlPath = path.join(__dirname, '../db/init.sql');

console.log('初始化数据库...');

// 删除现有数据库文件（如果存在）
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('已删除现有数据库文件');
}

// 创建数据库连接
const db = new Database(dbPath);

try {
  // 读取SQL脚本
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // 执行SQL脚本
  db.exec(sql);

  console.log('数据库初始化完成！');
  console.log('默认管理员账号: admin/admin123');

  // 验证数据
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  console.log(`已创建 ${userCount.count} 个用户`);

  const locationCount = db.prepare('SELECT COUNT(*) as count FROM locations').get();
  console.log(`已创建 ${locationCount.count} 个参访地点`);
} catch (error) {
  console.error('数据库初始化失败:', error);
  process.exit(1);
} finally {
  db.close();
}
