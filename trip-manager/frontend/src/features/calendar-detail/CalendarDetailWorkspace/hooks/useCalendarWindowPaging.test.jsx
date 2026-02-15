import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useCalendarWindowPaging from './useCalendarWindowPaging';

const createProps = (overrides = {}) => ({
  groupId: 1,
  startDate: '2025-07-01',
  endDate: '2025-07-15',
  startHour: 6,
  endHour: 20,
  slotMinutes: 15,
  defaultWindowDays: 7,
  maxFullDays: 9,
  ...overrides
});

describe('useCalendarWindowPaging', () => {
  it('builds time slots and paged day window with clamp behavior', () => {
    const { result } = renderHook((props) => useCalendarWindowPaging(props), {
      initialProps: createProps()
    });

    expect(result.current.hasPaging).toBe(true);
    expect(result.current.maxViewStartIndex).toBe(8);
    expect(result.current.visibleDays[0]?.dateStr).toBe('2025-07-01');
    expect(result.current.visibleDays).toHaveLength(7);
    expect(result.current.timeSlots[0]).toBe('06:00');
    expect(result.current.timeSlots[result.current.timeSlots.length - 1]).toBe('20:45');
  });

  it('navigates and centers target date within bounds', () => {
    const { result } = renderHook((props) => useCalendarWindowPaging(props), {
      initialProps: createProps()
    });

    act(() => {
      result.current.handleJumpNextChunk();
    });
    expect(result.current.windowStartIndex).toBe(7);
    expect(result.current.visibleDays[0]?.dateStr).toBe('2025-07-08');

    act(() => {
      result.current.handleJumpNextChunk();
    });
    expect(result.current.windowStartIndex).toBe(8);
    expect(result.current.visibleDays[0]?.dateStr).toBe('2025-07-09');

    act(() => {
      result.current.setWindowToIncludeDate('2025-07-15');
    });
    expect(result.current.windowStartIndex).toBe(8);
    expect(result.current.visibleDays[6]?.dateStr).toBe('2025-07-15');
  });

  it('resets window start when group changes and disables paging for short ranges', () => {
    const { result, rerender } = renderHook((props) => useCalendarWindowPaging(props), {
      initialProps: createProps()
    });

    act(() => {
      result.current.handleJumpNextDay();
      result.current.handleJumpNextDay();
    });
    expect(result.current.windowStartIndex).toBe(2);

    rerender(createProps({ groupId: 2 }));
    expect(result.current.windowStartIndex).toBe(0);
    expect(result.current.visibleDays[0]?.dateStr).toBe('2025-07-01');

    rerender(createProps({
      groupId: 2,
      startDate: '2025-07-01',
      endDate: '2025-07-05'
    }));
    expect(result.current.hasPaging).toBe(false);
    expect(result.current.windowStartIndex).toBe(0);
    expect(result.current.visibleDays).toHaveLength(5);

    act(() => {
      result.current.handleJumpNextDay();
    });
    expect(result.current.windowStartIndex).toBe(0);
  });
});
