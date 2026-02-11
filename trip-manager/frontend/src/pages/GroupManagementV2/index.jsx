import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import {
  buildShixingResourceId,
  parseShixingResourceId,
  isCustomResourceId,
  isPlanResourceId,
  isShixingResourceId,
  getResourceId
} from '../../domain/resourceId';
import { toMinutes } from '../../domain/time';
import { hashString } from '../../domain/hash';
import GroupList from './components/Sidebar/GroupList';
import TabBar from './components/Detail/TabBar';
import ProfileView from './components/Detail/ProfileView';
import FullCalendarWrapper from './components/Detail/FullCalendarWrapper';
import LogisticsView from './components/Detail/Logistics/LogisticsView';
import ItineraryTextDetail from './components/Detail/ItineraryTextDetail';
import BulkCreateModal from './components/Modals/BulkCreateModal';
import MembersView from './components/Detail/MembersView';
import AiDock from './components/AiDock';
import GroupCommandCenterSkeleton from './components/GroupCommandCenterSkeleton';
import './GroupCommandCenter.css';

const SHIXING_MEAL_DEFAULTS = {
  breakfast: { start: '07:30', end: '08:30' },
  lunch: { start: '12:00', end: '13:00' },
  dinner: { start: '18:00', end: '19:00' }
};

const MEAL_LABELS = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐'
};

const TAB_LABELS = {
  profile: '团组信息',
  logistics: '食行卡片',
  schedule: '日历详情',
  itinerary: '行程详情',
  members: '人员信息'
};

const collectShixingResourceIds = (schedules = []) => {
  const set = new Set();
  schedules.forEach((schedule) => {
    const resourceId = getResourceId(schedule);
    if (isShixingResourceId(resourceId)) {
      set.add(resourceId);
    }
  });
  return set;
};

const clearShixingResourceFields = (logistics = [], removedIds = []) => {
  if (!Array.isArray(logistics) || removedIds.length === 0) return logistics;
  const parsed = removedIds.map(parseShixingResourceId).filter(Boolean);
  if (parsed.length === 0) return logistics;
  const byDate = new Map();
  parsed.forEach((item) => {
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date).push(item);
  });

  return logistics.map((row) => {
    const changes = byDate.get(row.date);
    if (!changes) return row;
    const meals = { ...(row.meals || {}) };
    const pickup = { ...(row.pickup || {}) };
    const dropoff = { ...(row.dropoff || {}) };

    changes.forEach((item) => {
      if (item.category === 'meal' && item.key) {
        meals[item.key] = '';
        meals[`${item.key}_place`] = '';
        meals[`${item.key}_time`] = '';
        meals[`${item.key}_end`] = '';
        meals[`${item.key}_detached`] = false;
        meals[`${item.key}_disabled`] = false;
        return;
      }
      if (item.category === 'pickup') {
        pickup.time = '';
        pickup.end_time = '';
        pickup.location = '';
        pickup.contact = '';
        pickup.flight_no = '';
        pickup.airline = '';
        pickup.terminal = '';
        pickup.detached = false;
        pickup.disabled = false;
        return;
      }
      if (item.category === 'dropoff') {
        dropoff.time = '';
        dropoff.end_time = '';
        dropoff.location = '';
        dropoff.contact = '';
        dropoff.flight_no = '';
        dropoff.airline = '';
        dropoff.terminal = '';
        dropoff.detached = false;
        dropoff.disabled = false;
      }
    });

    return {
      ...row,
      meals,
      pickup,
      dropoff
    };
  });
};

const calcDurationMinutes = (startTime, endTime) => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const diff = end - start;
  return diff > 0 ? diff : null;
};

const isMealFilled = (meals, key) => {
  if (!meals || meals[`${key}_disabled`]) return false;
  return Boolean(meals[key] || meals[`${key}_place`]);
};

const hasPickupContent = (pickup) => {
  if (!pickup || pickup.disabled) return false;
  return Boolean(
    pickup.time ||
    pickup.end_time ||
    pickup.location ||
    pickup.contact ||
    pickup.flight_no ||
    pickup.airline ||
    pickup.terminal
  );
};

const buildFlightDescription = (pickup) => (
  [
    pickup.flight_no && `航班 ${pickup.flight_no}`,
    pickup.airline && pickup.airline,
    pickup.terminal && pickup.terminal
  ].filter(Boolean).join(' / ')
);

