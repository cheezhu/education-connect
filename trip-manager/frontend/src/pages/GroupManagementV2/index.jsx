import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { subscribeRealtimeChanges } from '../../services/realtime';
import GroupList from './components/Sidebar/GroupList';
import TabBar from './components/Detail/TabBar';
import ProfileView from './components/Detail/ProfileView';
import FullCalendarWrapper from './components/Detail/FullCalendarWrapper';
import LogisticsView from './components/Detail/Logistics/LogisticsView';
import ItineraryTextDetail from './components/Detail/ItineraryTextDetail';
import HelpView from './components/Detail/HelpView';
import BulkCreateModal from './components/Modals/BulkCreateModal';
import MembersView from './components/Detail/MembersView';
import GroupCommandCenterSkeleton from './components/GroupCommandCenterSkeleton';
import {
  buildScheduleSignature,
  createEmptyLogisticsRow,
  diffGroupUpdatePayload,
  getRequestErrorMessage,
  mergeCustomResources,
  mergeSchedulesWithLogistics,
  pickGroupUpdateFields,
  syncLogisticsFromSchedules
} from './groupDataUtils';
import './GroupCommandCenter.css';

class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) {
      this.props.onError(error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-state">
          {this.props.fallback || '当前标签页渲染失败，请检查控制台错误。'}
        </div>
      );
    }
    return this.props.children;
  }
}

const TAB_KEYS = new Set(['profile', 'logistics', 'schedule', 'itinerary', 'members', 'help']);

