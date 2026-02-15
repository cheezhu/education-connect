import { act, renderHook } from '@testing-library/react';
import message from 'antd/es/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHIXING_MEAL_KEYS } from '../../../../domain/shixingConfig';
import { CALENDAR_DETAIL_MESSAGES } from '../../messages';
import useCalendarDetailPopoverSave from './useCalendarDetailPopoverSave';

const toRow = (time) => {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  const totalMinutes = (hour - 6) * 60 + minute;
  return Math.max(0, Math.round(totalMinutes / 15)) + 2;
};

const baseDeps = (overrides = {}) => ({
  activities: [],
  setActivities: vi.fn(),
  onUpdate: vi.fn(),
  groupId: 1,
  selectedSlot: { date: '2025-07-01', time: '09:00' },
  planResources: [],
  activityTypes: {
    meal: { color: '#52c41a' },
    transport: { color: '#fa8c16' },
    visit: { color: '#1890ff' },
    activity: { color: '#722ed1' }
  },
  getActivityIdentity: (item) => (
    item?.id ?? item?.clientId ?? `${item?.date || ''}-${item?.startTime || ''}-${item?.title || ''}`
  ),
  timeToGridRow: toRow,
  resolveActivityColor: () => '#1890ff',
  applyMealDraftsToLogistics: vi.fn(),
  applyTransferDraftToLogistics: vi.fn(),
  resolveTransferTypeForDate: vi.fn(() => 'pickup'),
  hasTransferDraftContent: vi.fn(() => true),
  buildTransferDescription: vi.fn(() => 'note'),
  saveTimeoutRef: { current: null },
  setSaveStatus: vi.fn(),
  ...overrides
});

describe('useCalendarDetailPopoverSave', () => {
  beforeEach(() => {
    vi.spyOn(message, 'error').mockImplementation(() => {});
    vi.spyOn(message, 'warning').mockImplementation(() => {});
    vi.spyOn(message, 'success').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns false when date is missing', () => {
    const deps = baseDeps({ selectedSlot: { time: '09:00' } });
    const { result } = renderHook(() => useCalendarDetailPopoverSave(deps));

    const saved = result.current.handleSaveFromPopover(null, {
      title: 'No Date',
      startTime: '09:00',
      endTime: '10:00'
    });

    expect(saved).toBe(false);
    expect(message.error).toHaveBeenCalledWith(CALENDAR_DETAIL_MESSAGES.selectDateFirst);
    expect(deps.setActivities).not.toHaveBeenCalled();
  });

  it('creates custom activity and emits update', async () => {
    vi.useFakeTimers();
    const deps = baseDeps();
    const { result } = renderHook(() => useCalendarDetailPopoverSave(deps));

    let saved;
    act(() => {
      saved = result.current.handleSaveFromPopover(null, {
        type: 'activity',
        title: 'Custom Activity A',
        location: 'Location A',
        startTime: '09:00',
        endTime: '10:00'
      });
    });

    expect(saved).toBe(true);
    expect(deps.setActivities).toHaveBeenCalledTimes(1);
    const nextActivities = deps.setActivities.mock.calls[0][0];
    expect(nextActivities).toHaveLength(1);
    expect(nextActivities[0].resourceId.startsWith('custom:')).toBe(true);
    expect(nextActivities[0].title).toBe('Custom Activity A');
    expect(deps.onUpdate).toHaveBeenCalledWith(nextActivities);
    expect(deps.setSaveStatus).toHaveBeenCalledWith('saving');

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(deps.setSaveStatus).toHaveBeenCalledWith('saved');
  });

  it('syncs meals and writes back logistics', async () => {
    vi.useFakeTimers();
    const deps = baseDeps();
    const mealKey = SHIXING_MEAL_KEYS[0];
    const { result } = renderHook(() => useCalendarDetailPopoverSave(deps));

    let saved;
    act(() => {
      saved = result.current.handleSaveFromPopover(null, {
        sourceCategory: 'meal',
        date: '2025-07-01',
        shixingMeals: {
          [mealKey]: {
            disabled: false,
            plan: 'Breakfast Plan',
            place: 'Campus Cafe',
            startTime: '08:00',
            endTime: '09:00'
          }
        }
      });
    });

    expect(saved).toBe(true);
    expect(deps.setActivities).toHaveBeenCalledTimes(1);
    const nextActivities = deps.setActivities.mock.calls[0][0];
    expect(nextActivities).toHaveLength(1);
    expect(nextActivities[0].type).toBe('meal');
    expect(nextActivities[0].resourceId).toContain(`:meal:${mealKey}`);
    expect(deps.applyMealDraftsToLogistics).toHaveBeenCalledWith('2025-07-01', {
      [mealKey]: {
        disabled: false,
        plan: 'Breakfast Plan',
        place: 'Campus Cafe',
        startTime: '08:00',
        endTime: '09:00'
      }
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(deps.setSaveStatus).toHaveBeenCalledWith('saved');
  });

  it('blocks transfer save when date is not first/last day', () => {
    const deps = baseDeps({
      resolveTransferTypeForDate: vi.fn(() => null)
    });
    const { result } = renderHook(() => useCalendarDetailPopoverSave(deps));

    const saved = result.current.handleSaveFromPopover(null, {
      sourceCategory: 'transfer',
      shixingTransferType: 'pickup',
      shixingTransfer: {
        startTime: '12:00',
        endTime: '13:00'
      }
    });

    expect(saved).toBe(false);
    expect(message.warning).toHaveBeenCalledWith(CALENDAR_DETAIL_MESSAGES.transferDateRestricted);
    expect(deps.setActivities).not.toHaveBeenCalled();
  });
});
