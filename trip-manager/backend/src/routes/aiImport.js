const express = require('express');
const { requireRole } = require('../middleware/permission');
const { buildShixingResourceId } = require('../../../shared/domain/resourceId.cjs');

const router = express.Router();

const MEAL_CONFIG = {
  breakfast: {
    keywords: ['早餐', '早饭', 'breakfast'],
    label: '早餐',
    start: '07:30',
    end: '08:30'
  },
  lunch: {
    keywords: ['午餐', '午饭', 'lunch'],
    label: '午餐',
    start: '12:00',
    end: '13:00'
  },
  dinner: {
    keywords: ['晚餐', '晚饭', 'dinner'],
    label: '晚餐',
    start: '18:00',
    end: '19:00'
  }
};

const TRANSFER_CONFIG = {
  pickup: {
    keywords: ['接机', '接站', '接送机', '接送站'],
    label: '接站'
  },
  dropoff: {
    keywords: ['送机', '送站', '送团', '返程送站'],
    label: '送站'
  }
};

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[：]/g, ':')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[，]/g, ',')
    .replace(/[。]/g, '.')
    .replace(/\t/g, ' ')
    .replace(/\u3000/g, ' ')
    .trim();
};

const pad2 = (value) => String(value).padStart(2, '0');

const formatDate = (dateObj) => {
  const y = dateObj.getUTCFullYear();
  const m = dateObj.getUTCMonth() + 1;
  const d = dateObj.getUTCDate();
  return `${y}-${pad2(m)}-${pad2(d)}`;
};

const buildUtcDate = (year, month, day) => {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y
    || dt.getUTCMonth() !== m - 1
    || dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
};

