const express = require('express');
const { getConfigRow, upsertConfig } = require('../utils/configStore');
const {
  AI_CONFIG_KEYS,
  getAiRules,
  maskApiKey,
  resolveAiSettings
} = require('../utils/aiConfig');

const router = express.Router();

const WEEK_START_KEY = 'itinerary_week_start';
const TIME_SLOTS_KEY = 'itinerary_time_slots';
const DAILY_FOCUS_KEY = 'itinerary_daily_focus';
const GROUP_ROW_ALIGN_KEY = 'itinerary_group_row_align';
const DEFAULT_TIME_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'];

const isValidDate = (value) => {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
};

const normalizeSlots = (slots) => {
  if (!Array.isArray(slots)) return null;
  return DEFAULT_TIME_SLOTS.filter((slot) => slots.includes(slot));
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

router.get('/itinerary-week-start', (req, res) => {
  const row = getConfigRow(req.db, WEEK_START_KEY);
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
  const row = getConfigRow(req.db, TIME_SLOTS_KEY);
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

router.get('/itinerary-daily-focus', (req, res) => {
  const row = getConfigRow(req.db, DAILY_FOCUS_KEY);
  if (!row || typeof row.value !== 'string') {
    return res.json({ enabled: true });
  }
  const normalized = normalizeBoolean(row.value);
  return res.json({ enabled: normalized ?? true });
});

router.put('/itinerary-daily-focus', (req, res) => {
  const normalized = normalizeBoolean(req.body?.enabled);
  if (normalized === null) {
    return res.status(400).json({ error: '无效配置' });
  }

  upsertConfig(req.db, DAILY_FOCUS_KEY, normalized ? 'true' : 'false', '行程设计器每日关注显示');

  res.json({ enabled: normalized });
});

router.get('/itinerary-group-row-align', (req, res) => {
  const row = getConfigRow(req.db, GROUP_ROW_ALIGN_KEY);
  if (!row || typeof row.value !== 'string') {
    return res.json({ enabled: true });
  }
  const normalized = normalizeBoolean(row.value);
  return res.json({ enabled: normalized ?? true });
});

router.put('/itinerary-group-row-align', (req, res) => {
  const normalized = normalizeBoolean(req.body?.enabled);
  if (normalized === null) {
    return res.status(400).json({ error: '无效配置' });
  }

  upsertConfig(req.db, GROUP_ROW_ALIGN_KEY, normalized ? 'true' : 'false', '行程设计器团组行对齐');

  res.json({ enabled: normalized });
});

const buildAllConfig = (db) => {
  const weekRow = getConfigRow(db, WEEK_START_KEY);
  const weekStartDate = weekRow && isValidDate(weekRow.value) ? weekRow.value : null;

  const slotsRow = getConfigRow(db, TIME_SLOTS_KEY);
  let timeSlots = DEFAULT_TIME_SLOTS;
  if (slotsRow && slotsRow.value) {
    try {
      const parsed = JSON.parse(slotsRow.value);
      const normalized = normalizeSlots(parsed);
      if (normalized) {
        timeSlots = normalized;
      }
    } catch (error) {
      timeSlots = DEFAULT_TIME_SLOTS;
    }
  }

  const dailyRow = getConfigRow(db, DAILY_FOCUS_KEY);
  const dailyNormalized = dailyRow ? normalizeBoolean(dailyRow.value) : null;
  const dailyFocus = dailyNormalized ?? true;

  const alignRow = getConfigRow(db, GROUP_ROW_ALIGN_KEY);
  const alignNormalized = alignRow ? normalizeBoolean(alignRow.value) : null;
  const groupRowAlign = alignNormalized ?? true;

  const aiSettings = resolveAiSettings(db);
  const apiKeyMasked = aiSettings.apiKeyPresent ? maskApiKey(aiSettings.apiKey) : null;

  return {
    itinerary: {
      weekStart: weekStartDate,
      timeSlots,
      dailyFocus,
      groupRowAlign
    },
    ai: {
      provider: aiSettings.provider,
      providerSource: aiSettings.providerSource,
      model: aiSettings.model,
      modelSource: aiSettings.modelSource,
      timeoutMs: aiSettings.timeoutMs,
      timeoutSource: aiSettings.timeoutSource,
      apiKeyMasked,
      apiKeySource: aiSettings.apiKeySource,
      apiKeyPresent: aiSettings.apiKeyPresent
    },
    aiRules: getAiRules(db)
  };
};

router.get('/all', (req, res) => {
  res.json(buildAllConfig(req.db));
});

router.put('/all', (req, res) => {
  const payload = req.body || {};
  const itinerary = payload.itinerary || {};
  const ai = payload.ai || {};

  if (Object.prototype.hasOwnProperty.call(itinerary, 'weekStart')) {
    const dateValue = itinerary.weekStart;
    if (!isValidDate(dateValue)) {
      return res.status(400).json({ error: '无效日期' });
    }
    upsertConfig(req.db, WEEK_START_KEY, dateValue, '行程设计器周起始日期');
  }

  if (Object.prototype.hasOwnProperty.call(itinerary, 'timeSlots')) {
    const normalized = normalizeSlots(itinerary.timeSlots);
    if (!normalized) {
      return res.status(400).json({ error: '无效时间段' });
    }
    upsertConfig(req.db, TIME_SLOTS_KEY, JSON.stringify(normalized), '行程设计器显示时间段');
  }

  if (Object.prototype.hasOwnProperty.call(itinerary, 'dailyFocus')) {
    const normalized = normalizeBoolean(itinerary.dailyFocus);
    if (normalized === null) {
      return res.status(400).json({ error: '无效配置' });
    }
    upsertConfig(req.db, DAILY_FOCUS_KEY, normalized ? 'true' : 'false', '行程设计器每日关注显示');
  }

  if (Object.prototype.hasOwnProperty.call(itinerary, 'groupRowAlign')) {
    const normalized = normalizeBoolean(itinerary.groupRowAlign);
    if (normalized === null) {
      return res.status(400).json({ error: '无效配置' });
    }
    upsertConfig(req.db, GROUP_ROW_ALIGN_KEY, normalized ? 'true' : 'false', '行程设计器团组行对齐');
  }

  if (Object.prototype.hasOwnProperty.call(ai, 'provider')) {
    const provider = String(ai.provider || '').trim();
    if (!provider) {
      return res.status(400).json({ error: 'AI_PROVIDER 不能为空' });
    }
    upsertConfig(req.db, AI_CONFIG_KEYS.provider, provider.toLowerCase(), 'AI Provider');
  }

  if (Object.prototype.hasOwnProperty.call(ai, 'model')) {
    const model = String(ai.model || '').trim();
    if (!model) {
      return res.status(400).json({ error: 'AI_MODEL 不能为空' });
    }
    upsertConfig(req.db, AI_CONFIG_KEYS.model, model, 'AI Model');
  }

  if (Object.prototype.hasOwnProperty.call(ai, 'timeoutMs')) {
    const parsed = Number(ai.timeoutMs);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return res.status(400).json({ error: 'AI_TIMEOUT_MS 无效' });
    }
    upsertConfig(req.db, AI_CONFIG_KEYS.timeoutMs, String(Math.floor(parsed)), 'AI Timeout(ms)');
  }

  if (Object.prototype.hasOwnProperty.call(ai, 'apiKey')) {
    const apiKeyValue = String(ai.apiKey || '');
    upsertConfig(req.db, AI_CONFIG_KEYS.apiKey, apiKeyValue, 'AI API Key');
  }

  res.json(buildAllConfig(req.db));
});

module.exports = router;
