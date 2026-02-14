import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBulkCreate } from './useBulkCreate';

const createSetup = () => {
  const apiClient = {
    post: vi.fn()
  };
  const fetchGroups = vi.fn();
  const showSuccess = vi.fn();
  const showError = vi.fn();

  const hook = renderHook(() => useBulkCreate({
    apiClient,
    fetchGroups,
    showSuccess,
    showError
  }));

  return {
    apiClient,
    fetchGroups,
    showSuccess,
    showError,
    ...hook
  };
};

describe('useBulkCreate', () => {
  it('manages rows with add/remove/reset operations', () => {
    const { result } = createSetup();

    expect(result.current.bulkRows.length).toBe(1);

    act(() => {
      result.current.addBulkRow();
    });
    expect(result.current.bulkRows.length).toBe(2);

    const firstRowId = result.current.bulkRows[0].id;
    act(() => {
      result.current.removeBulkRow(firstRowId);
    });
    expect(result.current.bulkRows.length).toBe(1);

    act(() => {
      result.current.resetBulkForm();
    });
    expect(result.current.bulkRows.length).toBe(1);
    expect(result.current.bulkRows[0].name).toBe('');
  });

  it('validates invalid rows and records row errors', async () => {
    const { result, showError } = createSetup();

    await act(async () => {
      await result.current.handleBulkCreate();
    });

    expect(showError).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.current.bulkErrors).length).toBe(1);

    const rowId = result.current.bulkRows[0].id;
    act(() => {
      result.current.updateBulkRow(rowId, { name: 'A' });
    });
    expect(result.current.bulkErrors[rowId]).toBeUndefined();
  });

  it('submits valid rows and resets form state', async () => {
    const { result, apiClient, fetchGroups, showSuccess } = createSetup();

    apiClient.post.mockResolvedValueOnce({ data: { count: 1 } });

    const rowId = result.current.bulkRows[0].id;
    act(() => {
      result.current.updateBulkRow(rowId, {
        name: 'Test Group',
        type: 'vip',
        start_date: '2025-09-01',
        end_date: '2025-09-03',
        participant_count: 32
      });
      result.current.setBulkOpen(true);
    });

    await act(async () => {
      await result.current.handleBulkCreate();
    });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledTimes(1);
    });

    expect(fetchGroups).toHaveBeenCalledTimes(1);
    expect(showSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.bulkOpen).toBe(false);
    expect(result.current.bulkRows.length).toBe(1);
    expect(result.current.bulkRows[0].name).toBe('');
  });
});