const parseTimeToken = (rawToken) => {
  if (!rawToken) return null;
  const token = String(rawToken)
    .replace(/[时点]/g, ':')
    .replace(/[：]/g, ':')
    .replace(/\s+/g, '');

  const match = token.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] !== undefined ? Number(match[2]) : 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad2(hour)}:${pad2(minute)}`;
};

const addMinutes = (time, minutesToAdd) => {
  if (!time || !Number.isFinite(minutesToAdd)) return null;
  const [h, m] = String(time).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const total = h * 60 + m + minutesToAdd;
  const bounded = Math.max(0, Math.min(23 * 60 + 59, total));
  return `${pad2(Math.floor(bounded / 60))}:${pad2(bounded % 60)}`;
};

const parseTimeRange = (line) => {
  const text = normalizeText(line);
  const rangeMatch = text.match(/(\d{1,2}(?::\d{1,2})?\s*[点时]?)[\s]*[-~—–到至][\s]*(\d{1,2}(?::\d{1,2})?\s*[点时]?)/);
  if (rangeMatch) {
    const start = parseTimeToken(rangeMatch[1]);
    const end = parseTimeToken(rangeMatch[2]);
    if (start && end) {
      return { start, end, matched: rangeMatch[0], isDefaulted: false };
    }
  }

  const singleMatch = text.match(/(?:^|[^\d])(\d{1,2}(?::\d{1,2})?\s*[点时]?)(?!\d)/);
  if (singleMatch) {
    const start = parseTimeToken(singleMatch[1]);
    if (start) {
      return {
        start,
        end: null,
        matched: singleMatch[1],
        isDefaulted: false
      };
    }
  }

  return null;
};

const stripBulletPrefix = (line) => (
  String(line || '').replace(/^\s*([-\*•·]|\d+[.)、])\s*/, '')
);

const normalizeForMatch = (text) => (
  String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）\[\]【】\-_,.;:'"!?，。；：]/g, '')
);

const resolveMealKey = (line) => {
  const text = String(line || '').toLowerCase();
  return Object.entries(MEAL_CONFIG).find(([, cfg]) => (
    cfg.keywords.some((keyword) => text.includes(keyword))
  ))?.[0] || null;
};

const resolveTransferKey = (line) => {
  const text = String(line || '').toLowerCase();
  return Object.entries(TRANSFER_CONFIG).find(([, cfg]) => (
    cfg.keywords.some((keyword) => text.includes(keyword))
  ))?.[0] || null;
};

const cleanTitleText = (text) => {
  const cleaned = normalizeText(text)
    .replace(/^\d{1,2}[\/.-]\d{1,2}\s*/, '')
    .replace(/^\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}\s*/, '')
    .replace(/^\d{1,2}月\d{1,2}日\s*/, '')
    .replace(/^\d{1,2}(?::\d{1,2})?\s*[-~—–到至]\s*\d{1,2}(?::\d{1,2})?\s*/, '')
    .replace(/^\d{1,2}(?::\d{1,2})?\s*/, '')
    .replace(/^[\s:：\-—~]+/, '')
    .trim();
  return cleaned;
};

const isLikelyHotelLine = (line) => /酒店|入住|check-?in/i.test(String(line || ''));

const isLikelyTransportType = (line) => /机场|高铁|火车|大巴|交通|接驳|航班/i.test(String(line || ''));

const extractPhone = (line) => {
  const match = String(line || '').match(/\b1\d{10}\b/);
  return match ? match[0] : '';
};

const extractFlightNo = (line) => {
  const match = String(line || '').toUpperCase().match(/\b([A-Z]{2}\d{3,4})\b/);
  return match ? match[1] : '';
};

const extractDateFromLine = ({ line, currentDate, baseYear, groupStartDate }) => {
  let date = currentDate || null;
  let text = String(line || '');
  let used = false;

  const full = text.match(/(\d{4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})日?/);
  if (full) {
    const parsed = buildUtcDate(full[1], full[2], full[3]);
    if (parsed) {
      date = formatDate(parsed);
      used = true;
      text = text.replace(full[0], ' ');
    }
  } else {
    const md = text.match(/(\d{1,2})[\/.\-月](\d{1,2})日?/);
    if (md) {
      const parsed = buildUtcDate(baseYear, md[1], md[2]);
      if (parsed) {
        date = formatDate(parsed);
        used = true;
        text = text.replace(md[0], ' ');
      }
    } else {
      const dayToken = text.match(/(?:^|\s)(?:d|day)\s*([0-9]{1,2})(?:\b|$)/i);
      if (dayToken && groupStartDate) {
        const offset = Number(dayToken[1]) - 1;
        if (Number.isFinite(offset) && offset >= 0) {
          const mapped = new Date(groupStartDate.getTime() + offset * 24 * 60 * 60 * 1000);
          date = formatDate(mapped);
          used = true;
          text = text.replace(dayToken[0], ' ');
        }
      }
    }
  }

  const left = cleanTitleText(text);
  return {
    date,
    line: left,
    usedDateToken: used,
    dateOnlyLine: used && left.length === 0
  };
};

const resolveDefaultRange = (line) => {
  const text = String(line || '');
  if (/上午|早上|morning/i.test(text)) return { start: '09:00', end: '11:00' };
  if (/下午|afternoon/i.test(text)) return { start: '14:00', end: '16:00' };
  if (/晚上|夜间|evening/i.test(text)) return { start: '19:00', end: '20:00' };
  return { start: '09:00', end: '10:00' };
};

const touchLogisticsPatch = (patchMap, date) => {
  if (!patchMap.has(date)) {
    patchMap.set(date, { date, meals: {}, pickup: {}, dropoff: {} });
  }
  return patchMap.get(date);
};

const sortSchedules = (items = []) => (
  [...items].sort((a, b) => {
    const aKey = `${a.date || ''}|${a.startTime || ''}|${a.endTime || ''}|${a.title || ''}`;
    const bKey = `${b.date || ''}|${b.startTime || ''}|${b.endTime || ''}|${b.title || ''}`;
    return aKey.localeCompare(bKey);
  })
);

const buildLocationDictionary = (db) => {
  const rows = db.prepare('SELECT id, name FROM locations WHERE is_active = 1 ORDER BY id').all();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    key: normalizeForMatch(row.name)
  }));
};

const matchLocation = (text, dict = []) => {
  if (!text) return null;
  const key = normalizeForMatch(text);
  if (!key) return null;
  return dict.find((item) => key.includes(item.key) || item.key.includes(key)) || null;
};

const dedupeSchedules = (items = []) => {
  const map = new Map();
  items.forEach((item) => {
    const key = [
      item.resourceId || '',
      item.date || '',
      item.startTime || '',
      item.endTime || '',
      item.type || '',
      item.title || '',
      item.location || ''
    ].join('|');
    if (!map.has(key)) map.set(key, item);
  });
  return Array.from(map.values());
};

const parseItineraryText = ({ rawText, group, db }) => {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map(stripBulletPrefix)
    .map(normalizeText)
    .filter(Boolean);

  const locationDict = buildLocationDictionary(db);
  const scheduleCandidates = [];
  const warnings = [];
  const unmatchedLines = [];
  const patchMap = new Map();

  const groupStartDate = group?.start_date
    ? buildUtcDate(
      Number(String(group.start_date).slice(0, 4)),
      Number(String(group.start_date).slice(5, 7)),
      Number(String(group.start_date).slice(8, 10))
    )
    : null;

  const baseYear = groupStartDate ? groupStartDate.getUTCFullYear() : new Date().getUTCFullYear();
  let currentDate = group?.start_date || null;

  lines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const dateResolved = extractDateFromLine({
      line: rawLine,
      currentDate,
      baseYear,
      groupStartDate
    });

    if (dateResolved.date) currentDate = dateResolved.date;
    if (dateResolved.dateOnlyLine) return;

    const content = dateResolved.line || rawLine;
    const activeDate = dateResolved.date || currentDate;
    if (!activeDate) {
      warnings.push(`第 ${lineNo} 行未识别日期，已跳过`);
      unmatchedLines.push(rawLine);
      return;
    }

    const timeInfo = parseTimeRange(content);
    const withoutTime = timeInfo?.matched
      ? cleanTitleText(content.replace(timeInfo.matched, ' '))
      : cleanTitleText(content);
    const mealKey = resolveMealKey(withoutTime);
    const transferKey = resolveTransferKey(withoutTime);

    if (mealKey) {
      const mealCfg = MEAL_CONFIG[mealKey];
      const patch = touchLogisticsPatch(patchMap, activeDate);
      const arrangement = cleanTitleText(
        withoutTime.replace(new RegExp(mealCfg.keywords.join('|'), 'ig'), ' ')
      ) || mealCfg.label;
      const locMatched = matchLocation(withoutTime, locationDict);

      patch.meals[mealKey] = {
        arrangement,
        place: locMatched?.name || '',
        disabled: false,
        startTime: timeInfo?.start || mealCfg.start,
        endTime: timeInfo?.end || mealCfg.end
      };

      scheduleCandidates.push({
        date: activeDate,
        startTime: patch.meals[mealKey].startTime,
        endTime: patch.meals[mealKey].endTime,
        type: 'meal',
        title: arrangement,
        location: patch.meals[mealKey].place,
        description: arrangement,
        color: '#52c41a',
        resourceId: buildShixingResourceId(activeDate, 'meal', mealKey),
        isFromResource: true,
        locationId: locMatched?.id || null,
        source: 'daily-card'
      });
      return;
    }

    if (transferKey) {
      const transferCfg = TRANSFER_CONFIG[transferKey];
      const patch = touchLogisticsPatch(patchMap, activeDate);
      const descSource = cleanTitleText(
        withoutTime.replace(new RegExp(transferCfg.keywords.join('|'), 'ig'), ' ')
      );
      const flightNo = extractFlightNo(withoutTime);
      const phone = extractPhone(withoutTime);
      const locMatched = matchLocation(withoutTime, locationDict);
      const flightParts = [
        flightNo ? `航班 ${flightNo}` : '',
        descSource
      ].filter(Boolean);

      patch[transferKey] = {
        time: timeInfo?.start || '',
        endTime: timeInfo?.end || '',
        location: locMatched?.name || '',
        contact: phone || '',
        flightNo: flightNo || '',
        airline: '',
        terminal: '',
        disabled: false
      };

      if (patch[transferKey].time && patch[transferKey].endTime) {
        scheduleCandidates.push({
          date: activeDate,
          startTime: patch[transferKey].time,
          endTime: patch[transferKey].endTime,
          type: 'transport',
          title: transferCfg.label,
          location: patch[transferKey].location || '',
          description: flightParts.join(' / '),
          color: '#fa8c16',
          resourceId: buildShixingResourceId(activeDate, transferKey),
          isFromResource: true,
          locationId: locMatched?.id || null,
          source: 'daily-card'
        });
      } else {
        warnings.push(`第 ${lineNo} 行${transferCfg.label}未识别完整时间段，仅写入每日卡片`);
      }
      return;
    }

    if (isLikelyHotelLine(withoutTime)) {
      const patch = touchLogisticsPatch(patchMap, activeDate);
      const hotelText = cleanTitleText(withoutTime.replace(/入住|酒店|check-?in/ig, ' '));
      if (hotelText) {
        patch.hotel = hotelText;
      }
      return;
    }

    const title = cleanTitleText(withoutTime);
    if (!title) {
      unmatchedLines.push(rawLine);
      warnings.push(`第 ${lineNo} 行无法识别有效内容，已跳过`);
      return;
    }

    let startTime = timeInfo?.start || '';
    let endTime = timeInfo?.end || '';
    if (startTime && !endTime) {
      endTime = addMinutes(startTime, 60);
      warnings.push(`第 ${lineNo} 行只有开始时间，已自动补全 60 分钟时长`);
    }
    if (!startTime || !endTime) {
      const fallback = resolveDefaultRange(withoutTime);
      startTime = fallback.start;
      endTime = fallback.end;
      warnings.push(`第 ${lineNo} 行未识别时间段，已使用默认 ${startTime}-${endTime}`);
    }

    const locationMatch = matchLocation(withoutTime, locationDict);
    const type = isLikelyTransportType(withoutTime) ? 'transport' : 'visit';
    scheduleCandidates.push({
      date: activeDate,
      startTime,
      endTime,
      type,
      title,
      location: locationMatch?.name || '',
      description: '',
      color: type === 'transport' ? '#fa8c16' : '#1890ff',
      resourceId: null,
      isFromResource: false,
      locationId: locationMatch?.id || null,
      source: locationMatch ? 'plan' : 'custom'
    });
  });

  const logisticsPatches = Array.from(patchMap.values())
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const dedupedSchedules = sortSchedules(dedupeSchedules(scheduleCandidates));

  return {
    scheduleCandidates: dedupedSchedules,
    logisticsPatches,
    warnings,
    unmatchedLines,
    summary: {
      lineCount: lines.length,
      scheduleCount: dedupedSchedules.length,
      logisticsDayCount: logisticsPatches.length,
      warningCount: warnings.length
    }
  };
};

router.post('/itinerary/parse', requireRole(['editor', 'viewer']), (req, res) => {
  const rawText = String(req.body?.rawText || '');
  const groupId = Number(req.body?.groupId);

  if (!rawText.trim()) {
    return res.status(400).json({ error: '请提供行程文本 rawText' });
  }

  let group = null;
  if (Number.isFinite(groupId) && groupId > 0) {
    group = req.db.prepare('SELECT id, start_date, end_date FROM groups WHERE id = ?').get(groupId);
    if (!group) {
      return res.status(404).json({ error: '团组不存在' });
    }
  }

  try {
    const parsed = parseItineraryText({ rawText, group, db: req.db });
    return res.json({
      ok: true,
      groupId: Number.isFinite(groupId) && groupId > 0 ? groupId : null,
      ...parsed
    });
  } catch (error) {
    console.error('AI itinerary parse failed:', error);
    return res.status(500).json({ error: '行程解析失败' });
  }
});

module.exports = router;
