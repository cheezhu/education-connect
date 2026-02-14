const express = require('express');
const crypto = require('crypto');

const { timeSlotWindows } = require('../../../shared/domain/time.cjs');
const { bumpScheduleRevision } = require('../utils/scheduleRevision');
const { resolveAiSettings } = require('../utils/aiConfig');

const router = express.Router();

const AGENT_LOCK_USER = 'agent';
const LOCK_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MODE = 'cover';

const CN_NUMBER_MAP = {
  '零': 0,
  '〇': 0,
  '一': 1,
  '二': 2,
  '两': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9
};

const MEAL_PATTERNS = [
  { mealType: 'breakfast', regex: /(早餐|早饭)/g },
  { mealType: 'lunch', regex: /(午餐|午饭|中午吃饭)/g },
  { mealType: 'dinner', regex: /(晚餐|晚饭|晚上吃饭)/g }
];

const TRANSFER_PATTERNS = [
  { transferType: 'pickup', regex: /(接站|接机)/g },
  { transferType: 'dropoff', regex: /(送站|送机)/g }
];

const SLOT_LABEL_TO_KEY = {
  '上午': 'MORNING',
  '早上': 'MORNING',
  '下午': 'AFTERNOON',
  '晚上': 'EVENING',
  '晚间': 'EVENING'
};

const ACTIVITY_REGEX = /(上午|早上|下午|晚上|晚间)\s*(?:去|到)\s*([^，。；;,\n]{1,60}?)(?:参观|访问|活动)/g;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const isValidDateString = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime());
};

const formatIsoDate = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (isoDate, delta) => {
  const base = new Date(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + delta);
  return formatIsoDate(base);
};

const validateDateWithinGroupRange = (group, dateText) => {
  if (!dateText) return null;
  const startDate = normalizeText(group?.start_date);
  const endDate = normalizeText(group?.end_date);
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    return null;
  }

  if (dateText < startDate || dateText > endDate) {
    return {
      status: 400,
      body: {
        error: `日期超出团组范围（${startDate} ~ ${endDate}）`,
        startDate,
        endDate
      }
    };
  }

  return null;
};

const parseChineseNumber = (token) => {
  const text = normalizeText(token);
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);

  if (text.includes('十')) {
    const [left, right] = text.split('十');
    const tens = left ? CN_NUMBER_MAP[left] : 1;
    if (!Number.isFinite(tens)) return null;
    if (!right) return tens * 10;
    const units = CN_NUMBER_MAP[right];
    if (!Number.isFinite(units)) return null;
    return tens * 10 + units;
  }

  if (text.length === 1 && Number.isFinite(CN_NUMBER_MAP[text])) {
    return CN_NUMBER_MAP[text];
  }

  return null;
};

const parseDayIndexFromText = (text) => {
  const matches = [];

  const ordinalRegex = /第\s*([0-9一二两三四五六七八九十〇零]+)\s*[天日]/g;
  let ordinalMatch = null;
  while ((ordinalMatch = ordinalRegex.exec(text)) !== null) {
    const value = parseChineseNumber(ordinalMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      matches.push(value);
    }
  }

  const dayCodeRegex = /\bD\s*([0-9]{1,2})\b/gi;
  let dayCodeMatch = null;
  while ((dayCodeMatch = dayCodeRegex.exec(text)) !== null) {
    const value = Number(dayCodeMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      matches.push(value);
    }
  }

  const uniqueValues = Array.from(new Set(matches));
  if (uniqueValues.length === 1) {
    return { dayIndex: uniqueValues[0], ambiguous: false, candidates: uniqueValues };
  }

  if (uniqueValues.length > 1) {
    return { dayIndex: null, ambiguous: true, candidates: uniqueValues };
  }

  return { dayIndex: null, ambiguous: false, candidates: [] };
};

const findClause = (text, index) => {
  const separators = ['。', '；', ';', '\n', '!', '?'];
  const before = separators
    .map((sep) => text.lastIndexOf(sep, index))
    .reduce((max, value) => (value > max ? value : max), -1);

  const afterCandidates = separators
    .map((sep) => text.indexOf(sep, index))
    .filter((value) => value >= 0);
  const after = afterCandidates.length > 0 ? Math.min(...afterCandidates) : text.length;

  return text.slice(before + 1, after).trim();
};

const inferSlotFromText = (text) => {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  if (normalized.includes('上午') || normalized.includes('早上')) return 'MORNING';
  if (normalized.includes('下午')) return 'AFTERNOON';
  if (normalized.includes('晚上') || normalized.includes('晚间')) return 'EVENING';
  return null;
};

