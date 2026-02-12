-- 研学行程管理系统数据库初始化脚本

-- 1. 用户表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role VARCHAR(20) CHECK(role IN ('admin', 'editor', 'viewer')) DEFAULT 'viewer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- 2. 团组表
CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) CHECK(type IN ('primary', 'secondary', 'vip')) NOT NULL,
    student_count INTEGER DEFAULT 40,
    teacher_count INTEGER DEFAULT 4,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration INTEGER CHECK(duration > 0) DEFAULT 5,
    color VARCHAR(7) DEFAULT '#1890ff',
    group_code VARCHAR(32) UNIQUE,
    itinerary_plan_id INTEGER,
    status VARCHAR(20),
    contact_person VARCHAR(100),
    contact_phone VARCHAR(20),
    emergency_contact VARCHAR(100),
    emergency_phone VARCHAR(20),
    accommodation TEXT,
    tags TEXT,
    notes TEXT,
    notes_images TEXT DEFAULT '[]',
    must_visit_mode TEXT DEFAULT 'plan',
    manual_must_visit_location_ids TEXT DEFAULT '[]',
    schedule_revision INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 参访地点表
CREATE TABLE locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    address VARCHAR(500),
    capacity INTEGER DEFAULT 100,
    cluster_prefer_same_day INTEGER DEFAULT 0,
    color VARCHAR(20) DEFAULT '#1890ff',
    contact_person VARCHAR(100),
    contact_phone VARCHAR(20),
    blocked_weekdays VARCHAR(20), -- '3,4' 表示周三周四不可用
    open_hours TEXT, -- JSON: { "default": [{"start":9,"end":17}], "3": [{"start":9,"end":12}] }
    closed_dates TEXT, -- JSON: ["2025-01-01"]
    target_groups VARCHAR(20), -- 'primary' 或 'secondary' 或 'all'
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. 活动安排表
CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER,
    is_plan_item BOOLEAN DEFAULT 0,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id),
    activity_date DATE NOT NULL,
    time_slot VARCHAR(10) CHECK(time_slot IN ('MORNING', 'AFTERNOON', 'EVENING')) NOT NULL,
    participant_count INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4.5 日程详情表（团组日历详情）
