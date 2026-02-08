import dayjs from 'dayjs';

export const generateDateRange = (startDate: unknown): Date[] => {
  const baseDate = startDate ? dayjs(startDate as any) : dayjs();
  return Array.from({ length: 7 }, (_, index) => (
    baseDate.add(index, 'day').toDate()
  ));
};

export const formatDateString = (date: unknown): string => {
  if (!date) return '';
  const normalized = dayjs(date as any);
  if (!normalized.isValid()) return '';
  return normalized.format('YYYY-MM-DD');
};

// Note: these are used on `YYYY-MM-DD` strings, so lexicographic compare is intentional.
export const maxDate = (left?: string, right?: string): string | undefined => {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
};

export const minDate = (left?: string, right?: string): string | undefined => {
  if (!left) return right;
  if (!right) return left;
  return left < right ? left : right;
};

export const iterateDateStrings = (start: unknown, end: unknown): string[] => {
  if (!start || !end || !dayjs(start as any).isValid() || !dayjs(end as any).isValid()) return [];
  const result: string[] = [];
  let cursor = dayjs(start as any).startOf('day');
  const limit = dayjs(end as any).startOf('day');
  while (cursor.isBefore(limit, 'day') || cursor.isSame(limit, 'day')) {
    result.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'day');
  }
  return result;
};

