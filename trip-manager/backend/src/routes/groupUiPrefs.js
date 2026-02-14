const express = require('express');
const { getConfigRow, upsertConfig } = require('../utils/configStore');

const router = express.Router();

const LOGISTICS_SHEET_COL_WIDTHS_KEY = 'group_management_logistics_sheet_col_widths';
const LOGISTICS_SHEET_WIDTH_DEFAULTS = {
  basic: [170, 180, 210, 250],
  transport: [170, 120, 130, 140, 130, 140, 130, 140],
  meals: [170, 170, 170, 170, 170, 170, 170]
};

const sanitizeWidthArray = (candidate, fallback) => {
  if (!Array.isArray(candidate) || candidate.length !== fallback.length) return null;
  const next = [];
  for (let i = 0; i < fallback.length; i += 1) {
    const raw = Number(candidate[i]);
    if (!Number.isFinite(raw)) return null;
    if (raw < 40 || raw > 2000) return null;
    next.push(Math.round(raw));
  }
  return next;
};

const normalizeLogisticsSheetColWidths = (value, fallback = LOGISTICS_SHEET_WIDTH_DEFAULTS) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const normalized = {};
  const sectionKeys = Object.keys(LOGISTICS_SHEET_WIDTH_DEFAULTS);
  for (const key of sectionKeys) {
    const defaults = LOGISTICS_SHEET_WIDTH_DEFAULTS[key];
    const maybe = Object.prototype.hasOwnProperty.call(value, key) ? value[key] : (fallback?.[key] || defaults);
    const parsed = sanitizeWidthArray(maybe, defaults);
    if (!parsed) return null;
    normalized[key] = parsed;
  }
  return normalized;
};

const resolveLogisticsSheetColWidths = (db) => {
  const row = getConfigRow(db, LOGISTICS_SHEET_COL_WIDTHS_KEY);
  if (!row || typeof row.value !== 'string' || !row.value.trim()) {
    return LOGISTICS_SHEET_WIDTH_DEFAULTS;
  }
  try {
    const parsed = JSON.parse(row.value);
    const normalized = normalizeLogisticsSheetColWidths(parsed, LOGISTICS_SHEET_WIDTH_DEFAULTS);
    return normalized || LOGISTICS_SHEET_WIDTH_DEFAULTS;
  } catch (error) {
    return LOGISTICS_SHEET_WIDTH_DEFAULTS;
  }
};

router.get('/logistics-sheet-col-widths', (req, res) => {
  return res.json({ widths: resolveLogisticsSheetColWidths(req.db) });
});

router.put('/logistics-sheet-col-widths', (req, res) => {
  const normalized = normalizeLogisticsSheetColWidths(req.body?.widths, LOGISTICS_SHEET_WIDTH_DEFAULTS);
  if (!normalized) {
    return res.status(400).json({ error: 'invalid_config' });
  }
  upsertConfig(
    req.db,
    LOGISTICS_SHEET_COL_WIDTHS_KEY,
    JSON.stringify(normalized),
    'Group Management logistics sheet column widths'
  );
  return res.json({ widths: normalized });
});

module.exports = router;
