const { createHash } = require('crypto');

const AUTO_SNAPSHOT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const AUTO_RETENTION_LIMIT = 60;

const SNAPSHOT_TABLES = [
  'groups',
  'schedules',
  'activities',
  'group_members',
  'group_logistics_days',
  'group_logistics_meals',
  'group_logistics_transfers',
  'group_schedule_templates'
];

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (text === 'true' || text === '1' || text === 'yes' || text === 'on') return true;
  if (text === 'false' || text === '0' || text === 'no' || text === 'off') return false;
  return fallback;
};

const buildSnapshotToken = () => (
  `gv-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`
);

const hashPayload = (payloadText) => (
  createHash('sha256').update(String(payloadText || '')).digest('hex')
);

const chunk = (list, size) => {
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
};

const getTableColumns = (db, table) => (
  db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name)
);

const getRowsByIds = (db, table, key, ids) => {
  if (!ids.length) return [];
  const chunks = chunk(ids, 500);
  const rows = [];
  chunks.forEach((idsPart) => {
    const placeholders = idsPart.map(() => '?').join(',');
    const result = db.prepare(`
      SELECT * FROM ${table}
      WHERE ${key} IN (${placeholders})
      ORDER BY id ASC
    `).all(...idsPart);
    rows.push(...result);
  });
  return rows;
};

const collectSnapshotPayload = (db) => {
  const groups = db.prepare('SELECT * FROM groups ORDER BY id ASC').all();
  const groupIds = groups.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
  const schedules = getRowsByIds(db, 'schedules', 'group_id', groupIds);
  const activities = getRowsByIds(db, 'activities', 'group_id', groupIds);
  const members = getRowsByIds(db, 'group_members', 'group_id', groupIds);
  const logisticsDays = getRowsByIds(db, 'group_logistics_days', 'group_id', groupIds);
  const templates = getRowsByIds(db, 'group_schedule_templates', 'group_id', groupIds);
  const dayIds = logisticsDays.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
  const logisticsMeals = getRowsByIds(db, 'group_logistics_meals', 'day_id', dayIds);
  const logisticsTransfers = getRowsByIds(db, 'group_logistics_transfers', 'day_id', dayIds);

  return {
    version: 1,
    tables: {
      groups,
      schedules,
      activities,
      group_members: members,
      group_logistics_days: logisticsDays,
      group_logistics_meals: logisticsMeals,
      group_logistics_transfers: logisticsTransfers,
      group_schedule_templates: templates
    }
  };
};

const buildSnapshotSummary = (payload) => ({
  groups: payload?.tables?.groups?.length || 0,
  schedules: payload?.tables?.schedules?.length || 0,
  activities: payload?.tables?.activities?.length || 0,
  members: payload?.tables?.group_members?.length || 0,
  logisticsDays: payload?.tables?.group_logistics_days?.length || 0
});

