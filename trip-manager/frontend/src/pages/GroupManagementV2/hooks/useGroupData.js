import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import api from '../../../services/api';
import {
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
import { useBulkCreate } from './useBulkCreate';
import { useScheduleSync } from './useScheduleSync';

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
  const [hasMembers, setHasMembers] = useState(false);
  const [itineraryPlans, setItineraryPlans] = useState([]);
  const [locations, setLocations] = useState([]);
  const [rightPanelWidth, setRightPanelWidth] = useState(260);

  const saveRef = useRef(null);
  const logisticsSaveRef = useRef(null);
  const logisticsSaveTokenRef = useRef(0);
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
    if (group.status === '\u5df2\u53d6\u6d88') return '\u5df2\u53d6\u6d88';
    const today = dayjs();
    const startDate = dayjs(group.start_date);
    const endDate = dayjs(group.end_date);
    if (today.isBefore(startDate)) return '\u51c6\u5907\u4e2d';
    if (today.isAfter(endDate)) return '\u5df2\u5b8c\u6210';
    return '\u8fdb\u884c\u4e2d';
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

  const applyScheduleToGroups = useCallback((groupId, schedules) => {
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

  const {
    groupSchedules,
    setGroupSchedules,
    fetchSchedules,
    handleScheduleUpdate,
    saveSchedulesIfChanged,
    scheduleRevision,
    handleRevisionChange,
    handleRevisionConflict
  } = useScheduleSync({
    apiClient,
    activeGroupId,
    activeGroupIdRef,
    applyScheduleToGroups,
    showError,
    showWarning
  });

  useEffect(() => {
    fetchGroups();
    fetchItineraryPlans();
    fetchLocations();
  }, [fetchGroups, fetchItineraryPlans, fetchLocations]);

  const filteredGroups = useMemo(() => (
    // Sidebar filter is disabled by design: always show all groups in latest-first order.
    sortAndFilterGroups(groups, '')
  ), [groups]);

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

  useEffect(() => (
    () => {
      clearTimeout(saveRef.current);
      clearTimeout(logisticsSaveRef.current);
    }
  ), []);

  const activeGroup = useMemo(() => (
    groups.find((group) => isSameGroupId(group.id, activeGroupId)) || null
  ), [groups, activeGroupId]);

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
      if (saveSchedulesIfChanged(updatedGroupId, merged)) {
        return merged;
      }
      return prev;
    });
  }, [queueLogisticsSave, saveSchedulesIfChanged, setGroupSchedules]);

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
      setActiveGroupId(normalizeGroupId(normalizedCreated.id));
      showSuccess(GROUP_MESSAGES.groupCreated);
    } catch (error) {
      showError(getRequestErrorMessage(error, GROUP_MESSAGES.groupCreateFailed));
    }
  }, [apiClient, calculateStatus, fetchGroups, showError, showSuccess]);

  const {
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
  } = useBulkCreate({
    apiClient,
    fetchGroups,
    showSuccess,
    showError
  });

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