const buildCustomResource = (schedule) => {
  const startTime = schedule?.startTime || schedule?.start_time || '';
  const endTime = schedule?.endTime || schedule?.end_time || '';
  const durationMinutes = calcDurationMinutes(startTime, endTime) || 60;
  const durationHours = Math.max(0.5, durationMinutes / 60);
  const title = schedule?.title || schedule?.location || '自定义活动';
  const type = schedule?.type || 'activity';
  const hash = hashString(`${type}|${title}|${durationMinutes}`);
  const resourceId = getResourceId(schedule);
  const id = (
    isCustomResourceId(resourceId)
      ? resourceId
      : `custom:${hash}`
  );

  return {
    id,
    type,
    title,
    duration: durationHours,
    description: schedule?.description || '',
    locationName: schedule?.location || title,
    isUnique: false
  };
};

const mergeCustomResources = (existing = [], schedules = []) => {
  const map = new Map();
  existing.forEach((item) => {
    if (item?.id) {
      map.set(item.id, item);
    }
  });

  schedules.forEach((schedule) => {
    const resourceId = getResourceId(schedule);
    if (resourceId && (isShixingResourceId(resourceId) || isPlanResourceId(resourceId))) return;

    const resource = buildCustomResource(schedule);
    if (!map.has(resource.id)) {
      map.set(resource.id, resource);
    }
  });

  return Array.from(map.values());
};

const buildScheduleSignature = (schedules = []) => (
  schedules
    .map((schedule) => {
      const resourceId = getResourceId(schedule);
      return [
        resourceId,
        schedule.date || schedule.activity_date || '',
        schedule.startTime || schedule.start_time || '',
        schedule.endTime || schedule.end_time || '',
        schedule.type || '',
        schedule.title || '',
        schedule.location || '',
        schedule.description || ''
      ].join('|');
    })
    .sort()
    .join('||')
);

const syncLogisticsFromSchedules = (logistics = [], schedules = []) => {
  if (!Array.isArray(logistics) || logistics.length === 0) return logistics;

  const scheduleMap = new Map();
  schedules.forEach((schedule) => {
    const resourceId = getResourceId(schedule);
    if (isShixingResourceId(resourceId)) {
      scheduleMap.set(resourceId, schedule);
    }
  });

  return logistics.map((row) => {
    const meals = { ...(row.meals || {}) };
    const pickup = { ...(row.pickup || {}) };
    const dropoff = { ...(row.dropoff || {}) };

    ['breakfast', 'lunch', 'dinner'].forEach((key) => {
      const resourceId = buildShixingResourceId(row.date, 'meal', key);
      const schedule = scheduleMap.get(resourceId);
      if (schedule) {
        meals[`${key}_time`] = schedule.startTime || schedule.start_time || '';
        meals[`${key}_end`] = schedule.endTime || schedule.end_time || '';
        meals[`${key}_detached`] = false;
      } else if (isMealFilled(meals, key)) {
        meals[`${key}_detached`] = true;
      } else {
        meals[`${key}_detached`] = false;
      }
    });

    const pickupId = buildShixingResourceId(row.date, 'pickup');
    const pickupSchedule = scheduleMap.get(pickupId);
    if (pickupSchedule) {
      pickup.time = pickupSchedule.startTime || pickupSchedule.start_time || '';
      pickup.end_time = pickupSchedule.endTime || pickupSchedule.end_time || '';
      pickup.detached = false;
    } else if (hasPickupContent(pickup)) {
      pickup.detached = true;
    } else {
      pickup.detached = false;
    }

    const dropoffId = buildShixingResourceId(row.date, 'dropoff');
    const dropoffSchedule = scheduleMap.get(dropoffId);
    if (dropoffSchedule) {
      dropoff.time = dropoffSchedule.startTime || dropoffSchedule.start_time || '';
      dropoff.end_time = dropoffSchedule.endTime || dropoffSchedule.end_time || '';
      dropoff.detached = false;
    } else if (hasPickupContent(dropoff)) {
      dropoff.detached = true;
    } else {
      dropoff.detached = false;
    }

    return {
      ...row,
      meals,
      pickup,
      dropoff
    };
  });
};

