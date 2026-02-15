import { renderHook } from '@testing-library/react';
import message from 'antd/es/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCalendarDetailConflictCheck from './useCalendarDetailConflictCheck';
import { CALENDAR_DETAIL_MESSAGES } from '../../messages';

const toRow = (time) => {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return ((hour - 6) * 60 + minute) / 15 + 2;
};

describe('useCalendarDetailConflictCheck', () => {
  beforeEach(() => {
    vi.spyOn(message, 'success').mockImplementation(() => {});
    vi.spyOn(message, 'warning').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows success when no conflicts found', () => {
    const activities = [
      { date: '2025-07-01', startTime: '09:00', endTime: '10:00' },
      { date: '2025-07-01', startTime: '10:00', endTime: '11:00' }
    ];
    const { result } = renderHook(() => useCalendarDetailConflictCheck({
      activities,
      timeToGridRow: toRow
    }));

    result.current.handleCheckConflicts();

    expect(message.success).toHaveBeenCalledWith(CALENDAR_DETAIL_MESSAGES.noConflicts, 1);
    expect(message.warning).not.toHaveBeenCalled();
  });

  it('shows warning with conflict count', () => {
    const activities = [
      { date: '2025-07-01', startTime: '09:00', endTime: '10:00' },
      { date: '2025-07-01', startTime: '09:30', endTime: '10:30' },
      { date: '2025-07-02', startTime: '09:00', endTime: '10:00' },
      { date: '2025-07-02', startTime: '09:15', endTime: '10:15' }
    ];
    const { result } = renderHook(() => useCalendarDetailConflictCheck({
      activities,
      timeToGridRow: toRow
    }));

    result.current.handleCheckConflicts();

    expect(message.warning).toHaveBeenCalledWith(CALENDAR_DETAIL_MESSAGES.conflictCount(2), 2);
    expect(message.success).not.toHaveBeenCalled();
  });
});
