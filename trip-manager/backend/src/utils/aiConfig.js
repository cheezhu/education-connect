const { getConfigRow, upsertConfig } = require('./configStore');

const DEFAULT_TIME_SLOTS = {
  MORNING: { start: 9, end: 12 },
  AFTERNOON: { start: 14, end: 17 },
  EVENING: { start: 19, end: 21 }
};

const DEFAULT_AI_RULES = {
  timeSlots: ['MORNING', 'AFTERNOON'],
  slotWindows: DEFAULT_TIME_SLOTS,
  requireAllPlanItems: false,
  maxItemsPerGroup: 8
};

const AI_RULES_KEY = 'ai_schedule_rules';
const AI_CONFIG_KEYS = {
  apiKey: 'ai_api_key',
  provider: 'ai_provider',
  model: 'ai_model',
  timeoutMs: 'ai_timeout_ms'
};

const normalizeAiRules = (input = {}) => {
  const timeSlots = Array.isArray(input.timeSlots)
    ? input.timeSlots.filter(slot => DEFAULT_TIME_SLOTS[slot])
    : [];
  const normalizedSlots = timeSlots.length > 0
    ? timeSlots
    : DEFAULT_AI_RULES.timeSlots;

  const inputWindows = input.slotWindows && typeof input.slotWindows === 'object'
    ? input.slotWindows
    : {};
  const normalizedWindows = {};

  Object.entries(DEFAULT_TIME_SLOTS).forEach(([key, window]) => {
    const candidate = inputWindows[key] || {};
    const start = Number(candidate.start);
    const end = Number(candidate.end);
    normalizedWindows[key] = {
      start: Number.isFinite(start) ? start : window.start,
      end: Number.isFinite(end) ? end : window.end
    };
  });

  const maxItems = Number(input.maxItemsPerGroup);
  const normalizedMaxItems = Number.isFinite(maxItems) && maxItems > 0
    ? Math.floor(maxItems)
    : DEFAULT_AI_RULES.maxItemsPerGroup;

  return {
    timeSlots: normalizedSlots,
    slotWindows: normalizedWindows,
    requireAllPlanItems: input.requireAllPlanItems !== undefined
      ? Boolean(input.requireAllPlanItems)
      : DEFAULT_AI_RULES.requireAllPlanItems,
    maxItemsPerGroup: normalizedMaxItems
  };
};

const getAiRules = (db) => {
  const row = getConfigRow(db, AI_RULES_KEY);
  if (!row || !row.value) return DEFAULT_AI_RULES;
  try {
    const parsed = JSON.parse(row.value);
    return normalizeAiRules(parsed);
  } catch (error) {
    return DEFAULT_AI_RULES;
  }
};

const saveAiRules = (db, rules) => {
  const normalized = normalizeAiRules(rules);
  const value = JSON.stringify(normalized);
  upsertConfig(db, AI_RULES_KEY, value, 'AI schedule rules');
  return normalized;
};

const resolveAiSettings = (db) => {
  const apiKeyRow = getConfigRow(db, AI_CONFIG_KEYS.apiKey);
  const providerRow = getConfigRow(db, AI_CONFIG_KEYS.provider);
  const modelRow = getConfigRow(db, AI_CONFIG_KEYS.model);
  const timeoutRow = getConfigRow(db, AI_CONFIG_KEYS.timeoutMs);

  const envProvider = process.env.AI_PROVIDER;
  const envModel = process.env.AI_MODEL;
  const envApiKey = process.env.AI_api_key;
  const envTimeout = process.env.AI_TIMEOUT_MS;

  const providerValue = providerRow && providerRow.value
    ? String(providerRow.value)
    : (envProvider || 'openai');
  const provider = providerValue.toLowerCase();
  const providerSource = providerRow ? 'system' : (envProvider ? 'env' : 'default');

  const defaultModel = provider === 'gemini' ? 'gemini-1.5-pro-latest' : 'gpt-4.1';
  const model = modelRow && modelRow.value
    ? String(modelRow.value)
    : (envModel || defaultModel);
  const modelSource = modelRow ? 'system' : (envModel ? 'env' : 'default');

  const rawTimeout = timeoutRow && timeoutRow.value !== null && timeoutRow.value !== undefined
    ? timeoutRow.value
    : envTimeout;
  const parsedTimeout = Number(rawTimeout);
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? Math.floor(parsedTimeout)
    : 25000;
  const timeoutSource = timeoutRow ? 'system' : (envTimeout ? 'env' : 'default');

  const apiKey = apiKeyRow ? (apiKeyRow.value || '') : (envApiKey || '');
  const apiKeySource = apiKeyRow ? 'system' : (envApiKey ? 'env' : 'default');
  const apiKeyPresent = typeof apiKey === 'string' && apiKey.trim().length > 0;

  return {
    provider,
    providerSource,
    model,
    modelSource,
    timeoutMs,
    timeoutSource,
    apiKey,
    apiKeySource,
    apiKeyPresent
  };
};

const maskApiKey = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}****`;
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
};

module.exports = {
  DEFAULT_TIME_SLOTS,
  DEFAULT_AI_RULES,
  AI_RULES_KEY,
  AI_CONFIG_KEYS,
  normalizeAiRules,
  getAiRules,
  saveAiRules,
  resolveAiSettings,
  maskApiKey
};