const mergeSchedulesWithLogistics = (schedules = [], logistics = [], groupId) => {
  if (!groupId || !Array.isArray(logistics)) return schedules || [];
  const nextSchedules = (schedules || []).map((item) => ({ ...item }));
  const scheduleByResource = new Map();
  nextSchedules.forEach((schedule) => {
    const resourceId = getResourceId(schedule);
    if (resourceId) {
      scheduleByResource.set(resourceId, schedule);
    }
  });

  const toRemove = new Set();

  const removeByResource = (resourceId) => {
    const existing = scheduleByResource.get(resourceId);
    if (existing) {
      toRemove.add(existing);
    }
  };

  const upsertSchedule = (resourceId, payload, allowCreate = false) => {
    const existing = scheduleByResource.get(resourceId);
    if (existing) {
      Object.assign(existing, payload);
      return;
    }
    if (!allowCreate) return;
    const newSchedule = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      ...payload,
      resourceId,
      isFromResource: true
    };
    nextSchedules.push(newSchedule);
    scheduleByResource.set(resourceId, newSchedule);
  };

  logistics.forEach((row) => {
    const date = row.date;
    const meals = row.meals || {};
    const pickup = row.pickup || {};
    const dropoff = row.dropoff || {};

    ['breakfast', 'lunch', 'dinner'].forEach((key) => {
      const resourceId = buildShixingResourceId(date, 'meal', key);
      if (!isMealFilled(meals, key)) {
        removeByResource(resourceId);
        return;
      }

      const existing = scheduleByResource.get(resourceId);
      const location = meals[`${key}_place`] || '';
      const description = meals[key] || '';
      const basePayload = {
        groupId,
        date,
        type: 'meal',
        title: MEAL_LABELS[key],
        location,
        description,
        resourceId,
        isFromResource: true
      };

      if (existing) {
        upsertSchedule(resourceId, basePayload);
        return;
      }

      if (meals[`${key}_detached`]) {
        return;
      }

      const defaultTime = SHIXING_MEAL_DEFAULTS[key] || {};
      const startTime = meals[`${key}_time`] || defaultTime.start;
      const endTime = meals[`${key}_end`] || defaultTime.end;
      if (!startTime || !endTime) return;

      upsertSchedule(resourceId, {
        ...basePayload,
        startTime,
        endTime
      }, true);
    });

    const handleTransfer = (key, label, data) => {
      const resourceId = buildShixingResourceId(date, key);
      if (!hasPickupContent(data)) {
        removeByResource(resourceId);
        return;
      }

      const hasTimeRange = data.time && data.end_time;
      const basePayload = {
        groupId,
        date,
        type: 'transport',
        title: label,
        location: data.location || '',
        description: buildFlightDescription(data),
        resourceId,
        isFromResource: true
      };

      const existing = scheduleByResource.get(resourceId);
      if (existing) {
        if (!hasTimeRange) {
          removeByResource(resourceId);
          return;
        }
        upsertSchedule(resourceId, {
          ...basePayload,
          startTime: data.time,
          endTime: data.end_time
        });
        return;
      }

      if (!hasTimeRange || data.detached) return;

      upsertSchedule(resourceId, {
        ...basePayload,
        startTime: data.time,
        endTime: data.end_time
      }, true);
    };

    handleTransfer('pickup', '接站', pickup);
    handleTransfer('dropoff', '送站', dropoff);
  });

  return nextSchedules.filter((item) => !toRemove.has(item));
};

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

