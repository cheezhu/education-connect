import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import api from '../../../services/api';
import {
  buildScheduleSignature,
  diffGroupUpdatePayload,
  getRequestErrorMessage,
  mergeCustomResources,
  mergeSchedulesWithLogistics,
  pickGroupUpdateFields,
  syncLogisticsFromSchedules
} from '../groupDataUtils';
import {
  DEBOUNCE_MS,
  GROUP_MESSAGES,
  QUICK_CREATE_DEFAULTS,
  isSameGroupId,
  normalizeGroupId,
  toTimestamp
} from '../constants';

const createBulkRow = () => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  type: '',
  start_date: '',
  end_date: '',
  participant_count: 44
});

export const sortAndFilterGroups = (groups = [], searchText = '') => {
  let filtered = [...groups];
  const normalizedSearch = String(searchText || '').trim().toLowerCase();

  if (normalizedSearch) {
    filtered = filtered.filter((group) => (
      (group.name || '').toLowerCase().includes(normalizedSearch)
      || (group.group_code || '').toLowerCase().includes(normalizedSearch)
      || (group.contact_person || '').toLowerCase().includes(normalizedSearch)
      || (group.contact_phone || '').toLowerCase().includes(normalizedSearch)
    ));
  }

  filtered.sort((a, b) => {
    const aCreated = toTimestamp(a.created_at);
    const bCreated = toTimestamp(b.created_at);
    if (aCreated !== null && bCreated !== null && aCreated !== bCreated) return bCreated - aCreated;
    if (aCreated === null && bCreated !== null) return 1;
    if (aCreated !== null && bCreated === null) return -1;

    const aStart = toTimestamp(a.start_date);
    const bStart = toTimestamp(b.start_date);
    if (aStart !== null && bStart !== null && aStart !== bStart) return bStart - aStart;
    if (aStart === null && bStart !== null) return 1;
    if (aStart !== null && bStart === null) return -1;

    return Number(b.id || 0) - Number(a.id || 0);
  });

  return filtered;
};

