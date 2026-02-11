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
  CREATE TABLE IF NOT EXISTS group_logistics_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    city TEXT,
    departure_city TEXT,
    arrival_city TEXT,
    hotel_name TEXT,
    hotel_address TEXT,
    hotel_disabled BOOLEAN DEFAULT 0,
    vehicle_driver TEXT,
    vehicle_plate TEXT,
    vehicle_phone TEXT,
    vehicle_disabled BOOLEAN DEFAULT 0,
    guide_name TEXT,
    guide_phone TEXT,
    guide_disabled BOOLEAN DEFAULT 0,
    security_name TEXT,
    security_phone TEXT,
    security_disabled BOOLEAN DEFAULT 0,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, activity_date)
  );

  CREATE TABLE IF NOT EXISTS group_logistics_meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL REFERENCES group_logistics_days(id) ON DELETE CASCADE,
    meal_type TEXT CHECK(meal_type IN ('breakfast', 'lunch', 'dinner')) NOT NULL,
    place TEXT,
    arrangement TEXT,
    disabled BOOLEAN DEFAULT 0,
    start_time TEXT,
    end_time TEXT,
    detached BOOLEAN DEFAULT 0,
    resource_id TEXT,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(day_id, meal_type)
  );

  CREATE TABLE IF NOT EXISTS group_logistics_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL REFERENCES group_logistics_days(id) ON DELETE CASCADE,
    transfer_type TEXT CHECK(transfer_type IN ('pickup', 'dropoff')) NOT NULL,
    start_time TEXT,
    end_time TEXT,
    location TEXT,
    contact TEXT,
    flight_no TEXT,
    airline TEXT,
    terminal TEXT,
    disabled BOOLEAN DEFAULT 0,
    detached BOOLEAN DEFAULT 0,
    resource_id TEXT,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(day_id, transfer_type)
  );

  CREATE TABLE IF NOT EXISTS group_schedule_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    template_hash TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    duration_minutes INTEGER,
    description TEXT,
    location_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, template_hash)
  );

  CREATE TABLE IF NOT EXISTS resource_people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT CHECK(role IN ('driver', 'guide', 'security')) NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS resource_hotels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    star INTEGER,
    price TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS resource_vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    seats INTEGER,
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_logistics_days_group_date ON group_logistics_days(group_id, activity_date);
  CREATE INDEX IF NOT EXISTS idx_logistics_meals_day_type ON group_logistics_meals(day_id, meal_type);
  CREATE INDEX IF NOT EXISTS idx_logistics_meals_resource ON group_logistics_meals(resource_id);
  CREATE INDEX IF NOT EXISTS idx_logistics_transfers_day_type ON group_logistics_transfers(day_id, transfer_type);
  CREATE INDEX IF NOT EXISTS idx_logistics_transfers_resource ON group_logistics_transfers(resource_id);
  CREATE INDEX IF NOT EXISTS idx_schedule_templates_group_hash ON group_schedule_templates(group_id, template_hash);
  CREATE INDEX IF NOT EXISTS idx_resource_people_role ON resource_people(role);
  CREATE INDEX IF NOT EXISTS idx_resource_people_name ON resource_people(name);
  CREATE INDEX IF NOT EXISTS idx_resource_hotels_city ON resource_hotels(city);
  CREATE INDEX IF NOT EXISTS idx_resource_hotels_name ON resource_hotels(name);
  CREATE INDEX IF NOT EXISTS idx_resource_vehicles_plate ON resource_vehicles(plate);
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
  CREATE TABLE IF NOT EXISTS planning_import_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_token TEXT NOT NULL UNIQUE,
    created_by TEXT,
    selected_group_ids TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    replace_existing INTEGER DEFAULT 0,
    backup_activities TEXT NOT NULL,
    backup_schedules TEXT NOT NULL,
    summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    rolled_back_at DATETIME
  );
  CREATE INDEX IF NOT EXISTS idx_planning_import_snapshots_created_at ON planning_import_snapshots(created_at);
  CREATE INDEX IF NOT EXISTS idx_planning_import_snapshots_token ON planning_import_snapshots(snapshot_token);
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
if (!groupColumns.includes('schedule_revision')) {
  db.exec('ALTER TABLE groups ADD COLUMN schedule_revision INTEGER DEFAULT 0');
  db.exec('UPDATE groups SET schedule_revision = 0 WHERE schedule_revision IS NULL');
}
if (!groupColumns.includes('must_visit_mode')) {
  db.exec('ALTER TABLE groups ADD COLUMN must_visit_mode TEXT');
}
if (!groupColumns.includes('manual_must_visit_location_ids')) {
  db.exec('ALTER TABLE groups ADD COLUMN manual_must_visit_location_ids TEXT');
}
db.exec("UPDATE groups SET must_visit_mode = 'plan' WHERE must_visit_mode IS NULL OR TRIM(must_visit_mode) = ''");
db.exec("UPDATE groups SET must_visit_mode = 'plan' WHERE must_visit_mode NOT IN ('plan', 'manual')");
db.exec("UPDATE groups SET manual_must_visit_location_ids = '[]' WHERE manual_must_visit_location_ids IS NULL OR TRIM(manual_must_visit_location_ids) = ''");

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
if (!locationColumns.includes('cluster_prefer_same_day')) {
  db.exec('ALTER TABLE locations ADD COLUMN cluster_prefer_same_day INTEGER DEFAULT 0');
  db.exec('UPDATE locations SET cluster_prefer_same_day = 0 WHERE cluster_prefer_same_day IS NULL');
}