const GroupManagementV2 = () => {
  const toGroupIdKey = (value) => String(value ?? '');
  const normalizeGroupId = (value) => {
    const numericId = Number(value);
    return Number.isFinite(numericId) ? numericId : value;
  };
  const isSameGroupId = (left, right) => {
    const leftKey = toGroupIdKey(left);
    const rightKey = toGroupIdKey(right);
    return leftKey !== '' && leftKey === rightKey;
  };

  const location = useLocation();
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [groupSchedules, setGroupSchedules] = useState([]);
  const [hasMembers, setHasMembers] = useState(false);
  const [itineraryPlans, setItineraryPlans] = useState([]);
  const [locations, setLocations] = useState([]);
  const [rightPanelWidth, setRightPanelWidth] = useState(260);

  const [filters, setFilters] = useState({
    searchText: ''
  });

  const createBulkRow = () => ({
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    type: '',
    start_date: '',
    end_date: '',
    participant_count: 44
  });

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkRows, setBulkRows] = useState(() => [createBulkRow()]);
  const [bulkErrors, setBulkErrors] = useState({});
  const handleSelectGroup = useCallback((groupId) => {
    setActiveGroupId(normalizeGroupId(groupId));
  }, []);

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
  const fetchGroupsRef = useRef(null);
  const fetchSchedulesRef = useRef(null);
  const fetchLogisticsRef = useRef(null);
  const fetchMemberCountRef = useRef(null);
  const fetchPlansRef = useRef(null);
  const fetchLocationsRef = useRef(null);
  const realtimePendingPathsRef = useRef(new Set());
  const realtimeFlushTimerRef = useRef(null);

  const calculateStatus = (group) => {
    if (group.status === '已取消') return '已取消';
    const today = dayjs();
    const startDate = dayjs(group.start_date);
    const endDate = dayjs(group.end_date);

    if (today.isBefore(startDate)) return '准备中';
    if (today.isAfter(endDate)) return '已完成';
    return '进行中';
  };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await api.get('/groups');
      const enhancedGroups = (response.data || []).map(group => ({
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
      message.error('加载团组数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async (groupId) => {
    if (!groupId) {
      setGroupSchedules([]);
      return;
    }
    try {
      const response = await api.get(`/groups/${groupId}/schedules`);
      const nextSchedules = Array.isArray(response.data) ? response.data : [];
      const revisionHeader = response.headers?.['x-schedule-revision'];
      const nextRevision = Number(revisionHeader);
      scheduleRevisionRef.current[groupId] = Number.isFinite(nextRevision) ? nextRevision : 0;
      handleScheduleUpdate(nextSchedules);
    } catch (error) {
      message.error('加载日程失败');
      setGroupSchedules([]);
      scheduleRevisionRef.current[groupId] = 0;
    }
  };

  const fetchLogistics = async (groupId) => {
    if (!groupId) return;
    try {
      const response = await api.get(`/groups/${groupId}/logistics`);
      const logistics = Array.isArray(response.data) ? response.data : [];
      setGroups(prev => prev.map(group => (
        isSameGroupId(group.id, groupId) ? { ...group, logistics } : group
      )));
    } catch (error) {
      message.error('加载食行卡片失败');
    }
  };

  const fetchItineraryPlans = async () => {
    try {
      const response = await api.get('/itinerary-plans');
      setItineraryPlans(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setItineraryPlans([]);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await api.get('/locations');
      setLocations(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setLocations([]);
    }
  };

  const fetchMemberCount = async (groupId) => {
    if (!groupId) {
      setHasMembers(false);
      return;
    }
    try {
      const response = await api.get(`/groups/${groupId}/members`);
      const count = Array.isArray(response.data) ? response.data.length : 0;
      setHasMembers(count > 0);
    } catch (error) {
      setHasMembers(false);
    }
  };

  fetchGroupsRef.current = fetchGroups;
  fetchSchedulesRef.current = fetchSchedules;
  fetchLogisticsRef.current = fetchLogistics;
  fetchMemberCountRef.current = fetchMemberCount;
  fetchPlansRef.current = fetchItineraryPlans;
  fetchLocationsRef.current = fetchLocations;

  useEffect(() => {
    fetchGroups();
    fetchItineraryPlans();
    fetchLocations();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && TAB_KEYS.has(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  useEffect(() => {
    let filtered = [...groups];

    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(group =>
        (group.name || '').toLowerCase().includes(searchLower) ||
        (group.group_code || '').toLowerCase().includes(searchLower) ||
        (group.contact_person || '').toLowerCase().includes(searchLower) ||
        (group.contact_phone || '').toLowerCase().includes(searchLower)
      );
    }

    const toTs = (value) => {
      if (!value) return null;
      const parsed = dayjs(value);
      if (!parsed.isValid()) return null;
      return parsed.valueOf();
    };

    filtered.sort((a, b) => {
      // Default order: start_date desc (latest first).
      const aStart = toTs(a.start_date);
      const bStart = toTs(b.start_date);
      if (aStart !== null && bStart !== null && aStart !== bStart) return bStart - aStart;
      if (aStart === null && bStart !== null) return 1;
      if (aStart !== null && bStart === null) return -1;

      // Tie-breakers: created_at desc, then id desc.
      const aCreated = toTs(a.created_at);
      const bCreated = toTs(b.created_at);
      if (aCreated !== null && bCreated !== null && aCreated !== bCreated) return bCreated - aCreated;
      return Number(b.id || 0) - Number(a.id || 0);
    });

    setFilteredGroups(filtered);
  }, [filters, groups]);

  // Keep active selection stable across filter changes.
  // Only clear it when the group truly no longer exists in source data (e.g. deleted).
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
  }, [activeGroupId]);

  useEffect(() => {
    const flushRealtimeRefresh = async () => {
      realtimeFlushTimerRef.current = null;
      const paths = Array.from(realtimePendingPathsRef.current);
      realtimePendingPathsRef.current.clear();
      if (paths.length === 0) return;

      const hasGroupChange = paths.some((path) => path.startsWith('/api/groups'));
      const hasPlanChange = paths.some((path) => path.startsWith('/api/itinerary-plans'));
      const hasLocationChange = paths.some((path) => path.startsWith('/api/locations'));
      const hasScheduleOrLogisticsChange = paths.some((path) => (
        path.includes('/schedules')
        || path.includes('/logistics')
        || path.includes('/activities')
        || path.startsWith('/api/groups')
      ));
      const hasMemberChange = paths.some((path) => path.includes('/members'));

      if (hasGroupChange) {
        await fetchGroupsRef.current?.();
      }
      if (hasPlanChange) {
        await fetchPlansRef.current?.();
      }
      if (hasLocationChange) {
        await fetchLocationsRef.current?.();
      }

      const currentGroupId = activeGroupIdRef.current;
      if (!currentGroupId) return;

      if (hasScheduleOrLogisticsChange) {
        await fetchLogisticsRef.current?.(currentGroupId);
        await fetchSchedulesRef.current?.(currentGroupId);
      }
      if (hasMemberChange || hasGroupChange) {
        await fetchMemberCountRef.current?.(currentGroupId);
      }
    };

    const queueRealtimeRefresh = (path) => {
      if (!path) return;
      realtimePendingPathsRef.current.add(path);
      if (realtimeFlushTimerRef.current) return;
      realtimeFlushTimerRef.current = setTimeout(() => {
        void flushRealtimeRefresh();
      }, 280);
    };

    const unsubscribe = subscribeRealtimeChanges({
      onChange: (change) => {
        queueRealtimeRefresh(change?.path || '');
      }
    });

    return () => {
      unsubscribe();
      if (realtimeFlushTimerRef.current) {
        clearTimeout(realtimeFlushTimerRef.current);
        realtimeFlushTimerRef.current = null;
      }
      realtimePendingPathsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    scheduleSnapshotRef.current = [];
  }, [activeGroupId]);

  const activeGroup = useMemo(() => (
    groups.find(group => isSameGroupId(group.id, activeGroupId)) || null
  ), [groups, activeGroupId]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleExpandSidebar = () => {
    setIsSidebarCollapsed(false);
  };

  const handleCollapseSidebar = () => {
    setIsSidebarCollapsed(true);
  };

  const queueLogisticsSave = useCallback((groupId, logisticsList) => {
    if (!groupId) return;
    clearTimeout(logisticsSaveRef.current);
    logisticsSaveTokenRef.current += 1;
    const saveToken = logisticsSaveTokenRef.current;
    logisticsSaveRef.current = setTimeout(async () => {
      try {
        const response = await api.post(`/groups/${groupId}/logistics`, {
          logistics: logisticsList
        });
        if (saveToken !== logisticsSaveTokenRef.current) {
          return;
        }
        const saved = Array.isArray(response.data) ? response.data : logisticsList;
        if (isSameGroupId(activeGroupId, groupId)) {
          setGroups(prev => prev.map(group => (
            isSameGroupId(group.id, groupId) ? { ...group, logistics: saved } : group
          )));
        }
      } catch (error) {
        message.error(getRequestErrorMessage(error, '保存食行卡片失败'));
      }
    }, 400);
  }, [activeGroupId]);

  const applyScheduleSync = useCallback((schedules) => {
    setGroupSchedules(schedules);
    scheduleSignatureRef.current = buildScheduleSignature(schedules);
    scheduleSnapshotRef.current = schedules;
    if (!activeGroupId) return;
    let nextLogisticsSnapshot = null;
    setGroups(prev => prev.map(group => {
      if (!isSameGroupId(group.id, activeGroupId)) return group;
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
      queueLogisticsSave(activeGroupId, nextLogisticsSnapshot);
    }
  }, [activeGroupId, queueLogisticsSave]);

  const handleGroupUpdate = useCallback((updatedGroup) => {
    if (!updatedGroup?.id) return;
    const updatedGroupId = normalizeGroupId(updatedGroup.id);
    const optimisticUiGroup = {
      ...updatedGroup,
      id: updatedGroupId,
      status: updatedGroup.status ?? calculateStatus(updatedGroup)
    };

    setGroups(prev => prev.map(group => (
      isSameGroupId(group.id, updatedGroupId) ? { ...group, ...optimisticUiGroup } : group
    )));

    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      try {
        const nextPayload = pickGroupUpdateFields(updatedGroup);
        const baselinePayload = groupSnapshotRef.current.get(updatedGroupId) || {};
        const payload = diffGroupUpdatePayload(nextPayload, baselinePayload);
        if (Object.keys(payload).length === 0) {
          return;
        }
        const response = await api.put(`/groups/${updatedGroupId}`, payload);
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
          setGroups(prev => prev.map(group => {
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
        message.error(getRequestErrorMessage(error, '保存失败'));
      }
    }, 0);
  }, []);

  const queueScheduleSave = useCallback((groupId, scheduleList) => {
    clearTimeout(scheduleSaveRef.current);
    scheduleSaveTokenRef.current += 1;
    const saveToken = scheduleSaveTokenRef.current;
    scheduleSaveRef.current = setTimeout(async () => {
      try {
        const response = await api.post(`/groups/${groupId}/schedules/batch`, {
          scheduleList,
          revision: scheduleRevisionRef.current[groupId] ?? 0
        });
        if (saveToken !== scheduleSaveTokenRef.current) {
          return;
        }
        const saved = Array.isArray(response.data) ? response.data : scheduleList;
        const revisionHeader = response.headers?.['x-schedule-revision'];
        const nextRevision = Number(revisionHeader);
        if (Number.isFinite(nextRevision)) {
          scheduleRevisionRef.current[groupId] = nextRevision;
        }
        if (isSameGroupId(activeGroupId, groupId)) {
          applyScheduleSync(saved);
        }
      } catch (error) {
        if (error?.response?.status === 409) {
          const revisionHeader = error.response?.headers?.['x-schedule-revision'];
          const nextRevision = Number(revisionHeader);
          if (Number.isFinite(nextRevision)) {
            scheduleRevisionRef.current[groupId] = nextRevision;
          }
          message.warning('日程已被其他人修改，请刷新后再试');
          fetchSchedules(groupId);
          return;
        }
        message.error(getRequestErrorMessage(error, '保存日程失败'));
      }
    }, 400);
  }, [activeGroupId, applyScheduleSync, fetchSchedules]);

  const handleLogisticsChange = useCallback((updatedGroup) => {
    if (!updatedGroup?.id) return;

    setGroupSchedules((prev) => {
      const merged = mergeSchedulesWithLogistics(prev, updatedGroup.logistics || [], updatedGroup.id);
      const syncedLogistics = syncLogisticsFromSchedules(updatedGroup.logistics || [], merged);
      setGroups(prevGroups => prevGroups.map(group => (
        isSameGroupId(group.id, updatedGroup.id)
          ? { ...group, ...updatedGroup, logistics: syncedLogistics }
          : group
      )));
      queueLogisticsSave(updatedGroup.id, syncedLogistics);
      const nextSignature = buildScheduleSignature(merged);
      if (nextSignature !== scheduleSignatureRef.current) {
        scheduleSignatureRef.current = nextSignature;
        queueScheduleSave(updatedGroup.id, merged);
        return merged;
      }
      return prev;
    });
  }, [queueScheduleSave, queueLogisticsSave]);

  const handleScheduleUpdate = useCallback((updatedSchedules) => {
    applyScheduleSync(updatedSchedules);
  }, [applyScheduleSync]);

  const handleDeleteGroup = async () => {
    if (!activeGroup) return;
    try {
      await api.delete(`/groups/${activeGroup.id}`);
      message.success('团组已删除');
      fetchGroups();
    } catch (error) {
      message.error(getRequestErrorMessage(error, '删除失败'));
    }
  };

  const updateSearch = (value) => {
    setFilters(prev => ({ ...prev, searchText: value }));
  };

  const addBulkRow = () => {
    setBulkRows(prev => [...prev, createBulkRow()]);
  };

  const removeBulkRow = (id) => {
    setBulkRows(prev => prev.filter(row => row.id !== id));
  };

  const updateBulkRow = (id, updates) => {
    setBulkRows(prev => prev.map(row => (row.id === id ? { ...row, ...updates } : row)));
    setBulkErrors(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const resetBulkForm = () => {
    setBulkRows([createBulkRow()]);
    setBulkErrors({});
  };

  const validateBulkRows = () => {
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
  };

  const handleBulkCreate = async () => {
    if (bulkRows.length === 0) {
      message.error('请先添加团组');
      return;
    }

    const { errors, firstInvalid } = validateBulkRows();
    if (firstInvalid) {
      setBulkErrors(errors);
      message.error(`请完善第 ${firstInvalid} 行信息`);
      return;
    }

    const groupsToCreate = bulkRows.map(row => ({
      name: row.name.trim(),
      type: row.type,
      student_count: Number(row.participant_count),
      teacher_count: 0,
      start_date: row.start_date,
      end_date: row.end_date
    }));

    setBulkSubmitting(true);
    try {
      const response = await api.post('/groups/batch', { groups: groupsToCreate });
      const createdCount = response.data?.count ?? groupsToCreate.length;
      message.success(`已创建 ${createdCount} 个团组`);
      setBulkOpen(false);
      resetBulkForm();
      fetchGroups();
    } catch (error) {
      const errorMessage = error?.response?.data?.message
        || error?.response?.data?.error
        || '批量创建失败';
      message.error(errorMessage);
    } finally {
      setBulkSubmitting(false);
    }
  };

  if (loading && groups.length === 0) {
    return <GroupCommandCenterSkeleton />;
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <ProfileView
            group={activeGroup}
            schedules={groupSchedules}
            hasMembers={hasMembers}
            itineraryPlans={itineraryPlans}
            locations={locations}
            onUpdate={handleGroupUpdate}
            onDelete={handleDeleteGroup}
            rightPanelWidth={rightPanelWidth}
            onResizeRightPanel={setRightPanelWidth}
            onNavigateTab={setActiveTab}
          />
        );
      case 'logistics':
        return (
          <LogisticsView
            group={activeGroup}
            schedules={groupSchedules}
            onUpdate={handleLogisticsChange}
          />
        );
      case 'schedule':
        return (
          <FullCalendarWrapper
            group={activeGroup}
            schedules={groupSchedules}
            onSchedulesUpdate={handleScheduleUpdate}
            onLogisticsUpdate={(nextLogistics) => {
              if (!activeGroupId || !Array.isArray(nextLogistics)) return;
              setGroups(prev => prev.map(group => (
                isSameGroupId(group.id, activeGroupId) ? { ...group, logistics: nextLogistics } : group
              )));
              queueLogisticsSave(activeGroupId, nextLogistics);
            }}
            onCustomResourcesChange={(nextCustomResources) => {
              if (!activeGroupId) return;
              setGroups(prev => prev.map(group => (
                isSameGroupId(group.id, activeGroupId) ? { ...group, customResources: nextCustomResources } : group
              )));
            }}
            resourceWidth={rightPanelWidth}
            scheduleRevision={activeGroupId ? (scheduleRevisionRef.current[activeGroupId] ?? 0) : 0}
            onRevisionChange={(nextRevision) => {
              if (!activeGroupId) return;
              if (Number.isFinite(nextRevision)) {
                scheduleRevisionRef.current[activeGroupId] = nextRevision;
              }
            }}
            onRevisionConflict={() => {
              if (activeGroupId) {
                fetchSchedules(activeGroupId);
              }
            }}
          />
        );
      case 'itinerary':
        return (
          <ItineraryTextDetail
            group={activeGroup}
            schedules={groupSchedules}
          />
        );
      case 'members':
        return (
          <MembersView groupId={activeGroup?.id ?? null} />
        );
      case 'help':
        return <HelpView />;
      default:
        return null;
    }
  };

  const isReadMode = activeTab === 'profile' || activeTab === 'itinerary';
  const tabMode = isReadMode ? 'read' : 'work';

  return (
    <div className="group-command-center">
      <div className="layout">
        <div className="content-split">
          <GroupList
            groups={filteredGroups}
            totalCount={groups.length}
            activeGroupId={activeGroupId}
            onSelectGroup={handleSelectGroup}
            onCreateGroup={() => {
              resetBulkForm();
              setBulkOpen(true);
            }}
            onBulkCreate={() => setBulkOpen(true)}
            filters={filters}
            onSearchChange={updateSearch}
            isCollapsed={isSidebarCollapsed}
          />

          <div className={`detail-view ${isReadMode ? 'mode-read' : 'mode-work'}`}>
            <TabBar
              activeTab={activeTab}
              mode={tabMode}
              onTabChange={handleTabChange}
              isSidebarCollapsed={isSidebarCollapsed}
              onExpandSidebar={handleExpandSidebar}
              onCollapseSidebar={handleCollapseSidebar}
            />

            <div className="tab-content">
              <div className={`content-pane active ${activeTab === 'itinerary' ? 'pane-itinerary' : ''}`}>
                <TabErrorBoundary
                  fallback="当前标签页渲染失败，请检查控制台错误。"
                >
                  {renderActiveTab()}
                </TabErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BulkCreateModal
        open={bulkOpen}
        rows={bulkRows}
        errors={bulkErrors}
        onChangeRow={updateBulkRow}
        onAddRow={addBulkRow}
        onRemoveRow={removeBulkRow}
        onClose={() => {
          setBulkOpen(false);
          resetBulkForm();
        }}
        onSubmit={handleBulkCreate}
        submitting={bulkSubmitting}
      />

      {loading && groups.length > 0 && (
        <div className="modal-overlay visible">
          <div className="modal-box" style={{ width: 240, height: 120, alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#666' }}>加载中...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManagementV2;







