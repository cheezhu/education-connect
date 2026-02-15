import { useCallback, useEffect, useRef, useState } from 'react';
import { DEBOUNCE_MS, GROUP_MESSAGES, isSameGroupId } from '../constants';
import { buildScheduleSignature, getRequestErrorMessage } from '../groupDataUtils';

export const useScheduleSync = ({
  apiClient,
  activeGroupId,
  activeGroupIdRef,
  applyScheduleToGroups,
  showError,
  showWarning
}) => {
  const [groupSchedules, setGroupSchedules] = useState([]);

  const scheduleSaveRef = useRef(null);
  const scheduleSaveTokenRef = useRef(0);
  const scheduleSignatureRef = useRef('');
  const scheduleRevisionRef = useRef({});
  const lastServerSchedulesRef = useRef({});

  const applyScheduleSync = useCallback((groupId, schedules) => {
    const nextSchedules = Array.isArray(schedules) ? schedules : [];
    setGroupSchedules(nextSchedules);
    scheduleSignatureRef.current = buildScheduleSignature(nextSchedules);
    if (groupId) {
      applyScheduleToGroups?.(groupId, nextSchedules);
    }
  }, [applyScheduleToGroups]);

  const fetchSchedules = useCallback(async (groupId) => {
    if (!groupId) {
      setGroupSchedules([]);
      scheduleSignatureRef.current = '';
      return;
    }
    try {
      const response = await apiClient.get(`/groups/${groupId}/schedules`);
      const nextSchedules = Array.isArray(response.data) ? response.data : [];
      const revisionHeader = response.headers?.['x-schedule-revision'];
      const nextRevision = Number(revisionHeader);
      scheduleRevisionRef.current[groupId] = Number.isFinite(nextRevision) ? nextRevision : 0;
      lastServerSchedulesRef.current[groupId] = nextSchedules;
      applyScheduleSync(groupId, nextSchedules);
    } catch (error) {
      showError(GROUP_MESSAGES.loadSchedulesFailed);
      setGroupSchedules([]);
      scheduleSignatureRef.current = '';
      scheduleRevisionRef.current[groupId] = 0;
      lastServerSchedulesRef.current[groupId] = [];
    }
  }, [apiClient, applyScheduleSync, showError]);

  const queueScheduleSave = useCallback((groupId, scheduleList) => {
    clearTimeout(scheduleSaveRef.current);
    scheduleSaveTokenRef.current += 1;
    const saveToken = scheduleSaveTokenRef.current;
    scheduleSaveRef.current = setTimeout(async () => {
      try {
        const response = await apiClient.post(`/groups/${groupId}/schedules/batch`, {
          scheduleList,
          revision: scheduleRevisionRef.current[groupId] ?? 0
        });
        if (saveToken !== scheduleSaveTokenRef.current) return;
        const saved = Array.isArray(response.data) ? response.data : scheduleList;
        const revisionHeader = response.headers?.['x-schedule-revision'];
        const nextRevision = Number(revisionHeader);
        if (Number.isFinite(nextRevision)) {
          scheduleRevisionRef.current[groupId] = nextRevision;
        }
        lastServerSchedulesRef.current[groupId] = saved;
        if (isSameGroupId(activeGroupIdRef.current, groupId)) {
          applyScheduleSync(groupId, saved);
        }
      } catch (error) {
        if (error?.response?.status === 409) {
          const revisionHeader = error.response?.headers?.['x-schedule-revision'];
          const nextRevision = Number(revisionHeader);
          if (Number.isFinite(nextRevision)) {
            scheduleRevisionRef.current[groupId] = nextRevision;
          }
          showWarning(GROUP_MESSAGES.scheduleConflict);
          fetchSchedules(groupId);
          return;
        }
        const rollbackSchedules = lastServerSchedulesRef.current[groupId];
        if (isSameGroupId(activeGroupIdRef.current, groupId) && Array.isArray(rollbackSchedules)) {
          applyScheduleSync(groupId, rollbackSchedules);
        }
        showError(getRequestErrorMessage(error, GROUP_MESSAGES.saveScheduleFailed));
      }
    }, DEBOUNCE_MS.scheduleSave);
  }, [activeGroupIdRef, apiClient, applyScheduleSync, fetchSchedules, showError, showWarning]);

  const saveSchedulesIfChanged = useCallback((groupId, scheduleList) => {
    if (!groupId) return false;
    const nextSignature = buildScheduleSignature(scheduleList);
    if (nextSignature === scheduleSignatureRef.current) {
      return false;
    }
    scheduleSignatureRef.current = nextSignature;
    queueScheduleSave(groupId, scheduleList);
    return true;
  }, [queueScheduleSave]);

  const handleScheduleUpdate = useCallback((updatedSchedules) => {
    applyScheduleSync(activeGroupIdRef.current, updatedSchedules);
  }, [activeGroupIdRef, applyScheduleSync]);

  const scheduleRevision = activeGroupId
    ? (scheduleRevisionRef.current[activeGroupId] ?? 0)
    : 0;

  const handleRevisionChange = useCallback((nextRevision) => {
    const currentGroupId = activeGroupIdRef.current;
    if (!currentGroupId) return;
    if (Number.isFinite(nextRevision)) {
      scheduleRevisionRef.current[currentGroupId] = nextRevision;
    }
  }, [activeGroupIdRef]);

  const handleRevisionConflict = useCallback(() => {
    const currentGroupId = activeGroupIdRef.current;
    if (currentGroupId) {
      fetchSchedules(currentGroupId);
    }
  }, [activeGroupIdRef, fetchSchedules]);

  useEffect(() => (
    () => {
      clearTimeout(scheduleSaveRef.current);
    }
  ), []);

  return {
    groupSchedules,
    setGroupSchedules,
    fetchSchedules,
    handleScheduleUpdate,
    saveSchedulesIfChanged,
    scheduleRevision,
    handleRevisionChange,
    handleRevisionConflict
  };
};
