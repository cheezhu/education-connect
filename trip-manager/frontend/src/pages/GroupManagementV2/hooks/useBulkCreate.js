import { useCallback, useState } from 'react';
import { GROUP_MESSAGES } from '../constants';

const createBulkRow = () => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  type: '',
  start_date: '',
  end_date: '',
  participant_count: 44
});

export const useBulkCreate = ({
  apiClient,
  fetchGroups,
  showSuccess,
  showError
}) => {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkRows, setBulkRows] = useState(() => [createBulkRow()]);
  const [bulkErrors, setBulkErrors] = useState({});

  const addBulkRow = useCallback(() => {
    setBulkRows((prev) => [...prev, createBulkRow()]);
  }, []);

  const removeBulkRow = useCallback((id) => {
    setBulkRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const updateBulkRow = useCallback((id, updates) => {
    setBulkRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
    setBulkErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const resetBulkForm = useCallback(() => {
    setBulkRows([createBulkRow()]);
    setBulkErrors({});
  }, []);

  const validateBulkRows = useCallback(() => {
    const errors = {};
    let firstInvalid = null;

    bulkRows.forEach((row, index) => {
      const rowErrors = {};
      if (!row.name || !row.name.trim()) rowErrors.name = true;
      if (!row.type) rowErrors.type = true;
      if (!row.start_date) rowErrors.start_date = true;
      if (!row.end_date) rowErrors.end_date = true;
      const count = Number(row.participant_count);
      if (!Number.isFinite(count) || count <= 0) rowErrors.participant_count = true;

      if (Object.keys(rowErrors).length) {
        errors[row.id] = rowErrors;
        if (firstInvalid === null) firstInvalid = index + 1;
      }
    });

    return { errors, firstInvalid };
  }, [bulkRows]);

  const handleBulkCreate = useCallback(async () => {
    if (bulkRows.length === 0) {
      showError(GROUP_MESSAGES.batchCreateRowMissing);
      return;
    }

    const { errors, firstInvalid } = validateBulkRows();
    if (firstInvalid) {
      setBulkErrors(errors);
      showError(`\u8bf7\u5b8c\u5584\u7b2c ${firstInvalid} \u884c\u4fe1\u606f`);
      return;
    }

    const groupsToCreate = bulkRows.map((row) => ({
      name: row.name.trim(),
      type: row.type,
      student_count: Number(row.participant_count),
      teacher_count: 0,
      start_date: row.start_date,
      end_date: row.end_date
    }));

    setBulkSubmitting(true);
    try {
      const response = await apiClient.post('/groups/batch', { groups: groupsToCreate });
      const createdCount = response.data?.count ?? groupsToCreate.length;
      showSuccess(`\u5df2\u521b\u5efa ${createdCount} \u4e2a\u56e2\u7ec4`);
      setBulkOpen(false);
      resetBulkForm();
      fetchGroups();
    } catch (error) {
      const errorMessage = error?.response?.data?.message
        || error?.response?.data?.error
        || GROUP_MESSAGES.batchCreateFailed;
      showError(errorMessage);
    } finally {
      setBulkSubmitting(false);
    }
  }, [
    apiClient,
    bulkRows,
    fetchGroups,
    resetBulkForm,
    showError,
    showSuccess,
    validateBulkRows
  ]);

  return {
    bulkOpen,
    bulkSubmitting,
    bulkRows,
    bulkErrors,
    setBulkOpen,
    addBulkRow,
    removeBulkRow,
    updateBulkRow,
    resetBulkForm,
    handleBulkCreate
  };
};
