const express = require('express');
const cors = require('cors');
const basicAuth = require('express-basic-auth');
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const { requireRole, requireAccess } = require('./src/middleware/permission');

dotenv.config({ path: path.join(__dirname, '.env') });

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

db.exec(`
  CREATE TABLE IF NOT EXISTS itinerary_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS itinerary_plan_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES itinerary_plans(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id),
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_itinerary_plan_items_plan ON itinerary_plan_items(plan_id);
  CREATE INDEX IF NOT EXISTS idx_itinerary_plan_items_location ON itinerary_plan_items(location_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    gender VARCHAR(10),
    age INTEGER,
    id_number VARCHAR(50),
    phone VARCHAR(30),
    parent_phone VARCHAR(30),
    role VARCHAR(20),
    room_number VARCHAR(30),
    special_needs TEXT,
    emergency_contact VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
`);

const activityColumns = db.prepare("PRAGMA table_info(activities)").all().map(col => col.name);
if (!activityColumns.includes('schedule_id')) {
  db.exec('ALTER TABLE activities ADD COLUMN schedule_id INTEGER');
}
if (!activityColumns.includes('is_plan_item')) {
  db.exec('ALTER TABLE activities ADD COLUMN is_plan_item INTEGER DEFAULT 0');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_activities_schedule ON activities(schedule_id)');

const groupColumns = db.prepare("PRAGMA table_info(groups)").all().map(col => col.name);
if (!groupColumns.includes('itinerary_plan_id')) {
  db.exec('ALTER TABLE groups ADD COLUMN itinerary_plan_id INTEGER');
  db.exec('CREATE INDEX IF NOT EXISTS idx_groups_itinerary_plan ON groups(itinerary_plan_id)');
}
if (!groupColumns.includes('status')) {
  db.exec('ALTER TABLE groups ADD COLUMN status VARCHAR(20)');
}
if (!groupColumns.includes('emergency_contact')) {
  db.exec('ALTER TABLE groups ADD COLUMN emergency_contact VARCHAR(100)');
}
if (!groupColumns.includes('emergency_phone')) {
  db.exec('ALTER TABLE groups ADD COLUMN emergency_phone VARCHAR(20)');
}
if (!groupColumns.includes('accommodation')) {
  db.exec('ALTER TABLE groups ADD COLUMN accommodation TEXT');
}
if (!groupColumns.includes('tags')) {
  db.exec('ALTER TABLE groups ADD COLUMN tags TEXT');
  db.exec("UPDATE groups SET tags = '[]' WHERE tags IS NULL");
}

const locationColumns = db.prepare("PRAGMA table_info(locations)").all().map(col => col.name);
if (!locationColumns.includes('open_hours')) {
  db.exec('ALTER TABLE locations ADD COLUMN open_hours TEXT');
}
if (!locationColumns.includes('closed_dates')) {
  db.exec('ALTER TABLE locations ADD COLUMN closed_dates TEXT');
}
if (!locationColumns.includes('color')) {
  db.exec('ALTER TABLE locations ADD COLUMN color TEXT');
  db.exec("UPDATE locations SET color = '#1890ff' WHERE color IS NULL OR color = ''");
}

const ensureUserRoleConstraint = () => {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (row && row.sql && row.sql.includes("'editor'")) {
    return;
  }

  db.exec(`
    BEGIN TRANSACTION;
    CREATE TABLE IF NOT EXISTS users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      display_name VARCHAR(100),
      role VARCHAR(20) CHECK(role IN ('admin', 'editor', 'viewer')) DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );
    INSERT INTO users_new (id, username, password, display_name, role, created_at, last_login)
    SELECT id, username, password, display_name, role, created_at, last_login FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    COMMIT;
  `);

  const maxId = db.prepare('SELECT MAX(id) as maxId FROM users').get();
  if (maxId && Number.isFinite(maxId.maxId)) {
    db.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?')
      .run(maxId.maxId, 'users');
  }
};

ensureUserRoleConstraint();

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
const readAllRoles = ['admin', 'editor', 'viewer'];
const writeEditorRoles = ['admin', 'editor'];

app.use('/api/lock', requireRole(['admin']), require('./src/routes/lock'));
app.use('/api/activities', requireRole(['admin']), require('./src/routes/activities'));
app.use('/api/planning', requireRole(['admin']), require('./src/routes/planning'));
app.use('/api/config', requireRole(['admin']), require('./src/routes/systemConfig'));

app.use('/api/users', require('./src/routes/users'));
app.use('/api/statistics', requireAccess({ read: readAllRoles }), require('./src/routes/statistics'));
app.use('/api/groups', requireAccess({ read: readAllRoles, write: writeEditorRoles }), require('./src/routes/groups'));
app.use('/api/locations', requireAccess({ read: readAllRoles, write: writeEditorRoles }), require('./src/routes/locations'));
app.use('/api/itinerary-plans', requireAccess({ read: readAllRoles, write: writeEditorRoles }), require('./src/routes/itineraryPlans'));
app.use('/api', requireAccess({ read: readAllRoles, write: writeEditorRoles }), require('./src/routes/schedules'));
app.use('/api', requireAccess({ read: readAllRoles, write: writeEditorRoles }), require('./src/routes/members'));

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
