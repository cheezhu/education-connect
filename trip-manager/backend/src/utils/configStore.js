const getConfigRow = (db, key) => (
  db.prepare('SELECT key, value FROM system_config WHERE key = ?').get(key)
);

const upsertConfig = (db, key, value, description) => {
  const existing = getConfigRow(db, key);
  if (existing) {
    db.prepare('UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
      .run(value, key);
    return;
  }

  db.prepare('INSERT INTO system_config (key, value, description) VALUES (?, ?, ?)')
    .run(key, value, description);
};

const deleteConfig = (db, key) => {
  db.prepare('DELETE FROM system_config WHERE key = ?').run(key);
};

module.exports = {
  getConfigRow,
  upsertConfig,
  deleteConfig
};