export const useGroupData = ({ apiClient = api, notify = null } = {}) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [groupSchedules, setGroupSchedules] = useState([]);
  const [hasMembers, setHasMembers] = useState(false);
  const [itineraryPlans, setItineraryPlans] = useState([]);
  const [locations, setLocations] = useState([]);
  const [rightPanelWidth, setRightPanelWidth] = useState(260);
  const [filters, setFilters] = useState({ searchText: '' });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkRows, setBulkRows] = useState(() => [createBulkRow()]);
  const [bulkErrors, setBulkErrors] = useState({});

  const saveRef = useRef(null);
  const scheduleSaveRef = useRef(null);
  const scheduleSaveTokenRef = useRef(0);
  const logisticsSaveRef = useRef(null);
  const logisticsSaveTokenRef = useRef(0);
  const scheduleSignatureRef = useRef('');
  const scheduleSnapshotRef = useRef([]);
  const scheduleRevisionRef = useRef({});
  const groupSnapshotRef = useRef(new Map());
  const activeGroupIdRef = useRef(null);

  const showSuccess = useCallback((text) => {
    notify?.success?.(text);
  }, [notify]);

  const showError = useCallback((text) => {
    notify?.error?.(text);
  }, [notify]);

  const showWarning = useCallback((text) => {
    notify?.warning?.(text);
  }, [notify]);

  const calculateStatus = useCallback((group) => {
    if (group.status === '已取消') return '已取消';
    const today = dayjs();
    const startDate = dayjs(group.start_date);
    const endDate = dayjs(group.end_date);
    if (today.isBefore(startDate)) return '准备中';
    if (today.isAfter(endDate)) return '已完成';
    return '进行中';
  }, []);

  const queueLogisticsSave = useCallback((groupId, logisticsList) => {
    if (!groupId) return;
    clearTimeout(logisticsSaveRef.current);
    logisticsSaveTokenRef.current += 1;
    const saveToken = logisticsSaveTokenRef.current;
    logisticsSaveRef.current = setTimeout(async () => {
      try {
        const response = await apiClient.post(`/groups/${groupId}/logistics`, {
          logistics: logisticsList
        });
        if (saveToken !== logisticsSaveTokenRef.current) return;
        const saved = Array.isArray(response.data) ? response.data : logisticsList;
        if (isSameGroupId(activeGroupIdRef.current, groupId)) {
          setGroups((prev) => prev.map((group) => (
            isSameGroupId(group.id, groupId) ? { ...group, logistics: saved } : group
          )));
        }
      } catch (error) {
        showError(getRequestErrorMessage(error, GROUP_MESSAGES.saveLogisticsFailed));
      }
    }, DEBOUNCE_MS.logisticsSave);
  }, [apiClient, showError]);

  const applyScheduleSync = useCallback((groupId, schedules) => {
    setGroupSchedules(schedules);
    scheduleSignatureRef.current = buildScheduleSignature(schedules);
    scheduleSnapshotRef.current = schedules;
    if (!groupId) return;
    let nextLogisticsSnapshot = null;
    setGroups((prev) => prev.map((group) => {
      if (!isSameGroupId(group.id, groupId)) return group;
      const nextLogistics = syncLogisticsFromSchedules(group.logistics || [], schedules);
      nextLogisticsSnapshot = nextLogistics;
      const nextCustomResources = mergeCustomResources(group.customResources || [], schedules);
      return {
        ...group,
        logistics: nextLogistics,
        customResources: nextCustomResources
      };
    }));
    if (nextLogisticsSnapshot) {
      queueLogisticsSave(groupId, nextLogisticsSnapshot);
    }
  }, [queueLogisticsSave]);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/groups');
      const enhancedGroups = (response.data || []).map((group) => ({
        ...group,
        status: group.status ?? calculateStatus(group)
      }));
      const nextSnapshots = new Map(groupSnapshotRef.current);
      enhancedGroups.forEach((group) => {
        nextSnapshots.set(group.id, pickGroupUpdateFields(group));
      });
      groupSnapshotRef.current = nextSnapshots;
      setGroups(enhancedGroups);
    } catch (error) {
      showError(GROUP_MESSAGES.loadGroupsFailed);
    } finally {
      setLoading(false);
    }
  }, [apiClient, calculateStatus, showError]);

  const fetchSchedules = useCallback(async (groupId) => {
    if (!groupId) {
      setGroupSchedules([]);
      return;
    }
    try {
      const response = await apiClient.get(`/groups/${groupId}/schedules`);
      const nextSchedules = Array.isArray(response.data) ? response.data : [];
      const revisionHeader = response.headers?.['x-schedule-revision'];
      const nextRevision = Number(revisionHeader);
      scheduleRevisionRef.current[groupId] = Number.isFinite(nextRevision) ? nextRevision : 0;
      applyScheduleSync(groupId, nextSchedules);
    } catch (error) {
      showError(GROUP_MESSAGES.loadSchedulesFailed);
      setGroupSchedules([]);
      scheduleRevisionRef.current[groupId] = 0;
    }
  }, [apiClient, applyScheduleSync, showError]);

  const fetchLogistics = useCallback(async (groupId) => {
    if (!groupId) return;
    try {
      const response = await apiClient.get(`/groups/${groupId}/logistics`);
      const logistics = Array.isArray(response.data) ? response.data : [];
      setGroups((prev) => prev.map((group) => (
        isSameGroupId(group.id, groupId) ? { ...group, logistics } : group
      )));
    } catch (error) {
      showError(GROUP_MESSAGES.loadLogisticsFailed);
    }
  }, [apiClient, showError]);

  const fetchItineraryPlans = useCallback(async () => {
    try {
      const response = await apiClient.get('/itinerary-plans');
      setItineraryPlans(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setItineraryPlans([]);
    }
  }, [apiClient]);

  const fetchLocations = useCallback(async () => {
    try {
      const response = await apiClient.get('/locations');
      setLocations(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setLocations([]);
    }
  }, [apiClient]);

  const fetchMemberCount = useCallback(async (groupId) => {
    if (!groupId) {
      setHasMembers(false);
      return;
    }
    try {
      const response = await apiClient.get(`/groups/${groupId}/members`);
      const count = Array.isArray(response.data) ? response.data.length : 0;
      setHasMembers(count > 0);
    } catch (error) {
      setHasMembers(false);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchGroups();
    fetchItineraryPlans();
    fetchLocations();
  }, [fetchGroups, fetchItineraryPlans, fetchLocations]);

  const filteredGroups = useMemo(() => (
    sortAndFilterGroups(groups, filters.searchText)
  ), [groups, filters.searchText]);

  useEffect(() => {
    if (activeGroupId === null || activeGroupId === undefined) return;
    const stillExists = groups.some((group) => isSameGroupId(group.id, activeGroupId));
    if (!stillExists) {
      setActiveGroupId(null);
    }
  }, [groups, activeGroupId]);

  useEffect(() => {
    activeGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

  useEffect(() => {
    if (!activeGroupId) return;
    const loadAll = async () => {
      await fetchLogistics(activeGroupId);
      await fetchSchedules(activeGroupId);
      fetchMemberCount(activeGroupId);
    };
    loadAll();
  }, [activeGroupId, fetchLogistics, fetchSchedules, fetchMemberCount]);

  useEffect(() => {
    scheduleSnapshotRef.current = [];
  }, [activeGroupId]);

  useEffect(() => (
    () => {
      clearTimeout(saveRef.current);
      clearTimeout(scheduleSaveRef.current);
      clearTimeout(logisticsSaveRef.current);
    }
  ), []);

  const activeGroup = useMemo(() => (
    groups.find((group) => isSameGroupId(group.id, activeGroupId)) || null
  ), [groups, activeGroupId]);

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
        showError(getRequestErrorMessage(error, GROUP_MESSAGES.saveScheduleFailed));
      }
    }, DEBOUNCE_MS.scheduleSave);
  }, [apiClient, applyScheduleSync, fetchSchedules, showError, showWarning]);

  const handleScheduleUpdate = useCallback((updatedSchedules) => {
    applyScheduleSync(activeGroupIdRef.current, updatedSchedules);
  }, [applyScheduleSync]);

  const handleGroupUpdate = useCallback((updatedGroup) => {
    if (!updatedGroup?.id) return;
    const updatedGroupId = normalizeGroupId(updatedGroup.id);
    const optimisticUiGroup = {
      ...updatedGroup,
      id: updatedGroupId,
      status: updatedGroup.status ?? calculateStatus(updatedGroup)
    };

    setGroups((prev) => prev.map((group) => (
      isSameGroupId(group.id, updatedGroupId) ? { ...group, ...optimisticUiGroup } : group
    )));

    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      try {
        const nextPayload = pickGroupUpdateFields(updatedGroup);
        const baselinePayload = groupSnapshotRef.current.get(updatedGroupId) || {};
        const payload = diffGroupUpdatePayload(nextPayload, baselinePayload);
        if (Object.keys(payload).length === 0) return;
        const response = await apiClient.put(`/groups/${updatedGroupId}`, payload);
        if (response.data?.group) {
          const returnedGroup = response.data.group;
          const normalizedReturnedGroup = {
            ...returnedGroup,
            id: normalizeGroupId(returnedGroup.id),
            status: returnedGroup.status ?? calculateStatus(returnedGroup)
          };
          groupSnapshotRef.current.set(
            updatedGroupId,
            pickGroupUpdateFields(normalizedReturnedGroup)
          );
          setGroups((prev) => prev.map((group) => {
            if (!isSameGroupId(group.id, updatedGroupId)) return group;
            const preservedProps = updatedGroup.properties ?? group.properties;
            const preservedLogistics = updatedGroup.logistics ?? group.logistics;
            return {
              ...group,
              ...normalizedReturnedGroup,
              properties: preservedProps,
              logistics: preservedLogistics
            };
          }));
        } else {
          groupSnapshotRef.current.set(updatedGroupId, { ...baselinePayload, ...payload });
        }
      } catch (error) {
        showError(getRequestErrorMessage(error, GROUP_MESSAGES.saveFailed));
      }
    }, 0);
  }, [apiClient, calculateStatus, showError]);

  const handleLogisticsChange = useCallback((updatedGroup) => {
    if (!updatedGroup?.id) return;
    const updatedGroupId = normalizeGroupId(updatedGroup.id);

    setGroupSchedules((prev) => {
      const merged = mergeSchedulesWithLogistics(prev, updatedGroup.logistics || [], updatedGroupId);
      const syncedLogistics = syncLogisticsFromSchedules(updatedGroup.logistics || [], merged);
      setGroups((prevGroups) => prevGroups.map((group) => (
        isSameGroupId(group.id, updatedGroupId)
          ? { ...group, ...updatedGroup, id: updatedGroupId, logistics: syncedLogistics }
          : group
      )));
      queueLogisticsSave(updatedGroupId, syncedLogistics);
      const nextSignature = buildScheduleSignature(merged);
      if (nextSignature !== scheduleSignatureRef.current) {
        scheduleSignatureRef.current = nextSignature;
        queueScheduleSave(updatedGroupId, merged);
        return merged;
      }
      return prev;
    });
  }, [queueLogisticsSave, queueScheduleSave]);

  const handleDeleteGroup = useCallback(async () => {
    if (!activeGroup) return;
    try {
      await apiClient.delete(`/groups/${activeGroup.id}`);
      showSuccess(GROUP_MESSAGES.groupDeleted);
      fetchGroups();
    } catch (error) {
      showError(getRequestErrorMessage(error, GROUP_MESSAGES.groupDeleteFailed));
    }
  }, [activeGroup, apiClient, fetchGroups, showError, showSuccess]);

  const handleSelectGroup = useCallback((groupId) => {
    setActiveGroupId(normalizeGroupId(groupId));
  }, []);

  const updateSearch = useCallback((value) => {
    setFilters((prev) => ({ ...prev, searchText: value }));
  }, []);

  const handleQuickCreateGroup = useCallback(async () => {
    const startDate = dayjs().format('YYYY-MM-DD');
    const endDate = dayjs().add(QUICK_CREATE_DEFAULTS.durationDays - 1, 'day').format('YYYY-MM-DD');
    const payload = {
      name: QUICK_CREATE_DEFAULTS.name,
      type: QUICK_CREATE_DEFAULTS.type,
      student_count: QUICK_CREATE_DEFAULTS.studentCount,
      teacher_count: QUICK_CREATE_DEFAULTS.teacherCount,
      start_date: startDate,
      end_date: endDate
    };

    try {
      const response = await apiClient.post('/groups', payload);
      const created = response.data?.group;
      if (!created?.id) {
        await fetchGroups();
        showSuccess(GROUP_MESSAGES.groupCreated);
        return;
      }
      const normalizedCreated = {
        ...created,
        id: normalizeGroupId(created.id),
        status: created.status ?? calculateStatus(created)
      };
      groupSnapshotRef.current.set(
        normalizedCreated.id,
        pickGroupUpdateFields(normalizedCreated)
      );
      setGroups((prev) => {
        const next = prev.filter((group) => !isSameGroupId(group.id, normalizedCreated.id));
        return [normalizedCreated, ...next];
      });
      setFilters((prev) => ({ ...prev, searchText: '' }));
      setActiveGroupId(normalizeGroupId(normalizedCreated.id));
      showSuccess(GROUP_MESSAGES.groupCreated);
    } catch (error) {
      showError(getRequestErrorMessage(error, GROUP_MESSAGES.groupCreateFailed));
    }
  }, [apiClient, calculateStatus, fetchGroups, showError, showSuccess]);

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
      showError(`请完善第 ${firstInvalid} 行信息`);
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
      showSuccess(`已创建 ${createdCount} 个团组`);
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

  const handleCalendarLogisticsUpdate = useCallback((nextLogistics) => {
    const currentGroupId = activeGroupIdRef.current;
    if (!currentGroupId || !Array.isArray(nextLogistics)) return;
    setGroups((prev) => prev.map((group) => (
      isSameGroupId(group.id, currentGroupId) ? { ...group, logistics: nextLogistics } : group
    )));
    queueLogisticsSave(currentGroupId, nextLogistics);
  }, [queueLogisticsSave]);

  const handleCustomResourcesChange = useCallback((nextCustomResources) => {
    const currentGroupId = activeGroupIdRef.current;
    if (!currentGroupId) return;
    setGroups((prev) => prev.map((group) => (
      isSameGroupId(group.id, currentGroupId) ? { ...group, customResources: nextCustomResources } : group
    )));
  }, []);

  const scheduleRevision = activeGroupId
    ? (scheduleRevisionRef.current[activeGroupId] ?? 0)
    : 0;

  const handleRevisionChange = useCallback((nextRevision) => {
    const currentGroupId = activeGroupIdRef.current;
    if (!currentGroupId) return;
    if (Number.isFinite(nextRevision)) {
      scheduleRevisionRef.current[currentGroupId] = nextRevision;
    }
  }, []);

  const handleRevisionConflict = useCallback(() => {
    const currentGroupId = activeGroupIdRef.current;
    if (currentGroupId) {
      fetchSchedules(currentGroupId);
    }
  }, [fetchSchedules]);

  const getActiveGroupId = useCallback(() => activeGroupIdRef.current, []);

  return {
    groups,
    filteredGroups,
    loading,
    activeGroupId,
    activeGroup,
    groupSchedules,
    hasMembers,
    itineraryPlans,
    locations,
    rightPanelWidth,
    filters,
    bulkOpen,
    bulkSubmitting,
    bulkRows,
    bulkErrors,
    scheduleRevision,
    setRightPanelWidth,
    setBulkOpen,
    handleSelectGroup,
    handleGroupUpdate,
    handleScheduleUpdate,
    handleLogisticsChange,
    handleDeleteGroup,
    handleQuickCreateGroup,
    updateSearch,
    addBulkRow,
    removeBulkRow,
    updateBulkRow,
    resetBulkForm,
    handleBulkCreate,
    handleCalendarLogisticsUpdate,
    handleCustomResourcesChange,
    handleRevisionChange,
    handleRevisionConflict,
    fetchGroups,
    fetchItineraryPlans,
    fetchLocations,
    fetchLogistics,
    fetchSchedules,
    fetchMemberCount,
    getActiveGroupId
  };
};