const insertRows = (db, table, rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const columns = getTableColumns(db, table);
  if (!columns.length) return;
  const placeholders = columns.map(() => '?').join(', ');
  const insertSql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
  `;
  const stmt = db.prepare(insertSql);
  rows.forEach((row) => {
    const values = columns.map((column) => (
      Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null
    ));
    stmt.run(...values);
  });
};

const resetSqliteSequence = (db, table) => {
  const max = db.prepare(`SELECT MAX(id) as maxId FROM ${table}`).get();
  const maxId = Number(max?.maxId);
  if (Number.isFinite(maxId)) {
    db.prepare(`
      INSERT INTO sqlite_sequence (name, seq)
      VALUES (?, ?)
      ON CONFLICT(name) DO UPDATE SET seq = excluded.seq
    `).run(table, maxId);
  } else {
    db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
  }
};

const ensureSnapshotTable = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_version_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_token TEXT NOT NULL UNIQUE,
      snapshot_type TEXT NOT NULL DEFAULT 'auto',
      created_by TEXT,
      scope TEXT NOT NULL DEFAULT 'all_groups',
      group_count INTEGER DEFAULT 0,
      payload_json TEXT NOT NULL,
      payload_hash TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      restored_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_group_version_snapshots_created_at
      ON group_version_snapshots(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_group_version_snapshots_type
      ON group_version_snapshots(snapshot_type, created_at DESC);
  `);

  const columns = db.prepare('PRAGMA table_info(group_version_snapshots)').all().map((row) => row.name);
  if (!columns.includes('payload_hash')) {
    db.exec('ALTER TABLE group_version_snapshots ADD COLUMN payload_hash TEXT');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_group_version_snapshots_hash
      ON group_version_snapshots(payload_hash, created_at DESC);
  `);
};

const pruneAutoSnapshots = (db) => {
  const rows = db.prepare(`
    SELECT id
    FROM group_version_snapshots
    WHERE snapshot_type = 'auto'
    ORDER BY created_at DESC
  `).all();
  if (rows.length <= AUTO_RETENTION_LIMIT) return;
  const toDelete = rows.slice(AUTO_RETENTION_LIMIT).map((row) => row.id);
  if (!toDelete.length) return;
  const placeholders = toDelete.map(() => '?').join(',');
  db.prepare(`
    DELETE FROM group_version_snapshots
    WHERE id IN (${placeholders})
  `).run(...toDelete);
};

const createSnapshot = (db, options = {}) => {
  ensureSnapshotTable(db);
  const snapshotType = String(options.snapshotType || 'manual').trim() || 'manual';
  const createdBy = options.createdBy ? String(options.createdBy) : null;
  const snapshotToken = buildSnapshotToken();
  const payload = collectSnapshotPayload(db);
  const summary = buildSnapshotSummary(payload);
  const summaryText = JSON.stringify(summary);
  const payloadText = JSON.stringify(payload);
  const payloadHash = hashPayload(payloadText);
  const groupCount = summary.groups;
  const skipIfUnchanged = Boolean(options.skipIfUnchanged);

  if (skipIfUnchanged) {
    const last = db.prepare(`
      SELECT snapshot_token, payload_hash
      FROM group_version_snapshots
      ORDER BY created_at DESC
      LIMIT 1
    `).get();
    if (last?.payload_hash && last.payload_hash === payloadHash) {
      return {
        skipped: true,
        reason: 'unchanged',
        snapshotToken: last.snapshot_token,
        snapshotType,
        createdBy,
        groupCount,
        summary
      };
    }
  }

  db.prepare(`
    INSERT INTO group_version_snapshots (
      snapshot_token, snapshot_type, created_by, scope, group_count, payload_json, payload_hash, summary
    ) VALUES (?, ?, ?, 'all_groups', ?, ?, ?, ?)
  `).run(snapshotToken, snapshotType, createdBy, groupCount, payloadText, payloadHash, summaryText);

  if (snapshotType === 'auto') {
    pruneAutoSnapshots(db);
  }

  return {
    skipped: false,
    snapshotToken,
    snapshotType,
    createdBy,
    groupCount,
    summary
  };
};

const listSnapshots = (db, limit = 30) => {
  ensureSnapshotTable(db);
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 30));
  const rows = db.prepare(`
    SELECT id, snapshot_token, snapshot_type, created_by, scope, group_count, summary, created_at, restored_at
    FROM group_version_snapshots
    ORDER BY created_at DESC
    LIMIT ?
  `).all(safeLimit);
  return rows.map((row) => ({
    id: row.id,
    snapshotToken: row.snapshot_token,
    snapshotType: row.snapshot_type,
    createdBy: row.created_by,
    scope: row.scope,
    groupCount: row.group_count,
    summary: (() => {
      try {
        return row.summary ? JSON.parse(row.summary) : null;
      } catch (error) {
        return null;
      }
    })(),
    createdAt: row.created_at,
    restoredAt: row.restored_at
  }));
};

const restoreSnapshot = (db, snapshotToken) => {
  ensureSnapshotTable(db);
  const token = String(snapshotToken || '').trim();
  if (!token) {
    const error = new Error('Missing snapshotToken');
    error.status = 400;
    throw error;
  }

  const row = db.prepare(`
    SELECT id, snapshot_token, payload_json, restored_at
    FROM group_version_snapshots
    WHERE snapshot_token = ?
  `).get(token);

  if (!row) {
    const error = new Error('Snapshot not found');
    error.status = 404;
    throw error;
  }

  let payload;
  try {
    payload = JSON.parse(row.payload_json || '{}');
  } catch (error) {
    const parseError = new Error('Snapshot payload is invalid');
    parseError.status = 400;
    throw parseError;
  }

  const tables = payload?.tables || {};
  const restoreTx = db.transaction(() => {
    db.prepare('DELETE FROM group_logistics_meals').run();
    db.prepare('DELETE FROM group_logistics_transfers').run();
    db.prepare('DELETE FROM group_logistics_days').run();
    db.prepare('DELETE FROM schedules').run();
    db.prepare('DELETE FROM activities').run();
    db.prepare('DELETE FROM group_members').run();
    db.prepare('DELETE FROM group_schedule_templates').run();
    db.prepare('DELETE FROM groups').run();

    insertRows(db, 'groups', tables.groups || []);
    insertRows(db, 'schedules', tables.schedules || []);
    insertRows(db, 'activities', tables.activities || []);
    insertRows(db, 'group_members', tables.group_members || []);
    insertRows(db, 'group_logistics_days', tables.group_logistics_days || []);
    insertRows(db, 'group_logistics_meals', tables.group_logistics_meals || []);
    insertRows(db, 'group_logistics_transfers', tables.group_logistics_transfers || []);
    insertRows(db, 'group_schedule_templates', tables.group_schedule_templates || []);

    SNAPSHOT_TABLES.forEach((table) => resetSqliteSequence(db, table));

    db.prepare(`
      UPDATE group_version_snapshots
      SET restored_at = CURRENT_TIMESTAMP
      WHERE snapshot_token = ?
    `).run(token);
  });

  restoreTx();
  return {
    snapshotToken: token,
    summary: buildSnapshotSummary(payload)
  };
};

const isAutoBackupEnabled = (db) => {
  try {
    const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get('auto_backup');
    return toBoolean(row?.value, true);
  } catch (error) {
    return true;
  }
};

const startAutoSnapshotScheduler = (db) => {
  ensureSnapshotTable(db);
  let running = false;

  const runAuto = () => {
    if (running) return;
    if (!isAutoBackupEnabled(db)) return;
    running = true;
    try {
      const result = createSnapshot(db, {
        snapshotType: 'auto',
        createdBy: 'system',
        skipIfUnchanged: true
      });
      // eslint-disable-next-line no-console
      if (result?.skipped) {
        console.log('[version] auto snapshot skipped (unchanged)');
      } else {
        console.log('[version] auto snapshot created');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[version] auto snapshot failed:', error);
    } finally {
      running = false;
    }
  };

  // Ensure at least one valid baseline after startup.
  runAuto();

  return setInterval(runAuto, AUTO_SNAPSHOT_INTERVAL_MS);
};

module.exports = {
  AUTO_SNAPSHOT_INTERVAL_MS,
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
  startAutoSnapshotScheduler
};
