const isValidDateString = (value) => {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
};

const parseDateUtc = (value) => {
  if (!isValidDateString(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatDateUtc = (date) => {
  if (!(date instanceof Date)) return '';
  return [
    String(date.getUTCFullYear()),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
};

const iterateDateRange = (startDate, endDate) => {
  const start = parseDateUtc(startDate);
  const end = parseDateUtc(endDate);
  if (!start || !end || start > end) return [];
  const result = [];
  let cursor = start;
  while (cursor <= end) {
    result.push(formatDateUtc(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return result;
};

const getWeekdayUtc = (dateString) => {
  const date = parseDateUtc(dateString);
  if (!date) return -1;
  return date.getUTCDay();
};

const clampDateRange = (leftStart, leftEnd, rightStart, rightEnd) => {
  const start = [leftStart, rightStart].filter(Boolean).sort()[1] || leftStart || rightStart || '';
  const end = [leftEnd, rightEnd].filter(Boolean).sort()[0] || leftEnd || rightEnd || '';
  if (!start || !end || start > end) {
    return null;
  }
  return { startDate: start, endDate: end };
};

module.exports = {
  isValidDateString,
  parseDateUtc,
  formatDateUtc,
  iterateDateRange,
  getWeekdayUtc,
  clampDateRange
};

