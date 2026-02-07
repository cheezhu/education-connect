import dayjs from 'dayjs';

// Keep these helpers in one place so the main page stays readable.

export const generateDateRange = (startDate) => {
  const baseDate = startDate ? dayjs(startDate) : dayjs();
  return Array.from({ length: 7 }, (_, index) => (
    baseDate.add(index, 'day').toDate()
  ));
};

export const formatDateString = (date) => {
  if (!date) return '';
  const normalized = dayjs(date);
  if (!normalized.isValid()) return '';
  return normalized.format('YYYY-MM-DD');
};

export const maxDate = (left, right) => {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
};

export const minDate = (left, right) => {
  if (!left) return right;
  if (!right) return left;
  return left < right ? left : right;
};

export const iterateDateStrings = (start, end) => {
  if (!start || !end || !dayjs(start).isValid() || !dayjs(end).isValid()) return [];
  const result = [];
  let cursor = dayjs(start).startOf('day');
  const limit = dayjs(end).startOf('day');
  while (cursor.isBefore(limit, 'day') || cursor.isSame(limit, 'day')) {
    result.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'day');
  }
  return result;
};

