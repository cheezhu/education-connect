import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GROUP_MESSAGES } from '../constants';
import { useScheduleSync } from './useScheduleSync';

const createApiClient = () => ({
  get: vi.fn(),
  post: vi.fn()
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useScheduleSync', () => {
  it('queues schedule save and persists after debounce', async () => {
    const apiClient = createApiClient();
    const showError = vi.fn();
    const showWarning = vi.fn();
    const applyScheduleToGroups = vi.fn();
    const activeGroupIdRef = { current: 1 };
    const savedList = [{ id: 10, title: 'A' }];

    apiClient.post.mockResolvedValue({
      data: savedList,
      headers: { 'x-schedule-revision': '3' }
    });

    const { result } = renderHook(() => useScheduleSync({
      apiClient,
      activeGroupId: 1,
      activeGroupIdRef,
      applyScheduleToGroups,
      showError,
      showWarning
    }));

    vi.useFakeTimers();
    act(() => {
      const changed = result.current.saveSchedulesIfChanged(1, savedList);
      expect(changed).toBe(true);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/groups/1/schedules/batch', {
      scheduleList: savedList,
      revision: 0
    });
    expect(applyScheduleToGroups).toHaveBeenCalledWith(1, savedList);
    expect(showError).not.toHaveBeenCalled();
    expect(showWarning).not.toHaveBeenCalled();
  });

  it('does not save when schedule signature is unchanged', () => {
    const apiClient = createApiClient();
    const showError = vi.fn();
    const showWarning = vi.fn();
    const applyScheduleToGroups = vi.fn();
    const activeGroupIdRef = { current: 1 };
    const scheduleList = [{ id: 20, title: 'B' }];

    const { result } = renderHook(() => useScheduleSync({
      apiClient,
      activeGroupId: 1,
      activeGroupIdRef,
      applyScheduleToGroups,
      showError,
      showWarning
    }));

    act(() => {
      result.current.handleScheduleUpdate(scheduleList);
    });

    act(() => {
      const changed = result.current.saveSchedulesIfChanged(1, scheduleList);
      expect(changed).toBe(false);
    });

    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('handles conflict by warning and refetching schedules', async () => {
    const apiClient = createApiClient();
    const showError = vi.fn();
    const showWarning = vi.fn();
    const applyScheduleToGroups = vi.fn();
    const activeGroupIdRef = { current: 1 };
    const scheduleList = [{ id: 30, title: 'C' }];

    apiClient.post.mockRejectedValue({
      response: {
        status: 409,
        headers: { 'x-schedule-revision': '9' }
      }
    });
    apiClient.get.mockResolvedValue({
      data: scheduleList,
      headers: { 'x-schedule-revision': '9' }
    });

    const { result } = renderHook(() => useScheduleSync({
      apiClient,
      activeGroupId: 1,
      activeGroupIdRef,
      applyScheduleToGroups,
      showError,
      showWarning
    }));

    vi.useFakeTimers();
    act(() => {
      result.current.saveSchedulesIfChanged(1, scheduleList);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(showWarning).toHaveBeenCalledWith(GROUP_MESSAGES.scheduleConflict);
    expect(apiClient.get).toHaveBeenCalledWith('/groups/1/schedules');
    expect(showError).not.toHaveBeenCalled();
  });
});