CREATE TABLE schedules (
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

-- 4.8 每日卡片主表
CREATE TABLE group_logistics_days (
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

-- 4.9 每日卡片-餐饮
CREATE TABLE group_logistics_meals (
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

-- 4.10 每日卡片-接送站
CREATE TABLE group_logistics_transfers (
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

-- 4.11 自定义资源模板（资源库-其他）
CREATE TABLE group_schedule_templates (
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

-- 4.12 人员资源（司机/导游/安保）
CREATE TABLE resource_people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT CHECK(role IN ('driver', 'guide', 'security')) NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4.13 住宿资源（酒店）
CREATE TABLE resource_hotels (
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

-- 4.14 车辆资源
CREATE TABLE resource_vehicles (
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

-- 4.6 行程方案表
CREATE TABLE itinerary_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE itinerary_plan_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES itinerary_plans(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id),
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- 4.7 团组成员表
CREATE TABLE group_members (
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

-- 4.8 意见反馈主表
CREATE TABLE feedback_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    module_key TEXT NOT NULL DEFAULT 'other',
    status TEXT NOT NULL DEFAULT 'open',
    is_pinned BOOLEAN DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

-- 4.9 意见反馈评论
CREATE TABLE feedback_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by TEXT NOT NULL,
    is_admin_reply BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4.10 意见反馈点赞
CREATE TABLE feedback_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    reaction_type TEXT NOT NULL DEFAULT 'like',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, username, reaction_type)
);

-- 5. 编辑锁表
CREATE TABLE edit_lock (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    locked_by VARCHAR(50),
    locked_at DATETIME,
    expires_at DATETIME,
    auto_release_at DATETIME
);

-- 6. 系统配置表
CREATE TABLE system_config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引优化查询性能
CREATE INDEX idx_activities_date ON activities(activity_date);
CREATE INDEX idx_activities_group ON activities(group_id);
CREATE INDEX idx_activities_location ON activities(location_id);
CREATE INDEX idx_activities_schedule ON activities(schedule_id);
CREATE INDEX idx_schedules_group_date ON schedules(group_id, activity_date);
CREATE INDEX idx_groups_date_range ON groups(start_date, end_date);
CREATE INDEX idx_groups_itinerary_plan ON groups(itinerary_plan_id);
CREATE INDEX idx_itinerary_plan_items_plan ON itinerary_plan_items(plan_id);
CREATE INDEX idx_itinerary_plan_items_location ON itinerary_plan_items(location_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_logistics_days_group_date ON group_logistics_days(group_id, activity_date);
CREATE INDEX idx_logistics_meals_day_type ON group_logistics_meals(day_id, meal_type);
CREATE INDEX idx_logistics_meals_resource ON group_logistics_meals(resource_id);
CREATE INDEX idx_logistics_transfers_day_type ON group_logistics_transfers(day_id, transfer_type);
CREATE INDEX idx_logistics_transfers_resource ON group_logistics_transfers(resource_id);
CREATE INDEX idx_schedule_templates_group_hash ON group_schedule_templates(group_id, template_hash);
CREATE INDEX idx_resource_people_role ON resource_people(role);
CREATE INDEX idx_resource_people_name ON resource_people(name);
CREATE INDEX idx_resource_hotels_city ON resource_hotels(city);
CREATE INDEX idx_resource_hotels_name ON resource_hotels(name);
CREATE INDEX idx_resource_vehicles_plate ON resource_vehicles(plate);
CREATE INDEX idx_feedback_posts_status ON feedback_posts(status);
CREATE INDEX idx_feedback_posts_module ON feedback_posts(module_key);
CREATE INDEX idx_feedback_posts_pinned ON feedback_posts(is_pinned, created_at DESC);
CREATE INDEX idx_feedback_comments_post ON feedback_comments(post_id, created_at);
CREATE INDEX idx_feedback_reactions_post ON feedback_reactions(post_id, reaction_type);

-- 创建视图简化查询
CREATE VIEW calendar_view AS
SELECT 
    a.id,
    a.activity_date,
    a.time_slot,
    a.participant_count,
    g.id as group_id,
    g.name as group_name,
    g.type as group_type,
    g.color as group_color,
    l.id as location_id,
    COALESCE(l.name, '') as location_name,
    COALESCE(l.capacity, 0) as location_capacity
FROM activities a
JOIN groups g ON a.group_id = g.id
LEFT JOIN locations l ON a.location_id = l.id
ORDER BY a.activity_date, a.time_slot;

-- 插入默认用户
INSERT INTO users (username, password, display_name, role) VALUES
('admin', '$2b$10$7RRAOCIs.j63Y7g/i6wnpu6xQeJ1d8qjgISCI1TYkGYf8l2PfbzSq', '系统管理员', 'admin'),
('viewer1', '$2b$10$7RRAOCIs.j63Y7g/i6wnpu6xQeJ1d8qjgISCI1TYkGYf8l2PfbzSq', '查看用户1', 'viewer');

-- 插入默认地点
INSERT INTO locations (name, capacity, blocked_weekdays, target_groups, address) VALUES
('香港科学馆', 200, '4', 'all', '尖沙咀科学馆道2号'),
('香港警队博物馆', 100, '', 'primary', '山顶甘道27号'),
('诺亚方舟', 150, '3', 'all', '新界马湾珀欣路33号'),
('香港海洋公园', 500, '', 'all', '香港仔黄竹坑道180号'),
('西九文化区', 300, '', 'all', '西九龙文化区'),
('香港太空馆', 100, '', 'all', '尖沙咀梳士巴利道10号'),
('香港大学', 150, '', 'all', '薄扶林道'),
('驻港部队展览中心', 100, '', 'secondary', '中环军营');

-- 初始化编辑锁
INSERT INTO edit_lock (id, locked_by, locked_at, expires_at) 
VALUES (1, NULL, NULL, NULL);

-- 系统配置
INSERT INTO system_config (key, value, description) VALUES
('lock_timeout', '300', '编辑锁超时时间（秒）'),
('auto_backup', 'true', '是否自动备份'),
('backup_time', '02:00', '自动备份时间'),
('max_groups', '100', '最大团组数量'),
('itinerary_group_row_align', 'true', '行程设计器团组行对齐');
