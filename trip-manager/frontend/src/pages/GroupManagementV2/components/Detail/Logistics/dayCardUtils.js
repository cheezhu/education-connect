import dayjs from 'dayjs';

export const weekdayLabel = (dateStr) => {
  if (!dateStr) return '';
  return dayjs(dateStr).format('ddd / MMM');
};

export const resolveEventTitle = (event) => {
  return event?.title || event?.location || event?.description || '未命名活动';
};

export const toPlainText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    if (!text || text === '[object Object]' || text === 'undefined' || text === 'null') {
      return '';
    }
    return text;
  }
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name;
    if (typeof value.label === 'string') return value.label;
    if (typeof value.value === 'string' || typeof value.value === 'number') {
      return String(value.value);
    }
  }
  return '';
};

export const isItineraryItem = (item) => {
  const type = (item?.type || '').toString().toLowerCase();
  if (!type) return true;
  return !['meal', 'transport', 'rest', 'free'].includes(type);
};

const parseHour = (timeStr = '') => {
  if (!timeStr) return null;
  const match = String(timeStr).match(/\d{1,2}/);
  if (!match) return null;
  const hour = Number(match[0]);
  if (Number.isNaN(hour)) return null;
  return hour;
};

export const splitScheduleItems = (items = []) => {
  const buckets = {
    morning: [],
    afternoon: [],
    evening: []
  };

  items.forEach((item) => {
    const time = item.startTime || item.start_time || item.time || '';
    const hour = parseHour(time);
    let bucket = 'morning';
    if (hour !== null) {
      if (hour < 12) bucket = 'morning';
      else if (hour < 18) bucket = 'afternoon';
      else bucket = 'evening';
    }
    buckets[bucket].push(item);
  });

  return buckets;
};

export const buildSlotList = (items = []) => {
  if (!items.length) return ['未安排'];
  return items.map((item) => {
    const title = resolveEventTitle(item);
    const location = item?.location || item?.place || item?.venue || '';
    return location || title;
  }).filter(Boolean);
};

export const formatWeatherTime = (value) => {
  if (!value) return '';
  const parsed = dayjs(value);
  if (!parsed.isValid()) return value;
  return parsed.format('MM-DD HH:mm');
};

export const downloadJson = (filename, payload) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
