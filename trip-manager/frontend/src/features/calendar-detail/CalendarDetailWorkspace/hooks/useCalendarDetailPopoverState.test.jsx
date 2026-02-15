import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useCalendarDetailPopoverState from './useCalendarDetailPopoverState';

const createDeps = (overrides = {}) => ({
  isDragging: false,
  isResizing: false,
  buildShixingMealDrafts: vi.fn(() => ({ breakfast: { plan: 'B' } })),
  buildShixingTransferDrafts: vi.fn(() => ({ pickup: { location: 'Airport' } })),
  ...overrides
});

describe('useCalendarDetailPopoverState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens create popover from slot click', () => {
    const deps = createDeps();
    const { result } = renderHook(() => useCalendarDetailPopoverState(deps));

    act(() => {
      result.current.handleSlotClick('2025-07-01', '09:00', { left: 10, top: 20 });
    });

    expect(result.current.selectedSlot).toEqual({ date: '2025-07-01', time: '09:00' });
    expect(result.current.popoverState.isOpen).toBe(true);
    expect(result.current.popoverState.mode).toBe('create');
    expect(result.current.popoverState.initialValues).toMatchObject({
      date: '2025-07-01',
      startTime: '09:00',
      endTime: '10:00',
      type: 'visit',
      shixingCardType: 'meal',
      shixingTransferType: 'pickup'
    });
    expect(deps.buildShixingMealDrafts).toHaveBeenCalledWith('2025-07-01');
    expect(deps.buildShixingTransferDrafts).toHaveBeenCalledWith('2025-07-01');
  });

  it('does not open popover while dragging', () => {
    const deps = createDeps({ isDragging: true });
    const { result } = renderHook(() => useCalendarDetailPopoverState(deps));

    act(() => {
      result.current.handleSlotClick('2025-07-01', '09:00', null);
    });

    expect(result.current.selectedSlot).toBeNull();
    expect(result.current.popoverState.isOpen).toBe(false);
  });

  it('opens edit popover on activity click and context menu', () => {
    const deps = createDeps();
    const { result } = renderHook(() => useCalendarDetailPopoverState(deps));
    const activity = { date: '2025-07-02', startTime: '11:00', title: 'Museum' };
    const clickEvent = { stopPropagation: vi.fn() };
    const contextEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };

    act(() => {
      result.current.handleActivityClick(clickEvent, activity, { left: 2, top: 3 });
    });

    expect(clickEvent.stopPropagation).toHaveBeenCalledTimes(1);
    expect(result.current.selectedSlot).toEqual({ date: '2025-07-02', time: '11:00' });
    expect(result.current.popoverState.isOpen).toBe(true);
    expect(result.current.popoverState.mode).toBe('edit');
    expect(result.current.popoverState.activity).toEqual(activity);

    act(() => {
      result.current.closePopover();
    });
    expect(result.current.popoverState.isOpen).toBe(false);

    act(() => {
      result.current.handleActivityContextMenu(contextEvent, activity, null);
    });

    expect(contextEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(contextEvent.stopPropagation).toHaveBeenCalledTimes(2);
    expect(result.current.popoverState.isOpen).toBe(true);
    expect(result.current.popoverState.mode).toBe('edit');
  });

  it('closes popover on escape and outside click', () => {
    const deps = createDeps();
    const { result } = renderHook(() => useCalendarDetailPopoverState(deps));

    act(() => {
      result.current.handleSlotClick('2025-07-01', '09:00', null);
    });
    expect(result.current.popoverState.isOpen).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.popoverState.isOpen).toBe(false);

    act(() => {
      result.current.handleSlotClick('2025-07-01', '09:00', null);
    });
    expect(result.current.popoverState.isOpen).toBe(true);

    act(() => {
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(result.current.popoverState.isOpen).toBe(false);
  });
});
