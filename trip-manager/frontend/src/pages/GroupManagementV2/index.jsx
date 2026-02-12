import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import { subscribeRealtimeChanges } from '../../services/realtime';
import {
  buildShixingResourceId,
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
import HelpView from './components/Detail/HelpView';
import BulkCreateModal from './components/Modals/BulkCreateModal';
import AIImportModal from './components/Modals/AIImportModal';
import MembersView from './components/Detail/MembersView';
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
const LEGACY_MEAL_TITLES = new Set([
  '早餐',
  '午餐',
  '晚餐',
  '早饭',
  '午饭',
  '晚饭'
]);

const GROUP_UPDATE_FIELDS = [
  'name',
  'type',
  'student_count',
  'teacher_count',
  'start_date',
  'end_date',
  'duration',
  'color',
  'contact_person',
  'contact_phone',
  'emergency_contact',
  'emergency_phone',
  'accommodation',
  'tags',
  'notes',
  'notes_images',
  'itinerary_plan_id',
  'manual_must_visit_location_ids',
  'status'
];

const pickGroupUpdateFields = (group = {}) => (
  GROUP_UPDATE_FIELDS.reduce((acc, key) => {
    acc[key] = group[key];
    return acc;
  }, {})
);

const isSameGroupFieldValue = (left, right) => {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  }
  return left === right;
};

const diffGroupUpdatePayload = (nextPayload, baselinePayload = {}) => (
  GROUP_UPDATE_FIELDS.reduce((acc, key) => {
    if (!isSameGroupFieldValue(nextPayload[key], baselinePayload[key])) {
      acc[key] = nextPayload[key];
    }
    return acc;
  }, {})
);

const getRequestErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || fallback
);

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

const buildTransferFlightSummary = (pickup) => (
  [
    pickup.flight_no && `航班 ${pickup.flight_no}`,
    pickup.airline && pickup.airline,
    pickup.terminal && pickup.terminal
  ].filter(Boolean).join(' / ')
);

const buildTransferScheduleDescription = (transfer = {}) => {
  const note = typeof transfer.note === 'string' ? transfer.note.trim() : '';
  if (note) return note;
  return buildTransferFlightSummary(transfer);
};

const resolveTransferNoteFromSchedule = (description, transfer = {}) => {
  const text = typeof description === 'string' ? description.trim() : '';
  if (!text) return '';
  const fallback = buildTransferFlightSummary(transfer);
  return text === fallback ? '' : text;
};

const resolveMealArrangementFromSchedule = (schedule, fallbackKey) => {
  const title = typeof schedule?.title === 'string' ? schedule.title.trim() : '';
  const description = typeof schedule?.description === 'string' ? schedule.description.trim() : '';
  if (title && !LEGACY_MEAL_TITLES.has(title)) {
    return title;
  }
  if (description) {
    return description;
  }
  return title || (MEAL_LABELS[fallbackKey] || '');
};

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
    color: schedule?.color || '',
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
    const existing = map.get(resource.id);
    map.set(resource.id, existing ? { ...existing, ...resource } : resource);
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
        meals[key] = resolveMealArrangementFromSchedule(schedule, key) || meals[key] || '';
        meals[`${key}_place`] = schedule.location || meals[`${key}_place`] || '';
        meals[`${key}_disabled`] = false;
        meals[`${key}_detached`] = false;
      } else if (meals[`${key}_disabled`]) {
        meals[`${key}_time`] = '';
        meals[`${key}_end`] = '';
        meals[`${key}_detached`] = false;
      } else if (isMealFilled(meals, key)) {
        // One-to-one mapping mode: deleting meal event on calendar clears meal card fields.
        meals[key] = '';
        meals[`${key}_place`] = '';
        meals[`${key}_time`] = '';
        meals[`${key}_end`] = '';
        meals[`${key}_detached`] = false;
      } else {
        meals[`${key}_detached`] = false;
      }
    });

    const pickupId = buildShixingResourceId(row.date, 'pickup');
    const pickupSchedule = scheduleMap.get(pickupId);
    if (pickupSchedule) {
      pickup.time = pickupSchedule.startTime || pickupSchedule.start_time || '';
      pickup.end_time = pickupSchedule.endTime || pickupSchedule.end_time || '';
      pickup.note = resolveTransferNoteFromSchedule(pickupSchedule.description || '', pickup);
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
      dropoff.note = resolveTransferNoteFromSchedule(dropoffSchedule.description || '', dropoff);
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
      const arrangement = meals[key] || '';
      const basePayload = {
        groupId,
        date,
        type: 'meal',
        title: arrangement || MEAL_LABELS[key],
        location,
        description: '',
        resourceId,
        isFromResource: true
      };

      if (existing) {
        upsertSchedule(resourceId, basePayload);
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

      const startTime = data.time || '';
      const endTime = data.end_time
        || (startTime
          ? dayjs(`2000-01-01 ${startTime}`, 'YYYY-MM-DD HH:mm').add(1, 'hour').format('HH:mm')
          : '');
      const hasTimeRange = Boolean(startTime && endTime);
      const basePayload = {
        groupId,
        date,
        type: 'transport',
        title: label,
        location: data.location || '',
        description: buildTransferScheduleDescription(data),
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
          startTime,
          endTime
        });
        return;
      }

      if (!hasTimeRange || data.detached) return;

      upsertSchedule(resourceId, {
        ...basePayload,
        startTime,
        endTime
      }, true);
    };

    handleTransfer('pickup', '接站', pickup);
    handleTransfer('dropoff', '送站', dropoff);
  });

  return nextSchedules.filter((item) => !toRemove.has(item));
};

