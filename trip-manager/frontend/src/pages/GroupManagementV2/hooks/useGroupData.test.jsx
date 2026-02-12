import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sortAndFilterGroups, useGroupData } from './useGroupData';

const createApiClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
});

const createNotify = () => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn()
});

const setupDefaultGetMocks = (apiClient, { groups = [] } = {}) => {
  apiClient.get.mockImplementation(async (url) => {
    if (url === '/groups') return { data: groups };
    if (url === '/itinerary-plans') return { data: [] };
    if (url === '/locations') return { data: [] };
    if (String(url).endsWith('/logistics')) return { data: [] };
    if (String(url).endsWith('/schedules')) return { data: [], headers: {} };
    if (String(url).endsWith('/members')) return { data: [] };
    throw new Error(`Unhandled GET in test: ${url}`);
  });
};

afterEach(() => {
  vi.useRealTimers();
});

describe('useGroupData', () => {
  it('sortAndFilterGroups sorts by created_at desc and falls back to start_date desc', () => {
    const list = [
      { id: 1, name: 'A', created_at: '2025-06-01T00:00:00.000Z', start_date: '2025-07-01' },
      { id: 2, name: 'B', created_at: '2025-06-03T00:00:00.000Z', start_date: '2025-07-02' },
      { id: 3, name: 'C', created_at: null, start_date: '2025-07-05' },
      { id: 4, name: 'D', created_at: null, start_date: '2025-07-03' }
    ];
    const sorted = sortAndFilterGroups(list, '');
    expect(sorted.map((item) => item.id)).toEqual([2, 1, 3, 4]);
  });

  it('sortAndFilterGroups matches by name/group_code/contact fields', () => {
    const list = [
      { id: 1, name: 'Alpha', group_code: 'G-100', contact_person: 'Tom', contact_phone: '111' },
      { id: 2, name: 'Beta', group_code: 'VIP-9', contact_person: 'Jerry', contact_phone: '222' }
    ];
    expect(sortAndFilterGroups(list, 'vip').map((item) => item.id)).toEqual([2]);
    expect(sortAndFilterGroups(list, 'tom').map((item) => item.id)).toEqual([1]);
    expect(sortAndFilterGroups(list, '222').map((item) => item.id)).toEqual([2]);
  });

  it('creates one group and places it at the top with active selection', async () => {
    const apiClient = createApiClient();
    const notify = createNotify();
    setupDefaultGetMocks(apiClient, {
      groups: [
        {
          id: 1,
          name: '旧团组',
          type: 'primary',
          student_count: 12,
          teacher_count: 1,
          start_date: '2025-07-01',
          end_date: '2025-07-03',
          created_at: '2025-06-01T00:00:00.000Z'
        }
      ]
    });
    apiClient.post.mockImplementation(async (url, payload) => {
      if (url === '/groups') {
        return {
          data: {
            group: {
              id: 99,
              created_at: '2025-08-01T00:00:00.000Z',
              ...payload
            }
          }
        };
      }
      throw new Error(`Unhandled POST in test: ${url}`);
    });

    const { result } = renderHook(() => useGroupData({ apiClient, notify }));

    await waitFor(() => {
      expect(result.current.groups.length).toBe(1);
    });

    await act(async () => {
      await result.current.handleQuickCreateGroup();
    });

    await waitFor(() => {
      expect(result.current.activeGroupId).toBe(99);
      expect(result.current.groups[0]?.id).toBe(99);
      expect(result.current.filters.searchText).toBe('');
    });
    expect(notify.success).toHaveBeenCalledWith('已新建团组');
  });

  it('keeps the selected group stable while filter changes', async () => {
    const apiClient = createApiClient();
    const notify = createNotify();
    setupDefaultGetMocks(apiClient, {
      groups: [
        {
          id: 1,
          name: '北京团组',
          type: 'primary',
          student_count: 10,
          teacher_count: 0,
          start_date: '2025-07-01',
          end_date: '2025-07-02',
          created_at: '2025-06-01T00:00:00.000Z'
        },
        {
          id: 2,
          name: '上海团组',
          type: 'vip',
          student_count: 8,
          teacher_count: 1,
          start_date: '2025-07-03',
          end_date: '2025-07-04',
          created_at: '2025-06-02T00:00:00.000Z'
        }
      ]
    });

    const { result } = renderHook(() => useGroupData({ apiClient, notify }));

    await waitFor(() => {
      expect(result.current.groups.length).toBe(2);
    });

    await act(async () => {
      result.current.handleSelectGroup(2);
    });

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/groups/2/logistics');
    });

    act(() => {
      result.current.updateSearch('北京');
    });

    expect(result.current.activeGroupId).toBe(2);
    expect(result.current.filteredGroups.map((item) => item.id)).toEqual([1]);
  });

  it('saves edited group with diff payload only', async () => {
    const apiClient = createApiClient();
    const notify = createNotify();
    const baseGroup = {
      id: 7,
      name: '原名称',
      type: 'primary',
      student_count: 20,
      teacher_count: 2,
      start_date: '2025-07-01',
      end_date: '2025-07-04',
      created_at: '2025-06-01T00:00:00.000Z'
    };

    setupDefaultGetMocks(apiClient, { groups: [baseGroup] });
    apiClient.put.mockResolvedValue({
      data: {
        group: {
          ...baseGroup,
          name: '新名称'
        }
      }
    });

    const { result } = renderHook(() => useGroupData({ apiClient, notify }));

    await waitFor(() => {
      expect(result.current.groups.length).toBe(1);
    });

    vi.useFakeTimers();
    act(() => {
      result.current.handleGroupUpdate({ ...baseGroup, name: '新名称' });
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(apiClient.put).toHaveBeenCalledTimes(1);
    expect(apiClient.put).toHaveBeenCalledWith('/groups/7', { name: '新名称' });
  });
});