// Solver preview runs (async job history)
db.exec(`
  CREATE TABLE IF NOT EXISTS solver_preview_runs (
    id TEXT PRIMARY KEY,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    finished_at DATETIME,
    created_by TEXT,
    request_json TEXT NOT NULL,
    input_json TEXT,
    candidates_json TEXT,
    report_json TEXT,
    error TEXT,
    log_tail TEXT
  );
`);

const solverPreviewRunColumns = db.prepare("PRAGMA table_info(solver_preview_runs)").all().map(col => col.name);
if (!solverPreviewRunColumns.includes('status')) {
  db.exec('ALTER TABLE solver_preview_runs ADD COLUMN status TEXT');
}
if (!solverPreviewRunColumns.includes('created_at')) {
  db.exec('ALTER TABLE solver_preview_runs ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
  db.exec('UPDATE solver_preview_runs SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL');
}
if (!solverPreviewRunColumns.includes('started_at')) {
  db.exec('ALTER TABLE solver_preview_runs ADD COLUMN started_at DATETIME');
}
if (!solverPreviewRunColumns.includes('finished_at')) {
  db.exec('ALTER TABLE solver_preview_runs ADD COLUMN finished_at DATETIME');
}
if (!solverPreviewRunColumns.includes('created_by')) {
  db.exec('ALTER TABLE solver_preview_runs ADD COLUMN created_by TEXT');
}
if (!solverPreviewRunColumns.includes('request_json')) {
  // NOTE: For backwards-compatible migrations we avoid NOT NULL here.
  db.exec('ALTER TABLE solver_preview_runs ADD COLUMN request_json TEXT');
  db.exec("UPDATE solver_preview_runs SET request_json = '{}' WHERE request_json IS NULL OR TRIM(request_json) = ''");
}
if (!solverPreviewRunColumns.includes('input_json')) {
  db.exec('ALTER TABLE solver_preview_runs ADD COLUMN input_json TEXT');
}
if (!solverPreviewRunColumns.includes('candidates_json')) {
  db.exec('ALTER TABLE solver_preview_runs ADD COLUMN candidates_json TEXT');
}
if (!solverPreviewRunColumns.includes('report_json')) {
  db.exec('ALTER TABLE solver_preview_runs ADD COLUMN report_json TEXT');
}
if (!solverPreviewRunColumns.includes('error')) {
  db.exec('ALTER TABLE solver_preview_runs ADD COLUMN error TEXT');
}
if (!solverPreviewRunColumns.includes('log_tail')) {
  db.exec('ALTER TABLE solver_preview_runs ADD COLUMN log_tail TEXT');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_solver_preview_runs_created_at ON solver_preview_runs(created_at)');

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

const basicAuthMiddleware = basicAuth({
  authorizer: authenticator,
  authorizeAsync: true,
  challenge: true,
  realm: 'Trip Manager'
});

const configuredAgentToken = typeof process.env.AGENT_TOOL_TOKEN === 'string'
  ? process.env.AGENT_TOOL_TOKEN.trim()
  : '';

app.use((req, res, next) => {
  const headerTokenRaw = req.header('x-agent-token');
  const headerToken = typeof headerTokenRaw === 'string' ? headerTokenRaw.trim() : '';

  if (configuredAgentToken && headerToken && headerToken === configuredAgentToken) {
    req.auth = { user: 'agent' };
    req.user = 'agent';
    req.userRole = 'admin';
    req.isAgent = true;
    return next();
  }

  return basicAuthMiddleware(req, res, next);
});

// 将数据库实例附加到请求对象
app.use((req, res, next) => {
  req.db = db;
  if (!req.user) {
    req.user = req.auth?.user;
  }
  next();
});

// 路由
const readAllRoles = ['admin', 'editor', 'viewer'];
const writeEditorRoles = ['admin', 'editor'];

app.use('/api/lock', requireRole(['admin']), require('./src/routes/lock'));
app.use('/api/activities', requireRole(['admin']), require('./src/routes/activities'));
app.use('/api/planning/solver-runs', requireRole(['admin']), require('./src/routes/solverPreviewRuns'));
app.use('/api/planning', requireRole(['admin']), require('./src/routes/planning'));
app.use('/api/config', requireRole(['admin']), require('./src/routes/systemConfig'));
app.use('/api/agent', requireRole(['admin']), require('./src/routes/agent'));

app.use('/api/users', require('./src/routes/users'));
app.use('/api/statistics', requireAccess({ read: readAllRoles }), require('./src/routes/statistics'));
app.use('/api/groups', requireAccess({ read: readAllRoles, write: writeEditorRoles }), require('./src/routes/groups'));
app.use('/api/locations', requireAccess({ read: readAllRoles, write: writeEditorRoles }), require('./src/routes/locations'));
app.use('/api/itinerary-plans', requireAccess({ read: readAllRoles, write: writeEditorRoles }), require('./src/routes/itineraryPlans'));
app.use('/api', requireAccess({ read: readAllRoles, write: writeEditorRoles }), require('./src/routes/schedules'));
app.use('/api', requireAccess({ read: readAllRoles, write: writeEditorRoles }), require('./src/routes/logistics'));
app.use('/api', requireAccess({ read: readAllRoles, write: writeEditorRoles }), require('./src/routes/resources'));
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
