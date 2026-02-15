import { renderHook } from '@testing-library/react';
import message from 'antd/es/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCalendarDetailCustomResources from './useCalendarDetailCustomResources';
import { hashString } from '../utils/hash';

describe('useCalendarDetailCustomResources', () => {
  beforeEach(() => {
    vi.spyOn(message, 'warning').mockImplementation(() => {});
    vi.spyOn(message, 'success').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters out resources already used by schedules', () => {
    const customResources = [
      { id: 'custom:1', title: 'A' },
      { id: 'custom:2', title: 'B' },
      { id: 'custom:legacy', title: 'Legacy' }
    ];
    const legacyHash = hashString('activity|Legacy Event|60');
    const activities = [
      { resourceId: 'custom:1', title: 'Used A' },
      { type: 'activity', title: 'Legacy Event', startTime: '09:00', endTime: '10:00' }
    ];
    const { result } = renderHook(() => useCalendarDetailCustomResources({
      customResourcesInput: customResources.map((item) => (
        item.id === 'custom:legacy' ? { ...item, id: `custom:${legacyHash}` } : item
      )),
      activities
    }));

    expect(result.current.availableCustomResources.map((item) => item.id)).toEqual(['custom:2']);
  });

  it('warns when delete callback is missing', () => {
    const { result } = renderHook(() => useCalendarDetailCustomResources({
      customResourcesInput: [{ id: 'custom:1', title: 'A' }],
      activities: []
    }));

    result.current.handleDeleteCustomResource('custom:1');
    expect(message.warning).toHaveBeenCalledTimes(1);
  });

  it('deletes resource and emits success when callback exists', () => {
    const onCustomResourcesChange = vi.fn();
    const { result } = renderHook(() => useCalendarDetailCustomResources({
      customResourcesInput: [
        { id: 'custom:1', title: 'A' },
        { id: 'custom:2', title: 'B' }
      ],
      activities: [],
      onCustomResourcesChange
    }));

    result.current.handleDeleteCustomResource('custom:1');

    expect(onCustomResourcesChange).toHaveBeenCalledWith([{ id: 'custom:2', title: 'B' }]);
    expect(message.success).toHaveBeenCalledTimes(1);
  });
});