const createEmptyLogisticsRow = (date) => ({
  date,
  city: '',
  departure_city: '',
  arrival_city: '',
  hotel: '',
  hotel_address: '',
  hotel_disabled: false,
  vehicle: { driver: '', plate: '', phone: '' },
  vehicle_disabled: false,
  guide: { name: '', phone: '' },
  guide_disabled: false,
  security: { name: '', phone: '' },
  security_disabled: false,
  meals: {
    breakfast: '',
    breakfast_place: '',
    breakfast_disabled: false,
    breakfast_time: '',
    breakfast_end: '',
    breakfast_detached: false,
    lunch: '',
    lunch_place: '',
    lunch_disabled: false,
    lunch_time: '',
    lunch_end: '',
    lunch_detached: false,
    dinner: '',
    dinner_place: '',
    dinner_disabled: false,
    dinner_time: '',
    dinner_end: '',
    dinner_detached: false
  },
  pickup: {
    time: '',
    end_time: '',
    location: '',
    contact: '',
    flight_no: '',
    airline: '',
    terminal: '',
    note: '',
    disabled: false,
    detached: false
  },
  dropoff: {
    time: '',
    end_time: '',
    location: '',
    contact: '',
    flight_no: '',
    airline: '',
    terminal: '',
    note: '',
    disabled: false,
    detached: false
  },
  note: ''
});

const mergeAiLogisticsPatches = (existingRows = [], patches = []) => {
  const map = new Map();
  (Array.isArray(existingRows) ? existingRows : []).forEach((row) => {
    if (!row?.date) return;
    map.set(row.date, {
      ...createEmptyLogisticsRow(row.date),
      ...row,
      meals: { ...createEmptyLogisticsRow(row.date).meals, ...(row.meals || {}) },
      pickup: { ...createEmptyLogisticsRow(row.date).pickup, ...(row.pickup || {}) },
      dropoff: { ...createEmptyLogisticsRow(row.date).dropoff, ...(row.dropoff || {}) },
      vehicle: { driver: '', plate: '', phone: '', ...(row.vehicle || {}) },
      guide: { name: '', phone: '', ...(row.guide || {}) },
      security: { name: '', phone: '', ...(row.security || {}) }
    });
  });

  (Array.isArray(patches) ? patches : []).forEach((patch) => {
    const date = patch?.date;
    if (!date) return;
    const current = map.get(date) || createEmptyLogisticsRow(date);
    const next = {
      ...current,
      meals: { ...current.meals },
      pickup: { ...current.pickup },
      dropoff: { ...current.dropoff }
    };

    ['city', 'departure_city', 'arrival_city', 'hotel', 'hotel_address', 'note'].forEach((field) => {
      if (patch[field] !== undefined && patch[field] !== null && String(patch[field]).trim() !== '') {
        next[field] = String(patch[field]).trim();
      }
    });

    if (patch.meals && typeof patch.meals === 'object') {
      ['breakfast', 'lunch', 'dinner'].forEach((key) => {
        const meal = patch.meals[key];
        if (!meal || typeof meal !== 'object') return;
        if (meal.arrangement !== undefined) next.meals[key] = meal.arrangement || '';
        if (meal.place !== undefined) next.meals[`${key}_place`] = meal.place || '';
        if (meal.disabled !== undefined) next.meals[`${key}_disabled`] = !!meal.disabled;
        if (meal.startTime !== undefined) next.meals[`${key}_time`] = meal.startTime || '';
        if (meal.endTime !== undefined) next.meals[`${key}_end`] = meal.endTime || '';
        next.meals[`${key}_detached`] = false;
      });
    }

    ['pickup', 'dropoff'].forEach((key) => {
      const transfer = patch[key];
      if (!transfer || typeof transfer !== 'object') return;
      if (transfer.time !== undefined) next[key].time = transfer.time || '';
      if (transfer.endTime !== undefined) next[key].end_time = transfer.endTime || '';
      if (transfer.location !== undefined) next[key].location = transfer.location || '';
      if (transfer.contact !== undefined) next[key].contact = transfer.contact || '';
      if (transfer.flightNo !== undefined) next[key].flight_no = transfer.flightNo || '';
      if (transfer.airline !== undefined) next[key].airline = transfer.airline || '';
      if (transfer.terminal !== undefined) next[key].terminal = transfer.terminal || '';
      if (transfer.note !== undefined) next[key].note = transfer.note || '';
      if (transfer.disabled !== undefined) next[key].disabled = !!transfer.disabled;
      next[key].detached = false;
    });

    map.set(date, next);
  });

  return Array.from(map.values()).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
};