const toTimeText = (hour, minute) => {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm}`;
};

const normalizeHourBySlot = (hour, slot) => {
  if (!Number.isFinite(hour)) return null;
  let adjusted = hour;
  if ((slot === 'AFTERNOON' || slot === 'EVENING') && adjusted >= 1 && adjusted <= 11) {
    adjusted += 12;
  }
  return clamp(adjusted, 0, 23);
};

const parseTimeToken = (token, slot) => {
  const text = normalizeText(token).replace(/：/g, ':');
  if (!text) return null;

  let match = text.match(/^([01]?\d|2[0-3]):([0-5]?\d)$/);
  if (match) {
    return toTimeText(Number(match[1]), Number(match[2]));
  }

  match = text.match(/^([0-2]?\d)点半$/);
  if (match) {
    const hour = normalizeHourBySlot(Number(match[1]), slot);
    return Number.isFinite(hour) ? toTimeText(hour, 30) : null;
  }

  match = text.match(/^([0-2]?\d)点(?:([0-5]?\d)分?)?$/);
  if (match) {
    const hour = normalizeHourBySlot(Number(match[1]), slot);
    const minute = Number(match[2] || 0);
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) {
      return null;
    }
    return toTimeText(hour, minute);
  }

  return null;
};

const parseTimeRange = (text, slot) => {
  const rangePatterns = [
    /([01]?\d|2[0-3])\s*[:：]\s*([0-5]?\d)\s*(?:-|到|至|~)\s*([01]?\d|2[0-3])\s*[:：]\s*([0-5]?\d)/,
    /([0-2]?\d)点(?:([0-5]?\d)分?)?\s*(?:-|到|至|~)\s*([0-2]?\d)点(?:([0-5]?\d)分?)?/
  ];

  for (const pattern of rangePatterns) {
    const match = text.match(pattern);
    if (!match) continue;

    if (pattern === rangePatterns[0]) {
      return {
        startTime: toTimeText(Number(match[1]), Number(match[2])),
        endTime: toTimeText(Number(match[3]), Number(match[4]))
      };
    }

    const startHour = normalizeHourBySlot(Number(match[1]), slot);
    const endHour = normalizeHourBySlot(Number(match[3]), slot);
    const startMinute = Number(match[2] || 0);
    const endMinute = Number(match[4] || 0);
    if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) {
      return null;
    }

    return {
      startTime: toTimeText(startHour, startMinute),
      endTime: toTimeText(endHour, endMinute)
    };
  }

  return null;
};

const parseSingleTime = (text, slot) => {
  const patterns = [
    /([01]?\d|2[0-3])\s*[:：]\s*([0-5]?\d)/,
    /([0-2]?\d)点半/,
    /([0-2]?\d)点(?:([0-5]?\d)分?)?/
  ];

  const first = text.match(patterns[0]);
  if (first) {
    return toTimeText(Number(first[1]), Number(first[2]));
  }

  const half = text.match(patterns[1]);
  if (half) {
    const hour = normalizeHourBySlot(Number(half[1]), slot);
    return Number.isFinite(hour) ? toTimeText(hour, 30) : null;
  }

  const plain = text.match(patterns[2]);
  if (plain) {
    const hour = normalizeHourBySlot(Number(plain[1]), slot);
    const minute = Number(plain[2] || 0);
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) {
      return null;
    }
    return toTimeText(hour, minute);
  }

  return null;
};

const addMinutes = (timeText, minutes) => {
  const match = normalizeText(timeText).match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;

  const baseMinutes = Number(match[1]) * 60 + Number(match[2]) + minutes;
  const safeMinutes = clamp(baseMinutes, 0, 23 * 60 + 59);
  const hh = Math.floor(safeMinutes / 60);
  const mm = safeMinutes % 60;
  return toTimeText(hh, mm);
};

const cleanLocationText = (raw) => {
  const text = normalizeText(raw)
    .replace(/^(一下|一下子|先|再|然后|安排)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
};

const extractLocationFromClause = (clause, keywordRegex) => {
  const afterKeyword = clause.match(new RegExp(`${keywordRegex.source}\\s*(?:在|于|到|去)?\\s*([^，。；;,\\n]{1,50})`));
  if (afterKeyword) {
    return cleanLocationText(afterKeyword[1]);
  }

  const beforeKeyword = clause.match(new RegExp(`(?:在|于|到|去)\\s*([^，。；;,\\n]{1,50})\\s*${keywordRegex.source}`));
  if (beforeKeyword) {
    return cleanLocationText(beforeKeyword[1]);
  }

  const markerMatch = clause.match(/(?:地点|位置|在)\s*[:：]?\s*([^，。；;,\n]{1,50})/);
  if (markerMatch) {
    return cleanLocationText(markerMatch[1]);
  }

  return '';
};

const parseMeals = (text) => {
  const mealMap = new Map();

  MEAL_PATTERNS.forEach(({ mealType, regex }) => {
    const iterator = new RegExp(regex.source, 'g');
    let match = null;
    while ((match = iterator.exec(text)) !== null) {
      const clause = findClause(text, match.index);
      const placeMatch = clause.match(/(?:在|于|到|去)\s*([^，。；;,\n]{1,40})/);
      const place = cleanLocationText(placeMatch ? placeMatch[1] : '');
      const arrangement = normalizeText(
        clause
          .replace(/(早餐|早饭|午餐|午饭|中午吃饭|晚餐|晚饭|晚上吃饭)/g, '')
          .replace(/^(安排|在|于|去|到)\s*/g, '')
      );

      if (!mealMap.has(mealType)) {
        mealMap.set(mealType, { mealType, place: '', arrangement: '' });
      }

      const entry = mealMap.get(mealType);
      if (place && !entry.place) {
        entry.place = place;
      }
      if (arrangement && !entry.arrangement) {
        entry.arrangement = arrangement;
      }
    }
  });

  return Array.from(mealMap.values());
};

const parseTransfers = (text) => {
  const transferMap = new Map();

  TRANSFER_PATTERNS.forEach(({ transferType, regex }) => {
    const iterator = new RegExp(regex.source, 'g');
    let match = null;
    while ((match = iterator.exec(text)) !== null) {
      const clause = findClause(text, match.index);
      const slot = inferSlotFromText(clause);
      const startTime = parseSingleTime(clause, slot);
      const location = extractLocationFromClause(clause, regex);

      if (!transferMap.has(transferType)) {
        transferMap.set(transferType, { transferType, location: '', startTime: '' });
      }
      const entry = transferMap.get(transferType);
      if (location && !entry.location) {
        entry.location = location;
      }
      if (startTime && !entry.startTime) {
        entry.startTime = startTime;
      }
    }
  });

  return Array.from(transferMap.values());
};

const matchLocation = (db, locationText) => {
  const keyword = normalizeText(locationText);
  if (!keyword) return { locationId: null, candidates: [] };

  const rows = db.prepare(`
    SELECT id, name
    FROM locations
    WHERE is_active = 1
      AND (
        name LIKE ?
        OR ? LIKE '%' || name || '%'
      )
    ORDER BY
      CASE
        WHEN name = ? THEN 0
        WHEN name LIKE ? THEN 1
        ELSE 2
      END,
      LENGTH(name) ASC,
      id ASC
    LIMIT 8
  `).all(`%${keyword}%`, keyword, keyword, `${keyword}%`);

  if (rows.length === 1) {
    return { locationId: rows[0].id, candidates: rows };
  }

  return { locationId: null, candidates: rows };
};

const parseActivities = (db, text, date) => {
  const activities = [];
  let match = null;
  while ((match = ACTIVITY_REGEX.exec(text)) !== null) {
    const slot = SLOT_LABEL_TO_KEY[match[1]] || 'MORNING';
    const location = cleanLocationText(match[2]);
    const clause = findClause(text, match.index);

    let startTime = '';
    let endTime = '';
    const range = parseTimeRange(clause, slot);
    if (range && range.startTime && range.endTime) {
      startTime = range.startTime;
      endTime = range.endTime;
    } else {
      const explicit = parseSingleTime(clause, slot);
      if (explicit) {
        startTime = explicit;
        endTime = addMinutes(explicit, 90) || explicit;
      } else {
        const window = timeSlotWindows[slot] || timeSlotWindows.MORNING;
        startTime = window.start;
        endTime = window.end;
      }
    }

    const locationMatch = matchLocation(db, location);
    const title = `${location || '活动'}${clause.includes('参观') ? '参观' : '活动'}`;

    activities.push({
      date,
      slot,
      location,
      title,
      startTime,
      endTime,
      description: clause,
      locationId: locationMatch.locationId,
      locationCandidates: locationMatch.candidates
    });
  }

  return activities;
};

const createStableHash = (value) => (
  crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 16)
);

const resolveGroup = (db, payload) => {
  const rawGroupId = payload.groupId;
  if (rawGroupId !== undefined && rawGroupId !== null && rawGroupId !== '') {
    const groupId = Number(rawGroupId);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      return { error: { status: 400, body: { error: '无效 groupId' } } };
    }

    const group = db.prepare(`
      SELECT id, name, start_date, end_date, duration
      FROM groups
      WHERE id = ?
    `).get(groupId);

    if (!group) {
      return { error: { status: 404, body: { error: '团组不存在' } } };
    }

    return { group, source: 'groupId', candidates: [group] };
  }

  const groupName = normalizeText(payload.groupName);
  if (!groupName) {
    return { error: { status: 400, body: { error: '缺少 groupId 或 groupName' } } };
  }

  const candidates = db.prepare(`
    SELECT id, name, start_date, end_date, duration
    FROM groups
    WHERE name LIKE ?
    ORDER BY
      CASE
        WHEN name = ? THEN 0
        WHEN name LIKE ? THEN 1
        ELSE 2
      END,
      created_at DESC,
      id DESC
    LIMIT 8
  `).all(`%${groupName}%`, groupName, `${groupName}%`);

  if (candidates.length !== 1) {
    return {
      error: {
        status: 409,
        body: {
          error: 'group_not_unique',
          message: '团组匹配结果不唯一，请指定 groupId',
          candidates
        }
      }
    };
  }

  return { group: candidates[0], source: 'groupName', candidates };
};

const resolveDate = (group, payload, text) => {
  const result = {
    date: null,
    dayIndex: null,
    source: null,
    ambiguousDayIndex: false,
    dayIndexCandidates: []
  };

  const inputDate = normalizeText(payload.date);
  if (inputDate) {
    if (!isValidDateString(inputDate)) {
      return {
        error: {
          status: 400,
          body: { error: 'date 格式必须为 YYYY-MM-DD' }
        }
      };
    }

    result.date = inputDate;
    result.source = 'date';
    const rangeError = validateDateWithinGroupRange(group, result.date);
    if (rangeError) {
      return { error: rangeError };
    }
    return { value: result };
  }

  const rawDayIndex = payload.dayIndex;
  if (rawDayIndex !== undefined && rawDayIndex !== null && rawDayIndex !== '') {
    const dayIndex = Number(rawDayIndex);
    if (!Number.isFinite(dayIndex) || dayIndex <= 0) {
      return {
        error: {
          status: 400,
          body: { error: 'dayIndex 必须是正整数' }
        }
      };
    }

    const date = addDays(group.start_date, Math.floor(dayIndex) - 1);
    if (!date) {
      return {
        error: {
          status: 400,
          body: { error: '团组 start_date 无效，无法由 dayIndex 推算日期' }
        }
      };
    }

    result.date = date;
    result.dayIndex = Math.floor(dayIndex);
    result.source = 'dayIndex';
    const rangeError = validateDateWithinGroupRange(group, result.date);
    if (rangeError) {
      return { error: rangeError };
    }
    return { value: result };
  }

  const dayIndexFromText = parseDayIndexFromText(text);
  result.ambiguousDayIndex = dayIndexFromText.ambiguous;
  result.dayIndexCandidates = dayIndexFromText.candidates;

  if (dayIndexFromText.dayIndex) {
    const date = addDays(group.start_date, dayIndexFromText.dayIndex - 1);
    if (date) {
      result.date = date;
      result.dayIndex = dayIndexFromText.dayIndex;
      result.source = 'text';
    }
  }

  if (result.date) {
    const rangeError = validateDateWithinGroupRange(group, result.date);
    if (rangeError) {
      return { error: rangeError };
    }
  }

  return { value: result };
};

const maybeFallbackWithLlm = (db, text) => {
  const aiSettings = resolveAiSettings(db);
  if (!aiSettings.apiKeyPresent) {
    return null;
  }

  if (!normalizeText(text)) {
    return null;
  }

  // TODO(tele-agent-api): When rule parsing cannot extract usable structure,
  // call OpenAI/Gemini here and map the result into meals/transfers/activities.
  return {
    available: true,
    provider: aiSettings.provider,
    model: aiSettings.model,
    attempted: false
  };
};

const computeConfidence = ({
  groupResolved,
  dateResolved,
  parsedMeals,
  parsedTransfers,
  parsedActivities,
  ambiguousActivityCount
}) => {
  const mealCount = parsedMeals.length;
  const transferCount = parsedTransfers.filter((item) => item.location || item.startTime).length;
  const activityCount = parsedActivities.length;
  const hasAnyStructuredData = mealCount + transferCount + activityCount > 0;

  let score = 0;
  if (groupResolved) score += 0.35;
  if (dateResolved) score += 0.3;
  if (hasAnyStructuredData) score += 0.2;
  if (mealCount > 0) score += 0.1;
  if (activityCount > 0) score += 0.05;

  if (ambiguousActivityCount > 0) {
    score -= Math.min(0.15, ambiguousActivityCount * 0.05);
  }

  return Number(clamp(score, 0, 1).toFixed(2));
};

const buildClarificationQuestions = ({
  dateInfo,
  parsedMeals,
  parsedTransfers,
  parsedActivities,
  ambiguousActivities,
  llmFallback
}) => {
  const questions = [];

  if (!dateInfo.date) {
    questions.push('请确认目标日期：可传 date(YYYY-MM-DD) 或 dayIndex（第几天）。');
  }

  if (dateInfo.ambiguousDayIndex) {
    questions.push(`文本中出现多个天数候选：${dateInfo.dayIndexCandidates.join('、')}，请明确具体是第几天。`);
  }

  const transferCount = parsedTransfers.filter((item) => item.location || item.startTime).length;
  if (parsedMeals.length + transferCount + parsedActivities.length === 0) {
    questions.push('未识别到可写入结构（餐饮/接送/活动），请提供更明确文本。');
  }

  if (ambiguousActivities.length > 0) {
    ambiguousActivities.forEach((item) => {
      const candidateNames = item.locationCandidates.map((candidate) => candidate.name).join('、');
      questions.push(`活动地点“${item.location}”匹配到多个地点：${candidateNames}，请指定。`);
    });
  }

  if (llmFallback?.available && !llmFallback.attempted) {
    questions.push('检测到 AI 配置已启用；当前版本尚未启用规则失败后的 LLM 自动补全。');
  }

  return questions;
};

const buildResourceId = (date, category, key) => {
  if (!date) return null;
  if (category === 'meal') {
    return `daily:${date}:meal:${key}`;
  }
  return `daily:${date}:${category}`;
};

const acquireAgentLock = (db, options = {}) => {
  const force = options && options.force === true;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS).toISOString();

  const transaction = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM edit_lock WHERE id = 1').get();
    if (!existing) {
      db.prepare(`
        INSERT INTO edit_lock (id, locked_by, locked_at, expires_at)
        VALUES (1, NULL, NULL, NULL)
      `).run();
    }

    const lock = db.prepare('SELECT * FROM edit_lock WHERE id = 1').get();
    const hasLock = Boolean(lock?.locked_by);
    const isExpired = lock?.expires_at ? (new Date(lock.expires_at) <= now) : false;

    // 默认：如果锁被真人(admin/editor)持有且未过期，agent 写入会被阻断。
    // force=true：允许 OpenClaw agent 请求“抢占”锁（无视当前持有人）。
    if (!force && hasLock && lock.locked_by !== AGENT_LOCK_USER && !isExpired) {
      return {
        ok: false,
        lockedBy: lock.locked_by,
        expiresAt: lock.expires_at || null
      };
    }

    db.prepare(`
      UPDATE edit_lock
      SET locked_by = ?, locked_at = CURRENT_TIMESTAMP, expires_at = ?
      WHERE id = 1
    `).run(AGENT_LOCK_USER, expiresAt);

    return { ok: true, expiresAt };
  });

  return transaction();
};

const releaseAgentLock = (db) => {
  db.prepare(`
    UPDATE edit_lock
    SET locked_by = NULL, locked_at = NULL, expires_at = NULL
    WHERE id = 1 AND locked_by = ?
  `).run(AGENT_LOCK_USER);
};

const normalizePhone = (value) => (
  normalizeText(value).replace(/[\s\-()]/g, '')
);

const isLikelyPhone = (value) => /^\+?\d{6,20}$/.test(normalizePhone(value));

const normalizeGender = (value) => {
  const text = normalizeText(value);
  if (!text) return null;
  const lower = text.toLowerCase();
  if (text === '男' || lower === 'm' || lower === 'male') return '男';
  if (text === '女' || lower === 'f' || lower === 'female') return '女';
  return text;
};

const normalizeAge = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const ageNum = Math.floor(value);
    return ageNum > 0 && ageNum <= 120 ? ageNum : null;
  }

  const match = normalizeText(value).match(/(\d{1,3})/);
  if (!match) return null;
  const ageNum = Number(match[1]);
  if (!Number.isFinite(ageNum)) return null;
  return ageNum > 0 && ageNum <= 120 ? ageNum : null;
};

const normalizeOptionalText = (value) => {
  const text = normalizeText(value);
  return text ? text : null;
};

const normalizeMemberPayload = (member = {}) => {
  const name = normalizeText(member.name);
  if (!name) return null;

  const phoneRaw = member.phone;
  const parentPhoneRaw = member.parent_phone !== undefined
    ? member.parent_phone
    : member.parentPhone;

  const phone = normalizePhone(phoneRaw);
  const parentPhone = normalizePhone(parentPhoneRaw);

  return {
    name,
    gender: normalizeGender(member.gender),
    age: normalizeAge(member.age),
    phone: phone || null,
    parent_phone: parentPhone || null,
    role: normalizeOptionalText(member.role),
    room_number: normalizeOptionalText(member.room_number !== undefined ? member.room_number : member.roomNumber),
    special_needs: normalizeOptionalText(
      member.special_needs !== undefined ? member.special_needs : member.specialNeeds
    ),
    emergency_contact: normalizeOptionalText(
      member.emergency_contact !== undefined ? member.emergency_contact : member.emergencyContact
    )
  };
};

const parseLabeledMemberLine = (line) => {
  const pairs = Array.from(
    line.matchAll(/([A-Za-z\u4e00-\u9fa5_]+)\s*[:：]\s*([^,，;；]+)/g)
  );
  if (pairs.length === 0) return null;

  const draft = {};
  pairs.forEach((match) => {
    const key = normalizeText(match[1]).toLowerCase();
    const value = normalizeText(match[2]);
    if (!value) return;

    if (key.includes('姓名') || key === 'name') {
      draft.name = value;
      return;
    }
    if (key.includes('性别') || key === 'gender') {
      draft.gender = value;
      return;
    }
    if (key.includes('年龄') || key === 'age') {
      draft.age = value;
      return;
    }
    if (key.includes('家长') || key.includes('parent')) {
      draft.parent_phone = value;
      return;
    }
    if (key.includes('手机') || key.includes('电话') || key === 'phone' || key.includes('mobile')) {
      draft.phone = value;
      return;
    }
    if (key.includes('角色') || key === 'role') {
      draft.role = value;
      return;
    }
    if (key.includes('房间') || key.includes('房号') || key.includes('room')) {
      draft.room_number = value;
      return;
    }
    if (key.includes('特殊') || key.includes('need') || key.includes('special')) {
      draft.special_needs = value;
      return;
    }
    if (key.includes('紧急') || key.includes('emergency')) {
      draft.emergency_contact = value;
    }
  });

  return normalizeMemberPayload(draft);
};

const parseMemberLine = (line) => {
  const trimmed = normalizeText(line)
    .replace(/^[\-\*\u2022\d\.\)\(、\s]+/, '')
    .trim();
  if (!trimmed) return null;

  const labeled = parseLabeledMemberLine(trimmed);
  if (labeled) return labeled;

  const parts = trimmed
    .split(/[,\uFF0C、\t ]+/)
    .map((token) => normalizeText(token))
    .filter(Boolean);

  if (parts.length === 0) return null;

  const draft = { name: parts[0] };
  parts.slice(1).forEach((token) => {
    if (!draft.gender) {
      const gender = normalizeGender(token);
      if (gender === '男' || gender === '女') {
        draft.gender = gender;
        return;
      }
    }

    if (draft.age === undefined) {
      const age = normalizeAge(token);
      if (age !== null) {
        draft.age = age;
        return;
      }
    }

    if (isLikelyPhone(token)) {
      if (!draft.phone) {
        draft.phone = token;
      } else if (!draft.parent_phone) {
        draft.parent_phone = token;
      }
    }
  });

  return normalizeMemberPayload(draft);
};

const parseMembersInput = (payload = {}) => {
  if (Array.isArray(payload.members) && payload.members.length > 0) {
    return payload.members
      .map((member) => normalizeMemberPayload(member))
      .filter(Boolean);
  }

  const text = normalizeText(payload.text);
  if (!text) return [];

  return text
    .split(/\r?\n|[;；]+/)
    .map((line) => parseMemberLine(line))
    .filter(Boolean);
};

const upsertGroupMembers = (db, groupId, mode, members) => {
  const selectByPhoneStmt = db.prepare(`
    SELECT id
    FROM group_members
    WHERE group_id = ? AND phone = ?
    ORDER BY id DESC
    LIMIT 1
  `);

  const insertStmt = db.prepare(`
    INSERT INTO group_members (
      group_id, name, gender, age, phone, parent_phone, role,
      room_number, special_needs, emergency_contact, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);

  const updateStmt = db.prepare(`
    UPDATE group_members
    SET
      name = ?,
      gender = COALESCE(?, gender),
      age = COALESCE(?, age),
      phone = ?,
      parent_phone = COALESCE(?, parent_phone),
      role = COALESCE(?, role),
      room_number = COALESCE(?, room_number),
      special_needs = COALESCE(?, special_needs),
      emergency_contact = COALESCE(?, emergency_contact),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const deleteAllStmt = db.prepare('DELETE FROM group_members WHERE group_id = ?');
  const countStmt = db.prepare('SELECT COUNT(1) AS count FROM group_members WHERE group_id = ?');

  const transaction = db.transaction(() => {
    if (mode === 'cover') {
      deleteAllStmt.run(groupId);
    }

    let inserted = 0;
    let updated = 0;

    members.forEach((member) => {
      if (member.phone) {
        const existing = selectByPhoneStmt.get(groupId, member.phone);
        if (existing) {
          updateStmt.run(
            member.name,
            member.gender,
            member.age,
            member.phone,
            member.parent_phone,
            member.role,
            member.room_number,
            member.special_needs,
            member.emergency_contact,
            existing.id
          );
          updated += 1;
          return;
        }
      }

      insertStmt.run(
        groupId,
        member.name,
        member.gender,
        member.age,
        member.phone,
        member.parent_phone,
        member.role,
        member.room_number,
        member.special_needs,
        member.emergency_contact
      );
      inserted += 1;
    });

    const totalRow = countStmt.get(groupId);
    return {
      mode,
      inserted,
      updated,
      total: Number(totalRow?.count || 0)
    };
  });

  return transaction();
};

const applyCoverUpdate = (db, groupId, date, parsed) => {
  const ensureDayStmt = db.prepare(`
    INSERT INTO group_logistics_days (group_id, activity_date, created_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(group_id, activity_date) DO UPDATE SET
      updated_at = CURRENT_TIMESTAMP
  `);

  const selectDayStmt = db.prepare(`
    SELECT id
    FROM group_logistics_days
    WHERE group_id = ? AND activity_date = ?
  `);

  const upsertMealStmt = db.prepare(`
    INSERT INTO group_logistics_meals (
      day_id, meal_type, place, arrangement, resource_id, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT(day_id, meal_type) DO UPDATE SET
      place = CASE
        WHEN excluded.place IS NULL OR TRIM(excluded.place) = '' THEN group_logistics_meals.place
        ELSE excluded.place
      END,
      arrangement = CASE
        WHEN excluded.arrangement IS NULL OR TRIM(excluded.arrangement) = '' THEN group_logistics_meals.arrangement
        ELSE excluded.arrangement
      END,
      resource_id = COALESCE(excluded.resource_id, group_logistics_meals.resource_id),
      updated_at = CURRENT_TIMESTAMP
  `);

  const upsertTransferStmt = db.prepare(`
    INSERT INTO group_logistics_transfers (
      day_id, transfer_type, start_time, location, resource_id, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT(day_id, transfer_type) DO UPDATE SET
      start_time = CASE
        WHEN excluded.start_time IS NULL OR TRIM(excluded.start_time) = '' THEN group_logistics_transfers.start_time
        ELSE excluded.start_time
      END,
      location = CASE
        WHEN excluded.location IS NULL OR TRIM(excluded.location) = '' THEN group_logistics_transfers.location
        ELSE excluded.location
      END,
      resource_id = COALESCE(excluded.resource_id, group_logistics_transfers.resource_id),
      updated_at = CURRENT_TIMESTAMP
  `);

  const deleteCustomSchedulesStmt = db.prepare(`
    DELETE FROM schedules
    WHERE group_id = ?
      AND activity_date = ?
      AND resource_id LIKE 'custom:ai:%'
  `);

  const insertScheduleStmt = db.prepare(`
    INSERT INTO schedules (
      group_id, activity_date, start_time, end_time, type,
      title, location, description, color, resource_id,
      is_from_resource, location_id, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);

  const transaction = db.transaction(() => {
    ensureDayStmt.run(groupId, date);
    const day = selectDayStmt.get(groupId, date);
    if (!day) {
      throw new Error('无法获取 group_logistics_days.day_id');
    }

    let mealsUpdated = 0;
    parsed.meals.forEach((meal) => {
      const hasPayload = normalizeText(meal.place) || normalizeText(meal.arrangement);
      if (!hasPayload) return;
      upsertMealStmt.run(
        day.id,
        meal.mealType,
        normalizeText(meal.place),
        normalizeText(meal.arrangement),
        buildResourceId(date, 'meal', meal.mealType)
      );
      mealsUpdated += 1;
    });

    let transfersUpdated = 0;
    parsed.transfers.forEach((transfer) => {
      const hasPayload = normalizeText(transfer.location) || normalizeText(transfer.startTime);
      if (!hasPayload) return;
      upsertTransferStmt.run(
        day.id,
        transfer.transferType,
        normalizeText(transfer.startTime),
        normalizeText(transfer.location),
        buildResourceId(date, transfer.transferType)
      );
      transfersUpdated += 1;
    });

    deleteCustomSchedulesStmt.run(groupId, date);

    let schedulesReplaced = 0;
    let otherSchedulesReplaced = 0;
    parsed.activities.forEach((activity) => {
      const hash = createStableHash(`${activity.title}|${date}|${activity.startTime}|${activity.endTime}`);
      insertScheduleStmt.run(
        groupId,
        date,
        activity.startTime,
        activity.endTime,
        activity.locationId ? 'visit' : 'other',
        activity.title,
        activity.location,
        activity.description,
        '#7f8c8d',
        `custom:ai:${hash}`,
        activity.locationId ?? null
      );
      schedulesReplaced += 1;
      if (!activity.locationId) {
        otherSchedulesReplaced += 1;
      }
    });

    bumpScheduleRevision(db, groupId);

    return {
      mealsUpdated,
      transfersUpdated,
      schedulesReplaced,
      otherSchedulesReplaced
    };
  });

  return transaction();
};

router.post('/inject-one-shot', (req, res) => {
  const text = normalizeText(req.body?.text);
  const mode = normalizeText(req.body?.mode) || DEFAULT_MODE;

  if (!text) {
    return res.status(400).json({ error: 'text 不能为空' });
  }

  if (mode !== 'cover') {
    return res.status(400).json({ error: '当前仅支持 mode=cover' });
  }

  const groupResult = resolveGroup(req.db, req.body || {});
  if (groupResult.error) {
    return res.status(groupResult.error.status).json(groupResult.error.body);
  }

  const { group } = groupResult;

  const dateResult = resolveDate(group, req.body || {}, text);
  if (dateResult.error) {
    return res.status(dateResult.error.status).json(dateResult.error.body);
  }
  const dateInfo = dateResult.value;

  const meals = parseMeals(text);
  const transfers = parseTransfers(text);
  const activities = dateInfo.date ? parseActivities(req.db, text, dateInfo.date) : [];
  const otherActivities = activities.filter((activity) => !activity.locationId);
  const ambiguousActivities = activities.filter(
    (activity) => !activity.locationId && activity.locationCandidates.length > 1
  );

  const llmFallback = (
    meals.length === 0 &&
    transfers.filter((item) => item.location || item.startTime).length === 0 &&
    activities.length === 0
  )
    ? maybeFallbackWithLlm(req.db, text)
    : null;

  const confidence = computeConfidence({
    groupResolved: Boolean(group?.id),
    dateResolved: Boolean(dateInfo.date),
    parsedMeals: meals,
    parsedTransfers: transfers,
    parsedActivities: activities,
    ambiguousActivityCount: ambiguousActivities.length
  });

  const parsedDraft = {
    groupId: group.id,
    groupName: group.name,
    date: dateInfo.date,
    dayIndex: dateInfo.dayIndex,
    dateSource: dateInfo.source,
    meals,
    transfers,
    activities,
    otherActivities
  };

  if (confidence < 0.75) {
    const questions = buildClarificationQuestions({
      dateInfo,
      parsedMeals: meals,
      parsedTransfers: transfers,
      parsedActivities: activities,
      ambiguousActivities,
      llmFallback
    });

    return res.status(422).json({
      needsClarification: true,
      questions,
      parsed: parsedDraft,
      confidence
    });
  }

  const lockResult = acquireAgentLock(req.db, { force: Boolean(req.isAgent) });
  if (!lockResult.ok) {
    return res.status(409).json({
      error: 'edit_lock_conflict',
      message: `当前由 ${lockResult.lockedBy} 持有编辑锁`,
      lockedBy: lockResult.lockedBy,
      expiresAt: lockResult.expiresAt
    });
  }

  try {
    const changes = applyCoverUpdate(req.db, group.id, dateInfo.date, {
      meals,
      transfers,
      activities
    });

    return res.json({
      applied: true,
      groupId: group.id,
      date: dateInfo.date,
      confidence,
      changes
    });
  } catch (error) {
    console.error('Agent inject-one-shot failed:', error);
    return res.status(500).json({
      error: 'agent_inject_failed',
      message: error.message
    });
  } finally {
    releaseAgentLock(req.db);
  }
});

router.post('/members/upsert', (req, res) => {
  const modeRaw = normalizeText(req.body?.mode).toLowerCase();
  const mode = modeRaw || 'append';
  if (mode !== 'append' && mode !== 'cover') {
    return res.status(400).json({ error: 'mode 必须是 append 或 cover' });
  }

  const groupResult = resolveGroup(req.db, req.body || {});
  if (groupResult.error) {
    return res.status(groupResult.error.status).json(groupResult.error.body);
  }

  const { group } = groupResult;
  const members = parseMembersInput(req.body || {});
  if (members.length === 0) {
    return res.status(400).json({
      error: '未解析到有效成员，请提供 members 数组或可解析 text'
    });
  }

  const lockResult = acquireAgentLock(req.db, { force: Boolean(req.isAgent) });
  if (!lockResult.ok) {
    return res.status(409).json({
      error: 'edit_lock_conflict',
      message: `当前由 ${lockResult.lockedBy} 持有编辑锁`,
      lockedBy: lockResult.lockedBy,
      expiresAt: lockResult.expiresAt
    });
  }

  try {
    const result = upsertGroupMembers(req.db, group.id, mode, members);
    return res.json({
      applied: true,
      groupId: group.id,
      mode: result.mode,
      inserted: result.inserted,
      updated: result.updated,
      total: result.total
    });
  } catch (error) {
    console.error('Agent members upsert failed:', error);
    return res.status(500).json({
      error: 'agent_members_upsert_failed',
      message: error.message
    });
  } finally {
    releaseAgentLock(req.db);
  }
});

module.exports = router;
