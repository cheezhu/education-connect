const express = require('express');

const router = express.Router();

const WEEK_START_KEY = 'itinerary_week_start';
const TIME_SLOTS_KEY = 'itinerary_time_slots';
const DEFAULT_TIME_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'];

const isValidDate = (value) => {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
};

const upsertConfig = (db, key, value, description) => {
  const existing = db.prepare('SELECT key FROM system_config WHERE key = ?').get(key);
  if (existing) {
    db.prepare('UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?')
      .run(value, key);
    return;
  }

  db.prepare('INSERT INTO system_config (key, value, description) VALUES (?, ?, ?)')
    .run(key, value, description);
};

const normalizeSlots = (slots) => {
  if (!Array.isArray(slots)) return null;
  return DEFAULT_TIME_SLOTS.filter((slot) => slots.includes(slot));
};

router.get('/itinerary-week-start', (req, res) => {
  const row = req.db.prepare('SELECT value FROM system_config WHERE key = ?').get(WEEK_START_KEY);
  res.json({ date: row ? row.value : null });
});

router.put('/itinerary-week-start', (req, res) => {
  const { date } = req.body || {};
  if (!isValidDate(date)) {
    return res.status(400).json({ error: '无效日期' });
  }

  upsertConfig(req.db, WEEK_START_KEY, date, '行程设计器周起始日期');

  res.json({ date });
});

router.get('/itinerary-time-slots', (req, res) => {
  const row = req.db.prepare('SELECT value FROM system_config WHERE key = ?').get(TIME_SLOTS_KEY);
  if (!row || !row.value) {
    return res.json({ slots: DEFAULT_TIME_SLOTS });
  }

  try {
    const parsed = JSON.parse(row.value);
    const normalized = normalizeSlots(parsed);
    if (!normalized) {
      return res.json({ slots: DEFAULT_TIME_SLOTS });
    }
    return res.json({ slots: normalized });
  } catch (error) {
    return res.json({ slots: DEFAULT_TIME_SLOTS });
  }
});

router.put('/itinerary-time-slots', (req, res) => {
  const normalized = normalizeSlots(req.body?.slots);
  if (!normalized) {
    return res.status(400).json({ error: '无效时间段' });
  }

  upsertConfig(req.db, TIME_SLOTS_KEY, JSON.stringify(normalized), '行程设计器显示时间段');

  res.json({ slots: normalized });
});

module.exports = router;
