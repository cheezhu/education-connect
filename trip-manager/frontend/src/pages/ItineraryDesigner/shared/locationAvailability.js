import dayjs from 'dayjs';

import { parseDelimitedValues } from './parse';

export const getLocationUnavailableReason = (location, dateString) => {
  if (!location) return null;
  if (Number(location.is_active) === 0) {
    return `${location.name || '该地点'}已停用，不能拖入`;
  }
  const weekday = dayjs(dateString).day();
  const blockedWeekdays = parseDelimitedValues(location.blocked_weekdays);
  if (blockedWeekdays.includes(String(weekday))) {
    return `${location.name || '该地点'}在该日期不可用，不能拖入`;
  }
  const closedDates = new Set(parseDelimitedValues(location.closed_dates));
  if (closedDates.has(dateString)) {
    return `${location.name || '该地点'}在${dateString}闭馆，不能拖入`;
  }
  return null;
};

