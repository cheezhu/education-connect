import { act, renderHook } from '@testing-library/react';
import message from 'antd/es/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CALENDAR_DETAIL_MESSAGES } from '../../messages';
import useCalendarDetailDragDrop from './useCalendarDetailDragDrop';

const createDataTransfer = () => ({
  setData: vi.fn(),
  getData: vi.fn(() => ''),
  clearData: vi.fn(),
  setDragImage: vi.fn(),
  effectAllowed: 'move',
  dropEffect: 'move'
});

const toRow = (time) => {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return ((hour - 6) * 60 + minute) / 15 + 2;
};

const toTime = (row) => {
  const slotIndex = Number(row) - 2;
  const minutes = Math.max(0, slotIndex) * 15;
  const hour = Math.floor(minutes / 60) + 6;
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const createDeps = (overrides = {}) => ({
  activities: [],
  setActivities: vi.fn(),
  onUpdate: vi.fn(),
  groupId: 1,
  timeSlots: ['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45'],
  slotMinutes: 15,
  slotHeight: 20,
  headerHeight: 40,
  calendarRef: { current: null },
  visibleDays: [{ dateStr: '2025-07-01' }, { dateStr: '2025-07-02' }],
  timeToGridRow: toRow,
  gridRowToTime: toTime,
  getActivityIdentity: (item) => item.id ?? item.clientId ?? `${item.date}-${item.startTime}-${item.title}`,
  resolveActivityColor: () => '#1890ff',
  planResources: [],
  setAvailablePlanResources: vi.fn(),
  setSaveStatus: vi.fn(),
  saveTimeoutRef: { current: null },
  ...overrides
});

describe('useCalendarDetailDragDrop', () => {
  beforeEach(() => {
    vi.spyOn(message, 'success').mockImplementation(() => {});
    vi.spyOn(message, 'warning').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds activity when dropping a dragged resource', () => {
    const deps = createDeps();
    const { result } = renderHook(() => useCalendarDetailDragDrop(deps));

    const draggedResource = {
      id: 'custom:meal-breakfast',
      type: 'meal',
      title: 'Breakfast',
      duration: 1,
      color: '#52c41a'
    };

    act(() => {
      result.current.handleResourceDragStart(draggedResource);
    });

    const dropEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: createDataTransfer()
    };

    act(() => {
      result.current.handleDrop(dropEvent, '2025-07-01', '09:15');
    });

    expect(deps.setActivities).toHaveBeenCalledTimes(1);
    const nextActivities = deps.setActivities.mock.calls[0][0];
    expect(nextActivities).toHaveLength(1);
    expect(nextActivities[0].date).toBe('2025-07-01');
    expect(nextActivities[0].startTime).toBe('09:15');
    expect(nextActivities[0].type).toBe('meal');
    expect(nextActivities[0].resourceId).toBe('custom:meal-breakfast');
    expect(deps.onUpdate).toHaveBeenCalledWith(nextActivities);
    expect(message.success).toHaveBeenCalledWith(
      CALENDAR_DETAIL_MESSAGES.activityAdded('Breakfast'),
      1
    );
  });

  it('blocks dropping fixed-date resource on another date', () => {
    const deps = createDeps();
    const { result } = renderHook(() => useCalendarDetailDragDrop(deps));

    act(() => {
      result.current.handleResourceDragStart({
        id: 'daily:2025-07-02:pickup',
        type: 'transport',
        title: 'Pickup',
        duration: 1,
        fixedDate: '2025-07-02'
      });
    });

    const dropEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: createDataTransfer()
    };

    act(() => {
      result.current.handleDrop(dropEvent, '2025-07-01', '09:00');
    });

    expect(deps.setActivities).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith(CALENDAR_DETAIL_MESSAGES.shixingDateFixed);
  });

  it('returns plan activity back to source list when dropped into resource area', () => {
    const returningActivity = {
      id: 101,
      resourceId: 'plan-1',
      locationId: 88,
      title: 'Science Museum',
      date: '2025-07-01',
      startTime: '09:00',
      endTime: '10:00'
    };
    const keepActivity = {
      id: 102,
      resourceId: 'custom:other',
      title: 'Keep',
      date: '2025-07-01',
      startTime: '10:30',
      endTime: '11:30'
    };
    const deps = createDeps({
      activities: [returningActivity, keepActivity],
      planResources: [
        { id: 'plan-1', title: 'Science Museum', locationId: 88 },
        { id: 'plan-2', title: 'Ocean Park', locationId: 99 }
      ]
    });
    const { result } = renderHook(() => useCalendarDetailDragDrop(deps));

    const dragStartEvent = {
      currentTarget: {
        getBoundingClientRect: () => ({ top: 0, left: 0 })
      },
      clientX: 8,
      clientY: 8,
      dataTransfer: createDataTransfer()
    };

    act(() => {
      result.current.handleDragStart(dragStartEvent, returningActivity);
    });

    const resourceDropEvent = {
      preventDefault: vi.fn()
    };

    act(() => {
      result.current.handleResourceDrop(resourceDropEvent);
    });

    expect(deps.setAvailablePlanResources).toHaveBeenCalledTimes(1);
    const listUpdater = deps.setAvailablePlanResources.mock.calls[0][0];
    expect(listUpdater([]).map((item) => item.id)).toEqual(['plan-1']);

    expect(deps.setActivities).toHaveBeenCalledTimes(1);
    expect(deps.setActivities.mock.calls[0][0]).toEqual([keepActivity]);
    expect(deps.onUpdate).toHaveBeenCalledWith([keepActivity]);
    expect(message.success).toHaveBeenCalledWith(
      CALENDAR_DETAIL_MESSAGES.returnedToSource('Science Museum', '必去行程点'),
      1
    );
  });
});
