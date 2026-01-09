const express = require('express');
const cors = require('cors');
const basicAuth = require('express-basic-auth');
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3001;

// 初始化数据库
const db = new Database(path.join(__dirname, 'db/trip.db'));
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(200),
    location VARCHAR(200),
    description TEXT,
    color VARCHAR(20),
    resource_id VARCHAR(100),
    is_from_resource BOOLEAN DEFAULT 0,
    location_id INTEGER REFERENCES locations(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_schedules_group_date ON schedules(group_id, activity_date);
`);

const activityColumns = db.prepare("PRAGMA table_info(activities)").all().map(col => col.name);
if (!activityColumns.includes('schedule_id')) {
  db.exec('ALTER TABLE activities ADD COLUMN schedule_id INTEGER');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_activities_schedule ON activities(schedule_id)');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 基础认证
const authenticator = (username, password, cb) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (user && bcrypt.compareSync(password, user.password)) {
      return cb(null, true);
    }
    return cb(null, false);
  } catch (error) {
    console.error('认证查询失败:', error);
    return cb(null, false);
  }
};

app.use(basicAuth({
  authorizer: authenticator,
  authorizeAsync: true,
  challenge: true,
  realm: 'Trip Manager'
}));

// 将数据库实例附加到请求对象
app.use((req, res, next) => {
  req.db = db;
  req.user = req.auth.user;
  next();
});

// 路由
app.use('/api/lock', require('./src/routes/lock'));
app.use('/api', require('./src/routes/schedules'));
app.use('/api/groups', require('./src/routes/groups'));
app.use('/api/locations', require('./src/routes/locations'));
app.use('/api/activities', require('./src/routes/activities'));
app.use('/api/statistics', require('./src/routes/statistics'));

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: '服务器错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('按 Ctrl+C 停止服务器');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  db.close();
  process.exit(0);
});