const buildScheduleDedupeKey = (schedule) => (
  [
    schedule?.date || '',
    schedule?.startTime || '',
    schedule?.endTime || '',
    schedule?.type || '',
    schedule?.title || '',
    schedule?.location || ''
  ].join('|')
);

const mergeAiScheduleCandidates = (existing = [], candidates = [], groupId) => {
  const list = (Array.isArray(existing) ? existing : []).map((item) => ({ ...item }));
  const keys = new Set(list.map(buildScheduleDedupeKey));

  (Array.isArray(candidates) ? candidates : []).forEach((candidate) => {
    const resourceId = candidate?.resourceId || '';
    if (typeof resourceId === 'string' && resourceId.startsWith('daily:')) {
      return;
    }
    if (!candidate?.date || !candidate?.startTime || !candidate?.endTime) {
      return;
    }

    const normalized = {
      id: null,
      groupId,
      date: candidate.date,
      startTime: candidate.startTime,
      endTime: candidate.endTime,
      type: candidate.type || 'visit',
      title: candidate.title || '',
      location: candidate.location || '',
      description: candidate.description || '',
      color: candidate.color || null,
      resourceId: resourceId || null,
      isFromResource: !!candidate.isFromResource,
      locationId: candidate.locationId ?? null
    };
    const key = buildScheduleDedupeKey(normalized);
    if (keys.has(key)) return;
    keys.add(key);
    list.push(normalized);
  });

  return list.sort((a, b) => {
    const aKey = `${a.date || ''}|${a.startTime || ''}|${a.endTime || ''}|${a.title || ''}`;
    const bKey = `${b.date || ''}|${b.startTime || ''}|${b.endTime || ''}|${b.title || ''}`;
    return aKey.localeCompare(bKey);
  });
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

const TAB_KEYS = new Set(['profile', 'logistics', 'schedule', 'itinerary', 'members', 'help']);

const GroupManagementV2 = () => {
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
    searchText: '',
    statusFilters: ['准备中', '进行中', '已完成', '已取消']
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
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [aiImportText, setAiImportText] = useState('');
  const [aiImportParsing, setAiImportParsing] = useState(false);
  const [aiImportApplying, setAiImportApplying] = useState(false);
  const [aiImportResult, setAiImportResult] = useState(null);

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

    if (filters.statusFilters.length > 0) {
      filtered = filtered.filter(group => filters.statusFilters.includes(group.status));
    }

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

  useEffect(() => {
    setAiImportResult(null);
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
      if (group.id !== activeGroupId) return group;
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

    setGroups(prev => prev.map(group => (
      group.id === updatedGroup.id ? { ...group, ...updatedGroup } : group
    )));

    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      try {
        const nextPayload = pickGroupUpdateFields(updatedGroup);
        const baselinePayload = groupSnapshotRef.current.get(updatedGroup.id) || {};
        const payload = diffGroupUpdatePayload(nextPayload, baselinePayload);
        if (Object.keys(payload).length === 0) {
          return;
        }
        const response = await api.put(`/groups/${updatedGroup.id}`, payload);
        if (response.data?.group) {
          groupSnapshotRef.current.set(
            updatedGroup.id,
            pickGroupUpdateFields(response.data.group)
          );
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
        } else {
          groupSnapshotRef.current.set(updatedGroup.id, { ...baselinePayload, ...payload });
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
      message.error(getRequestErrorMessage(error, '删除失败'));
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

  const handleOpenAiImport = () => {
    if (!activeGroupId || !activeGroup) {
      message.warning('请先选择团组');
      return;
    }
    setAiImportResult(null);
    setAiImportOpen(true);
  };

  const handleParseAiImport = async () => {
    if (!activeGroupId) {
      message.warning('请先选择团组');
      return;
    }
    const text = aiImportText.trim();
    if (!text) {
      message.warning('请先粘贴行程文本');
      return;
    }

    setAiImportParsing(true);
    try {
      const response = await api.post('/ai/itinerary/parse', {
        groupId: activeGroupId,
        rawText: text
      });
      setAiImportResult(response.data || null);
      message.success('解析完成，请确认后导入');
    } catch (error) {
      message.error(getRequestErrorMessage(error, 'AI解析失败'));
    } finally {
      setAiImportParsing(false);
    }
  };

  const handleApplyAiImport = async () => {
    if (!activeGroup || !activeGroupId || !aiImportResult) return;

    setAiImportApplying(true);
    try {
      const nextLogisticsRaw = mergeAiLogisticsPatches(
        activeGroup.logistics || [],
        aiImportResult.logisticsPatches || []
      );
      const nextSchedulesPre = mergeAiScheduleCandidates(
        groupSchedules,
        aiImportResult.scheduleCandidates || [],
        activeGroupId
      );
      const nextSchedules = mergeSchedulesWithLogistics(nextSchedulesPre, nextLogisticsRaw, activeGroupId);
      const syncedLogistics = syncLogisticsFromSchedules(nextLogisticsRaw, nextSchedules);
      const nextCustomResources = mergeCustomResources(activeGroup.customResources || [], nextSchedules);

      setGroups(prev => prev.map((group) => (
        group.id === activeGroupId
          ? { ...group, logistics: syncedLogistics, customResources: nextCustomResources }
          : group
      )));

      setGroupSchedules(nextSchedules);
      scheduleSignatureRef.current = buildScheduleSignature(nextSchedules);
      scheduleSnapshotRef.current = nextSchedules;

      queueLogisticsSave(activeGroupId, syncedLogistics);
      queueScheduleSave(activeGroupId, nextSchedules);

      setAiImportOpen(false);
      setAiImportResult(null);
      message.success(`AI导入完成：${nextSchedules.length} 条活动，${syncedLogistics.length} 天每日卡片`);
    } catch (error) {
      message.error(getRequestErrorMessage(error, '应用导入结果失败'));
    } finally {
      setAiImportApplying(false);
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
                group.id === activeGroupId ? { ...group, logistics: nextLogistics } : group
              )));
              queueLogisticsSave(activeGroupId, nextLogistics);
            }}
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

          <div className={`detail-view ${isReadMode ? 'mode-read' : 'mode-work'}`}>
            <TabBar
              activeTab={activeTab}
              mode={tabMode}
              onTabChange={handleTabChange}
              isSidebarCollapsed={isSidebarCollapsed}
              onExpandSidebar={handleExpandSidebar}
              onCollapseSidebar={handleCollapseSidebar}
              onOpenAiImport={handleOpenAiImport}
              aiImportDisabled={!activeGroupId}
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

      <AIImportModal
        open={aiImportOpen}
        groupName={activeGroup?.name || ''}
        rawText={aiImportText}
        onRawTextChange={setAiImportText}
        onClose={() => {
          if (aiImportParsing || aiImportApplying) return;
          setAiImportOpen(false);
          setAiImportResult(null);
        }}
        onParse={handleParseAiImport}
        onApply={handleApplyAiImport}
        parsing={aiImportParsing}
        applying={aiImportApplying}
        result={aiImportResult}
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