const GroupManagementV2 = () => {
  const navigate = useNavigate();
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
  const [aiDockOpen, setAiDockOpen] = useState(false);

  const [filters, setFilters] = useState({
    searchText: '',
    statusFilters: ['准备中', '进行中', '已完成']
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

  const saveRef = useRef(null);
  const scheduleSaveRef = useRef(null);
  const scheduleSaveTokenRef = useRef(0);
  const logisticsSaveRef = useRef(null);
  const logisticsSaveTokenRef = useRef(0);
  const scheduleSignatureRef = useRef('');
  const scheduleSnapshotRef = useRef([]);
  const scheduleRevisionRef = useRef({});

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
        group.id === groupId ? { ...group, logistics } : group
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

  useEffect(() => {
    fetchGroups();
    fetchItineraryPlans();
    fetchLocations();
  }, []);

  useEffect(() => {
    let filtered = [...groups];

    if (filters.statusFilters.length > 0) {
      filtered = filtered.filter(group => filters.statusFilters.includes(group.status));
    }

    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(group =>
        (group.name || '').toLowerCase().includes(searchLower) ||
        (group.contact_person || '').toLowerCase().includes(searchLower) ||
        (group.contact_phone || '').toLowerCase().includes(searchLower)
      );
    }

    setFilteredGroups(filtered);
  }, [filters, groups]);

  useEffect(() => {
    if (filteredGroups.length === 0) {
      setActiveGroupId(null);
      return;
    }
    if (!activeGroupId || !filteredGroups.some(group => group.id === activeGroupId)) {
      setActiveGroupId(filteredGroups[0].id);
    }
  }, [filteredGroups, activeGroupId]);

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
    scheduleSnapshotRef.current = [];
  }, [activeGroupId]);

  const activeGroup = useMemo(() => (
    groups.find(group => group.id === activeGroupId) || null
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

  const buildUpdatePayload = (group) => ({
    name: group.name,
    type: group.type,
    student_count: group.student_count,
    teacher_count: group.teacher_count,
    start_date: group.start_date,
    end_date: group.end_date,
    duration: group.duration,
    color: group.color,
    contact_person: group.contact_person,
    contact_phone: group.contact_phone,
    emergency_contact: group.emergency_contact,
    emergency_phone: group.emergency_phone,
    accommodation: group.accommodation,
    tags: group.tags,
    notes: group.notes,
    itinerary_plan_id: group.itinerary_plan_id,
    manual_must_visit_location_ids: group.manual_must_visit_location_ids,
    status: group.status
  });

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
        if (activeGroupId === groupId) {
          setGroups(prev => prev.map(group => (
            group.id === groupId ? { ...group, logistics: saved } : group
          )));
        }
      } catch (error) {
        message.error('保存食行卡片失败');
      }
    }, 400);
  }, [activeGroupId]);

  const applyScheduleSync = useCallback((schedules) => {
    const previousSchedules = scheduleSnapshotRef.current || [];
    const prevShixing = collectShixingResourceIds(previousSchedules);
    const nextShixing = collectShixingResourceIds(schedules);
    const removedShixingIds = Array.from(prevShixing).filter(id => !nextShixing.has(id));

    setGroupSchedules(schedules);
    scheduleSignatureRef.current = buildScheduleSignature(schedules);
    scheduleSnapshotRef.current = schedules;
    if (!activeGroupId) return;
    let nextLogisticsSnapshot = null;
    setGroups(prev => prev.map(group => {
      if (group.id !== activeGroupId) return group;
      let nextLogistics = syncLogisticsFromSchedules(group.logistics || [], schedules);
      if (removedShixingIds.length) {
        nextLogistics = clearShixingResourceFields(nextLogistics, removedShixingIds);
      }
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

    setGroups(prev => prev.map(group => (
      group.id === updatedGroup.id ? { ...group, ...updatedGroup } : group
    )));

    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      try {
        const payload = buildUpdatePayload(updatedGroup);
        const response = await api.put(`/groups/${updatedGroup.id}`, payload);
        if (response.data?.group) {
          setGroups(prev => prev.map(group => {
            if (group.id !== updatedGroup.id) return group;
            const preservedProps = updatedGroup.properties ?? group.properties;
            const preservedLogistics = updatedGroup.logistics ?? group.logistics;
            return {
              ...group,
              ...response.data.group,
              properties: preservedProps,
              logistics: preservedLogistics
            };
          }));
        }
      } catch (error) {
        message.error('保存失败');
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
        if (activeGroupId === groupId) {
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
        message.error('保存日程失败');
      }
    }, 400);
  }, [activeGroupId, applyScheduleSync, fetchSchedules]);

  const handleLogisticsChange = useCallback((updatedGroup) => {
    if (!updatedGroup?.id) return;

    setGroupSchedules((prev) => {
      const merged = mergeSchedulesWithLogistics(prev, updatedGroup.logistics || [], updatedGroup.id);
      const syncedLogistics = syncLogisticsFromSchedules(updatedGroup.logistics || [], merged);
      setGroups(prevGroups => prevGroups.map(group => (
        group.id === updatedGroup.id
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
      message.error('删除失败');
    }
  };

  const updateSearch = (value) => {
    setFilters(prev => ({ ...prev, searchText: value }));
  };

  const toggleStatusFilter = (status) => {
    setFilters(prev => {
      const exists = prev.statusFilters.includes(status);
      const next = exists
        ? prev.statusFilters.filter(item => item !== status)
        : [...prev.statusFilters, status];
      return { ...prev, statusFilters: next };
    });
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

  const activeTabLabel = TAB_LABELS[activeTab] || activeTab;

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
            onCustomResourcesChange={(nextCustomResources) => {
              if (!activeGroupId) return;
              setGroups(prev => prev.map(group => (
                group.id === activeGroupId ? { ...group, customResources: nextCustomResources } : group
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
      default:
        return null;
    }
  };

  return (
    <div className={`group-command-center ${aiDockOpen ? 'ai-docked' : ''}`}>
      <div className="layout">
        <div className="content-split">
          <GroupList
            groups={filteredGroups}
            totalCount={groups.length}
            activeGroupId={activeGroupId}
            onSelectGroup={setActiveGroupId}
            onCreateGroup={() => {
              resetBulkForm();
              setBulkOpen(true);
            }}
            onBulkCreate={() => setBulkOpen(true)}
            filters={filters}
            onSearchChange={updateSearch}
            onToggleStatus={toggleStatusFilter}
            isCollapsed={isSidebarCollapsed}
          />

          <div className="detail-view">
            <TabBar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              isSidebarCollapsed={isSidebarCollapsed}
              onExpandSidebar={handleExpandSidebar}
              onCollapseSidebar={handleCollapseSidebar}
            />

            <div className="tab-content">
              <div className="content-pane active">
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

      <AiDock
        open={aiDockOpen}
        activeGroup={activeGroup}
        activeTabLabel={activeTabLabel}
        onToggle={() => setAiDockOpen(prev => !prev)}
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






