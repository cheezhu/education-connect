﻿﻿﻿﻿import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Button, Modal, Form, Select, InputNumber, Input, message, Checkbox, Tooltip, DatePicker, Drawer, Upload, Result } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  LeftOutlined,
  RightOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  SettingOutlined,
  CloseOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ExportOutlined,
  DragOutlined,
  CalendarOutlined,
  UploadOutlined,
  InboxOutlined
} from '@ant-design/icons';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import dayjs from 'dayjs';
import useDataSync from '../../hooks/useDataSync';
import CalendarDaysView from '../GroupEditV2/CalendarDaysView';
import ItineraryDesignerSkeleton from './ItineraryDesignerSkeleton';
import PlanningImportModal from './planning/PlanningImportModal';
import PlanningExportModal from './planning/PlanningExportModal';
import {
  buildPlanningImportValidationKey,
  buildPlanningResultPayloadFromCsv,
  buildPlanningTemplateCsv,
  extractPlanningAssignments,
  extractPlanningGroupIds,
  extractPlanningRange,
  triggerDownload
} from './planning/planningIO';
import { generateDateRange, formatDateString, maxDate, minDate, iterateDateStrings } from './shared/dates';
import { timeSlotKeys, timeSlotWindows, toMinutes, getTimeSlotFromStart, resolveTimeSlotByOverlap, normalizeImportedTimeSlot } from './shared/timeSlots';
import { parseDelimitedValues, parseDelimitedList, parseDelimitedIdList } from './shared/parse';
import { normalizeManualMustVisitLocationIds, normalizeMustVisitMode, extractPlanLocationIds, isDateWithinGroupRange, isGroupMissingMustVisitConfig } from './shared/groupRules';
import { getRequestErrorMessage } from './shared/messages';
import { getPlanningConflictReasonLabel, getPlanningConflictHandlingTip, isPlanningConflictManualRequired } from './conflicts/conflictLabels';
import SlotConflictModal from './conflicts/SlotConflictModal';
import TimelineGrid from './timeline/TimelineGrid';
import GroupConsoleDrawer from './console/GroupConsoleDrawer';
import './ItineraryDesigner.css';

const { Option } = Select;

function ItineraryDesigner() {
  const { canAccess } = useAuth();
  const GROUP_CALENDAR_HEIGHT_DEFAULT = 30;
  const GROUP_CALENDAR_HEIGHT_MIN = 20;
  const GROUP_CALENDAR_HEIGHT_MAX = 70;
  const getStoredWeekStartDate = () => {
    try {
      const stored = localStorage.getItem('itinerary_week_start');
      if (stored && dayjs(stored).isValid()) {
        return dayjs(stored);
      }
    } catch (error) {
      // ignore
    }
    return dayjs().startOf('day');
  };
  const getStoredTimeSlots = () => {
    try {
      const stored = localStorage.getItem('itinerary_time_slots');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = timeSlotKeys.filter((key) => parsed.includes(key));
          if (filtered.length) {
            return filtered;
          }
        }
      }
    } catch (error) {
      // ignore
    }
    return timeSlotKeys;
  };

  const getStoredDailyFocus = () => {
    try {
      const stored = localStorage.getItem('itinerary_daily_focus');
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch (error) {
      // ignore
    }
    return true;
  };

  const getStoredShowUnscheduled = () => {
    try {
      const stored = localStorage.getItem('itinerary_show_unscheduled');
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch (error) {
      // ignore
    }
    return false;
  };

  
  const normalizeGroupCalendarHeight = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const clamped = Math.min(
      GROUP_CALENDAR_HEIGHT_MAX,
      Math.max(GROUP_CALENDAR_HEIGHT_MIN, parsed)
    );
    return Math.round(clamped * 10) / 10;
  };

  const getStoredGroupCalendarHeight = () => {
    try {
      const stored = localStorage.getItem('itinerary_group_calendar_height');
      const normalized = normalizeGroupCalendarHeight(stored);
      if (normalized !== null) return normalized;
    } catch (error) {
      // ignore
    }
    return GROUP_CALENDAR_HEIGHT_DEFAULT;
  };

  const [groups, setGroups] = useState([]);
  const [activities, setActivities] = useState([]);
  const [locations, setLocations] = useState([]);
  const [itineraryPlans, setItineraryPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [weekStartDate, setWeekStartDate] = useState(() => getStoredWeekStartDate());
  const [groupPanelVisible, setGroupPanelVisible] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [enabledTimeSlots, setEnabledTimeSlots] = useState(() => getStoredTimeSlots());
  const [showDailyFocus, setShowDailyFocus] = useState(() => getStoredDailyFocus());
  const [showUnscheduledGroups, setShowUnscheduledGroups] = useState(() => getStoredShowUnscheduled());
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [selectedSlotConflict, setSelectedSlotConflict] = useState(null);
  const [draggedActivity, setDraggedActivity] = useState(null);
  const cardStyle = 'minimal';
  const alignGroupRows = false;
  const [batchMode, setBatchMode] = useState(false); // 批量选择模式
  const [selectedActivities, setSelectedActivities] = useState([]); // 选中的活动
  const [planningExportVisible, setPlanningExportVisible] = useState(false);
  const [planningExportLoading, setPlanningExportLoading] = useState(false);
  const [planningExportCsvLoading, setPlanningExportCsvLoading] = useState(false);
  const [planningImportVisible, setPlanningImportVisible] = useState(false);
  const [planningImportLoading, setPlanningImportLoading] = useState(false);
  const [planningImportValidating, setPlanningImportValidating] = useState(false);
  const [planningImportPayload, setPlanningImportPayload] = useState(null);
  const [planningImportFileList, setPlanningImportFileList] = useState([]);
  const [planningImportResult, setPlanningImportResult] = useState(null);
  const [planningImportValidatedKey, setPlanningImportValidatedKey] = useState('');
  const [planningImportSnapshotToken, setPlanningImportSnapshotToken] = useState('');
  const [planningImportRollbackLoading, setPlanningImportRollbackLoading] = useState(false);
  const [planningConflictActiveReason, setPlanningConflictActiveReason] = useState('ALL');
  const [planningConflictManualOnly, setPlanningConflictManualOnly] = useState(false);
  const [planningConflictTodayOnly, setPlanningConflictTodayOnly] = useState(false);
  const [planningConflictSortBy, setPlanningConflictSortBy] = useState('DATE_ASC');
  const [groupCalendarVisible, setGroupCalendarVisible] = useState(false);
  const [groupCalendarGroupId, setGroupCalendarGroupId] = useState(null);
  const [groupCalendarDetailVisible, setGroupCalendarDetailVisible] = useState(false);
  const [groupCalendarDetailGroupId, setGroupCalendarDetailGroupId] = useState(null);
  const [groupCalendarDetailSchedules, setGroupCalendarDetailSchedules] = useState([]);
  const [groupCalendarDetailLoading, setGroupCalendarDetailLoading] = useState(false);
  const [groupCalendarDetailResourcesVisible, setGroupCalendarDetailResourcesVisible] = useState(true);
  const [groupCalendarDetailRevision, setGroupCalendarDetailRevision] = useState(0);
  const groupCalendarDetailSaveTimeoutRef = useRef(null);
  const groupCalendarDetailSaveTokenRef = useRef(0);
  const [groupCalendarHeight, setGroupCalendarHeight] = useState(() => getStoredGroupCalendarHeight());
  const [groupCalendarResizing, setGroupCalendarResizing] = useState(false);
  const [groupConsoleDragPayload, setGroupConsoleDragPayload] = useState(null);
  const [groupConsoleDropTarget, setGroupConsoleDropTarget] = useState(null);
  const groupCalendarHeightRef = useRef(getStoredGroupCalendarHeight());
  const groupCalendarResizeRef = useRef(null);
  const groupCalendarSaveTimeoutRef = useRef(null);
  const [form] = Form.useForm();
  const [planningForm] = Form.useForm();
  const [planningImportForm] = Form.useForm();
  const planningDateRange = Form.useWatch('dateRange', planningForm);
  const planningImportOnlySelected = Form.useWatch('onlySelectedGroups', planningImportForm);
  const planningImportGroupIds = Form.useWatch('groupIds', planningImportForm);
  const { registerRefreshCallback } = useDataSync();
  const designerRef = useRef(null);
  const getDesignerContainer = () => (
    designerRef.current || document.querySelector('.app-main') || document.body
  );
  const overlayStyles = {
    wrapper: { position: 'absolute', inset: 0 },
    mask: { position: 'absolute', inset: 0 }
  };

  // 时间段定义
  const timeSlots = [
    { key: 'MORNING', label: '上午', time: '06:00-12:00', color: 'transparent', borderColor: '#0e639c' },
    { key: 'AFTERNOON', label: '下午', time: '12:00-18:00', color: 'transparent', borderColor: '#89d185' },
    { key: 'EVENING', label: '晚上', time: '18:00-20:45', color: 'transparent', borderColor: '#cca700' }
  ];
  const visibleTimeSlots = timeSlots.filter((slot) => enabledTimeSlots.includes(slot.key));
  const planningAvailableGroups = (planningDateRange && planningDateRange.length === 2)
    ? filterGroupsByRange(planningDateRange)
    : [];
  const itineraryPlanById = useMemo(() => (
    new Map(
      (itineraryPlans || [])
        .map(plan => [Number(plan.id), plan])
        .filter(([planId]) => Number.isFinite(planId))
    )
  ), [itineraryPlans]);

  const planningMissingMustVisitGroupIds = useMemo(() => (
    new Set(
      planningAvailableGroups
        .filter(group => isGroupMissingMustVisitConfig(group, itineraryPlanById))
        .map(group => Number(group.id))
        .filter(Number.isFinite)
    )
  ), [planningAvailableGroups, itineraryPlanById]);

  const planningMissingMustVisitGroups = useMemo(() => (
    planningAvailableGroups.filter(group => planningMissingMustVisitGroupIds.has(Number(group.id)))
  ), [planningAvailableGroups, planningMissingMustVisitGroupIds]);

  // 加载数据
  const loadData = async (preserveSelection = false) => {
    setLoading(true);
    try {
      const [groupsRes, activitiesRes, locationsRes, plansRes] = await Promise.all([
        api.get('/groups'),
        api.get('/activities/raw'),
        api.get('/locations'),
        api.get('/itinerary-plans').catch(() => ({ data: [] }))
      ]);
      setGroups(groupsRes.data);
      setActivities(activitiesRes.data);
      setLocations(locationsRes.data);
      setItineraryPlans(Array.isArray(plansRes.data) ? plansRes.data : []);

      // 只在首次加载时选中所有团组，后续刷新保持用户选择
      if (!preserveSelection && selectedGroups.length === 0) {
        setSelectedGroups(groupsRes.data.map(g => g.id));
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 刷新数据但保持团组选择
  const refreshData = async () => {
    await loadData(true);
  };

  const loadWeekStartDate = async () => {
    try {
      const response = await api.get('/config/itinerary-week-start');
      if (response.data?.date && dayjs(response.data.date).isValid()) {
        const nextDate = dayjs(response.data.date);
        if (!weekStartDate || !nextDate.isSame(weekStartDate, 'day')) {
          setWeekStartDate(nextDate);
        }
        try {
          localStorage.setItem('itinerary_week_start', nextDate.format('YYYY-MM-DD'));
        } catch (error) {
          // ignore
        }
      }
    } catch (error) {
      message.warning('读取周起始日期失败');
    }
  };

  const persistWeekStartDate = async (nextDate) => {
    const normalized = dayjs(nextDate).startOf('day');
    setWeekStartDate(normalized);
    try {
      localStorage.setItem('itinerary_week_start', normalized.format('YYYY-MM-DD'));
    } catch (error) {
      // ignore
    }
    try {
      await api.put('/config/itinerary-week-start', {
        date: normalized.format('YYYY-MM-DD')
      });
    } catch (error) {
      message.error('保存周起始日期失败');
    }
  };

  const loadTimeSlotConfig = async () => {
    try {
      const response = await api.get('/config/itinerary-time-slots');
      const slots = response.data?.slots;
      if (Array.isArray(slots)) {
        const normalized = timeSlotKeys.filter((key) => slots.includes(key));
        const current = enabledTimeSlots;
        const same = normalized.length === current.length
          && normalized.every((slot, index) => slot === current[index]);
        if (!same) {
          setEnabledTimeSlots(normalized);
        }
        try {
          localStorage.setItem('itinerary_time_slots', JSON.stringify(normalized));
        } catch (error) {
          // ignore
        }
      }
    } catch (error) {
      message.warning('读取时间段设置失败');
    }
  };

  const loadDailyFocusConfig = async () => {
    try {
      const response = await api.get('/config/itinerary-daily-focus');
      if (typeof response.data?.enabled === 'boolean') {
        const nextValue = response.data.enabled;
        if (nextValue !== showDailyFocus) {
          setShowDailyFocus(nextValue);
        }
        try {
          localStorage.setItem('itinerary_daily_focus', nextValue ? 'true' : 'false');
        } catch (error) {
          // ignore
        }
      }
    } catch (error) {
    }
  };

  
  const loadGroupCalendarHeightConfig = async () => {
    try {
      const response = await api.get('/config/itinerary-group-calendar-height');
      const normalized = normalizeGroupCalendarHeight(response.data?.height);
      if (normalized !== null && normalized !== groupCalendarHeightRef.current) {
        setGroupCalendarHeight(normalized);
        try {
          localStorage.setItem('itinerary_group_calendar_height', String(normalized));
        } catch (error) {
          // ignore
        }
      }
    } catch (error) {
    }
  };

  const persistTimeSlotConfig = async (slots) => {
    setEnabledTimeSlots(slots);
    try {
      localStorage.setItem('itinerary_time_slots', JSON.stringify(slots));
    } catch (error) {
      // ignore
    }
    try {
      await api.put('/config/itinerary-time-slots', {
        slots
      });
    } catch (error) {
      message.error('保存时间段设置失败');
    }
  };

  const persistDailyFocusConfig = async (enabled) => {
    setShowDailyFocus(enabled);
    try {
      localStorage.setItem('itinerary_daily_focus', enabled ? 'true' : 'false');
    } catch (error) {
      // ignore
    }
    try {
      await api.put('/config/itinerary-daily-focus', {
        enabled
      });
    } catch (error) {
    }
  };

  
  const persistGroupCalendarHeightConfig = async (heightValue) => {
    const normalized = normalizeGroupCalendarHeight(heightValue);
    if (normalized === null) return;
    try {
      localStorage.setItem('itinerary_group_calendar_height', String(normalized));
    } catch (error) {
      // ignore
    }
    try {
      await api.put('/config/itinerary-group-calendar-height', {
        height: normalized
      });
    } catch (error) {
      // ignore
    }
  };

  const handleTimeSlotToggle = (slots) => {
    const normalized = timeSlotKeys.filter((key) => slots.includes(key));
    persistTimeSlotConfig(normalized);
  };

  const handleDailyFocusToggle = (event) => {
    persistDailyFocusConfig(event.target.checked);
  };

  const handleShowUnscheduledToggle = (event) => {
    const nextValue = event.target.checked;
    setShowUnscheduledGroups(nextValue);
    try {
      localStorage.setItem('itinerary_show_unscheduled', nextValue ? 'true' : 'false');
    } catch (error) {
      // ignore
    }
  };

  const handleWeekStartChange = (value) => {
    if (!value) return;
    persistWeekStartDate(value);
    setDatePickerOpen(false);
  };

  const handleWeekShift = (days) => {
    const baseDate = weekStartDate ? dayjs(weekStartDate) : dayjs();
    persistWeekStartDate(baseDate.add(days, 'day'));
  };

  useEffect(() => {
    loadData();
    loadWeekStartDate();
    loadTimeSlotConfig();
    loadDailyFocusConfig();
    loadGroupCalendarHeightConfig();
    const unregister = registerRefreshCallback(refreshData);
    return unregister;
  }, [registerRefreshCallback]);

  useEffect(() => {
    groupCalendarHeightRef.current = groupCalendarHeight;
  }, [groupCalendarHeight]);

  useEffect(() => {
    return () => {
      clearTimeout(groupCalendarSaveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!groupCalendarDetailVisible || !groupCalendarDetailGroupId) return;
    loadGroupCalendarDetailSchedules(groupCalendarDetailGroupId);
  }, [groupCalendarDetailVisible, groupCalendarDetailGroupId]);

  useEffect(() => {
    return () => {
      clearTimeout(groupCalendarDetailSaveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!planningDateRange || planningDateRange.length !== 2) {
      planningForm.setFieldsValue({ groupIds: [] });
      return;
    }
    const availableGroups = filterGroupsByRange(planningDateRange);
    const allowedIds = new Set(availableGroups.map(group => group.id));
    const selected = planningForm.getFieldValue('groupIds') || [];
    const filtered = selected.filter(id => allowedIds.has(id));
    if (filtered.length !== selected.length) {
      planningForm.setFieldsValue({ groupIds: filtered });
    }
  }, [planningDateRange, groups]);

  useEffect(() => {
    setPlanningConflictActiveReason('ALL');
    setPlanningConflictManualOnly(false);
    setPlanningConflictTodayOnly(false);
    setPlanningConflictSortBy('DATE_ASC');
  }, [planningImportResult, planningImportVisible]);

  // 生成日期范围（7天一页）
  const dateRange = generateDateRange(weekStartDate);

  const getGroupDateRange = (group) => {
    if (!group?.start_date || !group?.end_date) return [];
    const start = dayjs(group.start_date);
    const end = dayjs(group.end_date);
    if (!start.isValid() || !end.isValid()) return [];
    const dates = [];
    let cursor = start.startOf('day');
    while (cursor.isBefore(end, 'day') || cursor.isSame(end, 'day')) {
      dates.push(cursor.toDate());
      cursor = cursor.add(1, 'day');
    }
    return dates;
  };
  const getTimeSlotLabel = (slotKey) => {
    return timeSlots.find(slot => slot.key === slotKey)?.label || slotKey;
  };

  const getGroupDisplayName = (group) => group?.name || '未命名团组';

  const isGroupActiveOnDate = (group, date) => {
    if (!group?.start_date || !group?.end_date) return false;
    const currentDate = dayjs(date);
    const start = dayjs(group.start_date);
    const end = dayjs(group.end_date);
    if (!currentDate.isValid() || !start.isValid() || !end.isValid()) return false;
    return !start.isAfter(currentDate, 'day') && !end.isBefore(currentDate, 'day');
  };

  const getActiveGroupsForDate = (date) => (
    groups.filter(group => (
      selectedGroups.includes(group.id) && isGroupActiveOnDate(group, date)
    ))
  );

  const getActiveGroupNamesForDate = (date) => (
    new Set(getActiveGroupsForDate(date).map(getGroupDisplayName))
  );

  const isGroupArrivalDay = (group, dateString) => (
    Boolean(group?.start_date && dateString && group.start_date === dateString)
  );

  const isGroupDepartureDay = (group, dateString) => (
    Boolean(group?.end_date && dateString && group.end_date === dateString)
  );

  const buildScheduleMatchKey = (schedule) => {
    const title = schedule?.title || schedule?.location || schedule?.description || '';
    const locationId = schedule?.locationId ?? '';
    const resourceId = schedule?.resourceId ?? schedule?.resource_id ?? '';
    return [
      schedule?.date || '',
      schedule?.startTime || '',
      schedule?.endTime || '',
      locationId,
      resourceId,
      title
    ].join('|');
  };

  const isPlanSchedule = (schedule) => {
    const resourceId = schedule?.resourceId ?? schedule?.resource_id;
    return typeof resourceId === 'string' && resourceId.startsWith('plan-');
  };

  const resolveScheduleId = (schedule) => {
    if (Number.isFinite(schedule?.id)) return schedule.id;
    const numericId = Number(schedule?.id);
    if (Number.isFinite(numericId)) return numericId;
    return schedule?.__optimisticId || buildScheduleMatchKey(schedule);
  };

  const mapSchedulesToActivities = ({ schedules, group, existingActivities }) => {
    const participantCount = group
      ? (group.student_count || 0) + (group.teacher_count || 0)
      : 0;
    const existingByScheduleId = new Map();
    (existingActivities || []).forEach((activity) => {
      if (activity.scheduleId == null) return;
      existingByScheduleId.set(String(activity.scheduleId), activity);
    });

    const planSchedules = (schedules || []).filter(isPlanSchedule);

    return planSchedules.map((schedule) => {
      const scheduleId = resolveScheduleId(schedule);
      const timeSlot = resolveTimeSlotByOverlap(schedule.startTime, schedule.endTime);
      const baseActivity = {
        id: `tmp-activity-${scheduleId}`,
        scheduleId,
        isPlanItem: true,
        groupId: group?.id ?? schedule.groupId,
        locationId: schedule.locationId ?? null,
        date: schedule.date,
        timeSlot,
        participantCount
      };
      const existing = existingByScheduleId.get(String(scheduleId));
      if (existing) {
        return {
          ...existing,
          ...baseActivity,
          id: existing.id
        };
      }
      return baseActivity;
    });
  };

  const applyOptimisticScheduleUpdate = ({ groupId, schedules }) => {
    const group = groups.find(g => g.id === groupId) || { id: groupId, student_count: 0, teacher_count: 0 };
    setActivities((prev) => {
      const planScheduleIds = new Set(
        (schedules || [])
          .filter(isPlanSchedule)
          .map((schedule) => String(resolveScheduleId(schedule)))
      );
      const isPlanActivity = (activity) => (
        Boolean(activity.isPlanItem)
        || (activity.scheduleId != null && planScheduleIds.has(String(activity.scheduleId)))
      );
      const scheduleActivities = mapSchedulesToActivities({
        schedules,
        group,
        existingActivities: prev.filter(activity => activity.groupId === groupId && isPlanActivity(activity))
      });
      const preserved = prev.filter(activity => activity.groupId !== groupId || !isPlanActivity(activity));
      return [...preserved, ...scheduleActivities];
    });
  };

  const refreshActivitiesOnly = async (token) => {
    try {
      const response = await api.get('/activities/raw');
      if (token && token !== groupCalendarDetailSaveTokenRef.current) return;
      if (Array.isArray(response.data)) {
        setActivities(response.data);
      }
    } catch (error) {
      message.warning('同步活动失败');
    }
  };

  const getArrivalsForDate = (dateString) => {
    return groups.filter(group => (
      group.start_date === dateString && selectedGroups.includes(group.id)
    ));
  };

  const getDeparturesForDate = (dateString) => {
    return groups.filter(group => (
      group.end_date === dateString && selectedGroups.includes(group.id)
    ));
  };

  const getLocationTotalsForDate = (dateString, slotKey) => {
    const totals = new Map();
    activities.forEach((activity) => {
      if (activity.date !== dateString || activity.timeSlot !== slotKey) return;
      if (!selectedGroups.includes(activity.groupId)) return;
      const locationKey = activity.locationId ?? activity.notes ?? 'none';
      const current = totals.get(locationKey) || 0;
      totals.set(locationKey, current + (activity.participantCount || 0));
    });

    return Array.from(totals.entries())
      .map(([locationKey, total]) => {
        const location = locations.find(loc => loc.id === locationKey);
        return {
          locationId: locationKey,
          total,
          name: location
            ? location.name
            : (typeof locationKey === 'string' && locationKey !== 'none' ? locationKey : '未设置场地')
        };
      })
      .sort((a, b) => b.total - a.total);
  };

  const openGroupCalendar = (groupId) => {
    if (!groupId) return;
    setGroupCalendarGroupId(groupId);
    setGroupCalendarVisible(true);
  };

  const handleGroupCalendarResizeStart = (event) => {
    if (event?.button !== undefined && event.button !== 0) return;
    const point = event.touches ? event.touches[0] : event;
    if (!point) return;
    const clientY = point.clientY;
    if (!Number.isFinite(clientY)) return;
    groupCalendarResizeRef.current = {
      startY: clientY,
      startHeight: groupCalendarHeightRef.current
    };
    setGroupCalendarResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
    window.addEventListener('mousemove', handleGroupCalendarResizeMove);
    window.addEventListener('mouseup', handleGroupCalendarResizeEnd);
    window.addEventListener('touchmove', handleGroupCalendarResizeMove, { passive: false });
    window.addEventListener('touchend', handleGroupCalendarResizeEnd);
  };

  const handleGroupCalendarResizeMove = (event) => {
    if (!groupCalendarResizeRef.current) return;
    const point = event.touches ? event.touches[0] : event;
    if (!point) return;
    const clientY = point.clientY;
    if (!Number.isFinite(clientY)) return;
    const deltaY = groupCalendarResizeRef.current.startY - clientY;
    const viewportHeight = window.innerHeight || 1;
    const deltaVh = (deltaY / viewportHeight) * 100;
    const nextHeight = normalizeGroupCalendarHeight(groupCalendarResizeRef.current.startHeight + deltaVh);
    if (nextHeight === null) return;
    setGroupCalendarHeight(nextHeight);
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  const handleGroupCalendarResizeEnd = () => {
    if (!groupCalendarResizeRef.current) return;
    groupCalendarResizeRef.current = null;
    setGroupCalendarResizing(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', handleGroupCalendarResizeMove);
    window.removeEventListener('mouseup', handleGroupCalendarResizeEnd);
    window.removeEventListener('touchmove', handleGroupCalendarResizeMove);
    window.removeEventListener('touchend', handleGroupCalendarResizeEnd);
    clearTimeout(groupCalendarSaveTimeoutRef.current);
    groupCalendarSaveTimeoutRef.current = setTimeout(() => {
      persistGroupCalendarHeightConfig(groupCalendarHeightRef.current);
    }, 300);
  };

  const loadGroupCalendarDetailSchedules = async (groupId) => {
    if (!groupId) return;
    setGroupCalendarDetailLoading(true);
    try {
      const response = await api.get(`/groups/${groupId}/schedules`);
      const loaded = Array.isArray(response.data) ? response.data : [];
      const revisionHeader = response.headers?.['x-schedule-revision'];
      const nextRevision = Number(revisionHeader);
      setGroupCalendarDetailRevision(Number.isFinite(nextRevision) ? nextRevision : 0);
      setGroupCalendarDetailSchedules(loaded);
    } catch (error) {
      message.error('加载日程失败');
      setGroupCalendarDetailSchedules([]);
      setGroupCalendarDetailRevision(0);
    } finally {
      setGroupCalendarDetailLoading(false);
    }
  };
  const openGroupCalendarDetail = (groupId) => {
    if (!groupId) return;
    setGroupPanelVisible(true);
    const isSameGroup = groupId === groupCalendarDetailGroupId;
    const alreadyOpen = groupCalendarDetailVisible && isSameGroup;
    if (!isSameGroup) {
      setGroupCalendarDetailSchedules([]);
      setGroupCalendarDetailGroupId(groupId);
      setGroupCalendarDetailResourcesVisible(true);
      setGroupCalendarDetailRevision(0);
    }
    setGroupCalendarDetailVisible(true);
    if (alreadyOpen) {
      loadGroupCalendarDetailSchedules(groupId);
    }
  };

  const handleGroupCalendarDetailUpdate = (updatedSchedules) => {
    setGroupCalendarDetailSchedules(updatedSchedules);
    clearTimeout(groupCalendarDetailSaveTimeoutRef.current);
    groupCalendarDetailSaveTimeoutRef.current = setTimeout(async () => {
      if (!groupCalendarDetailGroupId) return;
      groupCalendarDetailSaveTokenRef.current += 1;
      const saveToken = groupCalendarDetailSaveTokenRef.current;
      try {
        const response = await api.post(`/groups/${groupCalendarDetailGroupId}/schedules/batch`, {
          scheduleList: updatedSchedules,
          revision: groupCalendarDetailRevision
        });
        if (saveToken !== groupCalendarDetailSaveTokenRef.current) return;
        const saved = Array.isArray(response.data) ? response.data : updatedSchedules;
        const revisionHeader = response.headers?.['x-schedule-revision'];
        const nextRevision = Number(revisionHeader);
        if (Number.isFinite(nextRevision)) {
          setGroupCalendarDetailRevision(nextRevision);
        }
        setGroupCalendarDetailSchedules(saved);
      } catch (error) {
        if (error?.response?.status === 409) {
          const revisionHeader = error.response?.headers?.['x-schedule-revision'];
          const nextRevision = Number(revisionHeader);
          if (Number.isFinite(nextRevision)) {
            setGroupCalendarDetailRevision(nextRevision);
          }
          message.warning('日程已被其他人修改，请刷新后再试');
          loadGroupCalendarDetailSchedules(groupCalendarDetailGroupId);
          return;
        }
        message.error('保存日程失败');
      }
    }, 500);
  };

  const openPlanningExportModal = () => {
    const defaultRange = [dayjs(dateRange[0]), dayjs(dateRange[6])];
    const availableGroups = filterGroupsByRange(defaultRange);
    const availableGroupIds = new Set(availableGroups.map(group => group.id));
    const defaultGroupIds = (selectedGroups.length ? selectedGroups : groups.map(group => group.id))
      .filter(id => availableGroupIds.has(id));
    planningForm.setFieldsValue({
      dateRange: defaultRange,
      groupIds: defaultGroupIds
    });
    setPlanningExportVisible(true);
  };

  const buildPlanningPayload = (values) => {
    const [start, end] = values.dateRange || [];
    return {
      groupIds: values.groupIds,
      startDate: start ? start.format('YYYY-MM-DD') : formatDateString(dateRange[0]),
      endDate: end ? end.format('YYYY-MM-DD') : formatDateString(dateRange[6]),
      includeExistingActivities: true,
      includeExistingSchedules: true,
      includePlanItemsByGroup: true
    };
  };

  const handlePlanningExport = async () => {
    try {
      const values = await planningForm.validateFields();
      setPlanningExportLoading(true);
      const response = await api.post('/planning/export', buildPlanningPayload(values));
      const payload = typeof response.data === 'string'
        ? JSON.parse(response.data)
        : response.data;
      const snapshotId = String(
        payload?.meta?.snapshotId || payload?.snapshot_id || dayjs().toISOString()
      ).replace(/[:.]/g, '-');
      const filename = `planning_input_${snapshotId}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      triggerDownload(blob, filename);
      message.success('导出成功');
      setPlanningExportVisible(false);
    } catch (error) {
      const data = error?.response?.data;
      if (data && typeof data === 'object') {
        const details = Array.isArray(data.details) && data.details.length
          ? `：${data.details.slice(0, 3).join('；')}`
          : '';
        message.error(`${data.error || '导出失败'}${details}`);
      } else {
        message.error('导出失败');
      }
    } finally {
      setPlanningExportLoading(false);
    }
  };

  const handlePlanningExportCsv = async () => {
    try {
      const values = await planningForm.validateFields();
      setPlanningExportCsvLoading(true);
      const response = await api.post('/planning/export', buildPlanningPayload(values));
      const payload = typeof response.data === 'string'
        ? JSON.parse(response.data)
        : response.data;
      const csvText = buildPlanningTemplateCsv(payload, values.groupIds || []);
      const filename = `planning_template_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.csv`;
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      triggerDownload(blob, filename);
      message.success('已导出人工模板 CSV');
    } catch (error) {
      const data = error?.response?.data;
      if (data && typeof data === 'object') {
        const details = Array.isArray(data.details) && data.details.length
          ? `：${data.details.slice(0, 3).join('；')}`
          : '';
        message.error(`${data.error || '导出 CSV 失败'}${details}`);
      } else {
        message.error('导出 CSV 失败');
      }
    } finally {
      setPlanningExportCsvLoading(false);
    }
  };

  const resetPlanningImportState = () => {
    setPlanningImportPayload(null);
    setPlanningImportFileList([]);
    setPlanningImportResult(null);
    setPlanningImportValidatedKey('');
    setPlanningImportSnapshotToken('');
    planningImportForm.resetFields();
    planningImportForm.setFieldsValue({
      replaceExisting: false,
      skipConflicts: true,
      onlySelectedGroups: true,
      groupIds: [],
      importDateRange: []
    });
  };

  const openPlanningImportModal = () => {
    resetPlanningImportState();
    setPlanningImportVisible(true);
  };

  const handlePlanningImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = event.target?.result || '';
        const lowerName = String(file?.name || '').toLowerCase();
        const isCsv = lowerName.endsWith('.csv') || file?.type === 'text/csv';
        const parsed = isCsv
          ? buildPlanningResultPayloadFromCsv(rawText, file?.name || '', { groups, locations })
          : JSON.parse(rawText);
        const payload = parsed?.payload && parsed.payload.schema ? parsed.payload : parsed;
        if (!payload || payload.schema !== 'ec-planning-result@1') {
          message.error('文件格式不正确（schema不匹配）');
          setPlanningImportPayload(null);
          setPlanningImportResult(null);
          setPlanningImportFileList([]);
          setPlanningImportValidatedKey('');
          setPlanningImportSnapshotToken('');
          return;
        }
        setPlanningImportPayload(payload);
        setPlanningImportResult(null);
        setPlanningImportValidatedKey('');
        setPlanningImportSnapshotToken('');
        const payloadGroupIds = extractPlanningGroupIds(payload);
        const payloadRange = extractPlanningRange(payload);
        planningImportForm.setFieldsValue({
          replaceExisting: payload.mode === 'replaceExisting',
          skipConflicts: true,
          onlySelectedGroups: true,
          groupIds: payloadGroupIds,
          importDateRange: payloadRange
            ? [dayjs(payloadRange.start), dayjs(payloadRange.end)]
            : []
        });
      } catch (error) {
        message.error(error?.message || '文件解析失败');
        setPlanningImportPayload(null);
        setPlanningImportResult(null);
        setPlanningImportFileList([]);
        setPlanningImportValidatedKey('');
        setPlanningImportSnapshotToken('');
      }
    };
    reader.readAsText(file);
    setPlanningImportFileList([file]);
    return false;
  };

  const handlePlanningImportRemove = () => {
    setPlanningImportPayload(null);
    setPlanningImportFileList([]);
    setPlanningImportResult(null);
    setPlanningImportValidatedKey('');
    setPlanningImportSnapshotToken('');
  };

  const resolvePlanningImportGroupIds = (values) => {
    const payloadGroupIds = extractPlanningGroupIds(planningImportPayload);
    let targetGroupIds = values.onlySelectedGroups
      ? selectedGroups
      : (values.groupIds || []);
    targetGroupIds = targetGroupIds
      .map(id => Number(id))
      .filter(Number.isFinite);
    if (payloadGroupIds.length > 0) {
      const payloadSet = new Set(payloadGroupIds);
      targetGroupIds = targetGroupIds.filter(id => payloadSet.has(id));
    }
    return Array.from(new Set(targetGroupIds));
  };

  const buildPlanningImportOptions = (values, dryRun) => {
    const groupIds = resolvePlanningImportGroupIds(values);
    const [rangeStart, rangeEnd] = values.importDateRange || [];
    const fallbackRange = extractPlanningRange(planningImportPayload);
    const startDate = rangeStart
      ? rangeStart.format('YYYY-MM-DD')
      : (fallbackRange?.start || null);
    const endDate = rangeEnd
      ? rangeEnd.format('YYYY-MM-DD')
      : (fallbackRange?.end || null);

    return {
      groupIds,
      replaceExisting: values.replaceExisting !== false,
      skipConflicts: values.skipConflicts !== false,
      startDate,
      endDate,
      dryRun
    };
  };

  const runPlanningImport = async (dryRun) => {
    if (!planningImportPayload) {
      message.error('请先上传 planning_result.json 或 CSV 模板');
      return;
    }

    try {
      const values = await planningImportForm.validateFields();
      const options = buildPlanningImportOptions(values, dryRun);
      if ((options.groupIds || []).length === 0) {
        message.error('未选择可导入的团组');
        return;
      }
      if (!options.startDate || !options.endDate) {
        message.error('请先确认导入日期范围');
        return;
      }

      const validationKey = buildPlanningImportValidationKey(planningImportPayload, {
        ...options,
        dryRun: false
      });
      if (!dryRun && planningImportValidatedKey !== validationKey) {
        message.warning('请先执行校验，校验通过后再导入');
        return;
      }

      const request = {
        payload: planningImportPayload,
        options
      };

      if (dryRun) {
        setPlanningImportValidatedKey('');
        setPlanningImportValidating(true);
      } else {
        setPlanningImportLoading(true);
      }

      const response = await api.post('/planning/import', request);
      setPlanningImportResult(response.data);
      if (dryRun) {
        setPlanningImportValidatedKey(validationKey);
        message.success('校验完成');
      } else {
        setPlanningImportValidatedKey('');
        setPlanningImportSnapshotToken(response.data?.snapshotToken || '');
        message.success(`导入完成，成功 ${response.data?.summary?.inserted || 0} 条`);
        refreshData();
      }
    } catch (error) {
      const data = error.response?.data;
      if (data?.conflicts) {
        setPlanningImportResult(data);
      }
      if (dryRun) {
        setPlanningImportValidatedKey('');
      }
      message.error(data?.error || (dryRun ? '校验失败' : '导入失败'));
    } finally {
      setPlanningImportValidating(false);
      setPlanningImportLoading(false);
    }
  };

  const handlePlanningImportValidate = () => runPlanningImport(true);
  const handlePlanningImportApply = () => runPlanningImport(false);

  const handlePlanningImportRollback = async () => {
    if (!planningImportSnapshotToken) {
      message.warning('当前没有可回滚的导入快照');
      return;
    }
    try {
      setPlanningImportRollbackLoading(true);
      await api.post('/planning/import/rollback', {
        snapshotToken: planningImportSnapshotToken
      });
      setPlanningImportSnapshotToken('');
      setPlanningImportValidatedKey('');
      message.success('已回滚最近一次导入');
      refreshData();
    } catch (error) {
      const data = error.response?.data;
      message.error(data?.error || '回滚失败');
    } finally {
      setPlanningImportRollbackLoading(false);
    }
  };

  function filterGroupsByRange(range) {
    if (!Array.isArray(range) || range.length !== 2 || !range[0] || !range[1]) {
      return groups;
    }
    const [start, end] = range;
    return groups.filter(group => {
      if (!group.start_date || !group.end_date) return false;
      const groupStart = dayjs(group.start_date);
      const groupEnd = dayjs(group.end_date);
      return !groupStart.isAfter(end, 'day') && !groupEnd.isBefore(start, 'day');
    });
  }

  // 获取指定时段的活动
  const getActivitiesForSlot = (date, timeSlot) => {
    const dateString = formatDateString(date);
    return activities.filter(activity => {
      const activityDate = activity.date;
      return activityDate === dateString &&
             activity.timeSlot === timeSlot &&
             selectedGroups.includes(activity.groupId);
    });
  };

  const groupsById = useMemo(() => (
    new Map(groups.map(group => [Number(group.id), group]))
  ), [groups]);

  const locationsById = useMemo(() => (
    new Map(locations.map(location => [Number(location.id), location]))
  ), [locations]);

  const buildTimelineSlotConflicts = (dateString, slotActivities) => {
    if (!Array.isArray(slotActivities) || slotActivities.length === 0) return [];

    const conflicts = [];
    const conflictKeys = new Set();
    const weekdayIndex = dayjs(dateString).day();
    const weekdayLabel = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][weekdayIndex] || '当日';

    const pushConflict = (conflict) => {
      const dedupeKey = `${conflict.type}|${conflict.groupId || ''}|${conflict.locationId || ''}|${conflict.message}`;
      if (conflictKeys.has(dedupeKey)) return;
      conflictKeys.add(dedupeKey);
      conflicts.push(conflict);
    };

    const groupBuckets = new Map();
    slotActivities.forEach((activity) => {
      const groupId = Number(activity.groupId);
      if (!Number.isFinite(groupId)) return;
      if (!groupBuckets.has(groupId)) {
        groupBuckets.set(groupId, []);
      }
      groupBuckets.get(groupId).push(activity);
    });
    groupBuckets.forEach((groupActivities, groupId) => {
      if (groupActivities.length <= 1) return;
      const group = groupsById.get(groupId);
      pushConflict({
        type: 'GROUP_TIME_CONFLICT',
        groupId,
        groupName: group?.name || `#${groupId}`,
        message: `${group?.name || `#${groupId}`} 在同一时段有 ${groupActivities.length} 条活动安排`
      });
    });

    const locationBuckets = new Map();
    slotActivities.forEach((activity) => {
      const locationId = Number(activity.locationId);
      if (!Number.isFinite(locationId) || locationId <= 0) return;
      if (!locationBuckets.has(locationId)) {
        locationBuckets.set(locationId, []);
      }
      locationBuckets.get(locationId).push(activity);
    });
    locationBuckets.forEach((locationActivities, locationId) => {
      const location = locationsById.get(locationId);
      if (!location) return;
      const capacity = Number(location.capacity);
      if (!Number.isFinite(capacity) || capacity <= 0) return;
      const totalParticipants = locationActivities.reduce(
        (sum, activity) => sum + Number(activity.participantCount || 0),
        0
      );
      if (totalParticipants <= capacity) return;
      pushConflict({
        type: 'CAPACITY',
        locationId,
        locationName: location.name || `#${locationId}`,
        message: `${location.name || `#${locationId}`} 容量超限：${totalParticipants}/${capacity} 人`
      });
    });

    slotActivities.forEach((activity) => {
      const groupId = Number(activity.groupId);
      const locationId = Number(activity.locationId);
      const group = groupsById.get(groupId);
      const location = locationsById.get(locationId);
      if (!group || !location) return;

      const blockedWeekdays = String(location.blocked_weekdays || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      if (blockedWeekdays.includes(String(weekdayIndex))) {
        pushConflict({
          type: 'BLOCKED_WEEKDAY',
          groupId,
          groupName: group.name || `#${groupId}`,
          locationId,
          locationName: location.name || `#${locationId}`,
          message: `${location.name || `#${locationId}`} 在 ${weekdayLabel} 不可用`
        });
      }

      const targetGroups = String(location.target_groups || 'all').trim();
      if (targetGroups !== 'all' && targetGroups !== group.type) {
        pushConflict({
          type: 'GROUP_TYPE',
          groupId,
          groupName: group.name || `#${groupId}`,
          locationId,
          locationName: location.name || `#${locationId}`,
          message: `${location.name || `#${locationId}`} 不适用于${group.type === 'primary' ? '小学' : '中学'}团组`
        });
      }
    });

    return conflicts;
  };

  const timelineSlotConflictMap = useMemo(() => {
    const slotActivityMap = new Map();
    activities.forEach((activity) => {
      if (!selectedGroups.includes(activity.groupId)) return;
      const key = `${activity.date}|${activity.timeSlot}`;
      if (!slotActivityMap.has(key)) {
        slotActivityMap.set(key, []);
      }
      slotActivityMap.get(key).push(activity);
    });

    const result = new Map();
    slotActivityMap.forEach((slotActivities, key) => {
      const [dateString, timeSlot] = key.split('|');
      const conflicts = buildTimelineSlotConflicts(dateString, slotActivities);
      if (!conflicts.length) return;
      result.set(key, {
        key,
        date: dateString,
        timeSlot,
        activities: slotActivities,
        conflicts
      });
    });
    return result;
  }, [activities, selectedGroups, groupsById, locationsById]);

  // 团组控制台
  const renderGroupPanel = (showTitle = true) => (
    <Card
      title={showTitle ? '团组控制台' : null}
      size="small"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: 'none',
        borderRadius: 0
      }}
      bodyStyle={{
        flex: 1,
        overflow: 'auto',
        padding: '12px'
      }}
      extra={showTitle ? (
        <Button
          type="text"
          icon={<SettingOutlined />}
          size="small"
          title="设置"
        />
      ) : null}
    >
      <div style={{ marginBottom: '16px' }}>
        <Button
          type="link"
          size="small"
          onClick={() => setSelectedGroups(groups.map(g => g.id))}
        >
          全选
        </Button>
        <Button
          type="link"
          size="small"
          onClick={() => setSelectedGroups([])}
        >
          清空
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {groups.map(group => (
          <div key={group.id} style={{ marginBottom: '12px' }}>
            <Checkbox
              checked={selectedGroups.includes(group.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedGroups([...selectedGroups, group.id]);
                } else {
                  setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: group.color,
                    borderRadius: '2px'
                  }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                    {group.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    📅 {dayjs(group.start_date).format('MM-DD')} ~ {dayjs(group.end_date).format('MM-DD')}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    👥 {group.student_count + group.teacher_count}人 🏫 {group.type === 'primary' ? '小学' : '中学'}
                  </div>
                </div>
              </div>
            </Checkbox>
          </div>
        ))}
      </div>
    </Card>
  );

  // 工具面板已移除

  const renderTimelineHeader = () => (
    <div className="page-header itinerary-header">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              size="small"
              onClick={() => setGroupPanelVisible(true)}
            >
              团组控制台
            </Button>
            <Button
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => setDatePickerOpen(true)}
            />
            <DatePicker
              value={weekStartDate}
              onChange={handleWeekStartChange}
              allowClear={false}
              size="small"
              format="YYYY-MM-DD"
              placeholder="请选择日期"
              open={datePickerOpen}
              onOpenChange={(open) => setDatePickerOpen(open)}
              getPopupContainer={getDesignerContainer}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              type="text"
              icon={<LeftOutlined />}
              onClick={() => handleWeekShift(-7)}
              title="前一周"
            />
            <span style={{ minWidth: '160px', textAlign: 'center', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Button
                type="text"
                size="small"
                icon={<StepBackwardOutlined />}
                onClick={() => handleWeekShift(-1)}
                title="上一天"
              />
              <span>
                {dayjs(dateRange[0]).format('YYYY年MM月DD日')} ~ {dayjs(dateRange[6]).format('MM月DD日')}
              </span>
              <Button
                type="text"
                size="small"
                icon={<StepForwardOutlined />}
                onClick={() => handleWeekShift(1)}
                title="下一天"
              />
            </span>
            <Button
              type="text"
              icon={<RightOutlined />}
              onClick={() => handleWeekShift(7)}
              title="后一周"
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
              <Checkbox
                checked={showDailyFocus}
                onChange={handleDailyFocusToggle}
              >
                每日关注
              </Checkbox>
              <Checkbox
                checked={showUnscheduledGroups}
                onChange={handleShowUnscheduledToggle}
              >
                未安排行程
              </Checkbox>
              <Checkbox.Group
                value={enabledTimeSlots}
                onChange={handleTimeSlotToggle}
                options={timeSlots.map(slot => ({ label: slot.label, value: slot.key }))}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            icon={<UploadOutlined />}
            size="small"
            onClick={openPlanningImportModal}
          >
            导入
          </Button>
          <Button
            icon={<ExportOutlined />}
            size="small"
            onClick={openPlanningExportModal}
          >
            导出包
          </Button>
          <Button
            icon={<ExportOutlined />}
            size="small"
            onClick={() => exportData()}
          >
            导出CSV
          </Button>
        </div>
      </div>
    </div>
  );

  // 时间轴网格
  const renderTimelineGrid = () => (
    <TimelineGrid
      dateRange={dateRange}
      visibleTimeSlots={visibleTimeSlots}
      alignGroupRows={alignGroupRows}
      showUnscheduledGroups={showUnscheduledGroups}
      showDailyFocus={showDailyFocus}
      groups={groups}
      locations={locations}
      timelineSlotConflictMap={timelineSlotConflictMap}
      selectedActivities={selectedActivities}
      batchMode={batchMode}
      formatDateString={formatDateString}
      getActivitiesForSlot={getActivitiesForSlot}
      getGroupDisplayName={getGroupDisplayName}
      getActiveGroupsForDate={getActiveGroupsForDate}
      getActiveGroupNamesForDate={getActiveGroupNamesForDate}
      isGroupArrivalDay={isGroupArrivalDay}
      isGroupDepartureDay={isGroupDepartureDay}
      getArrivalsForDate={getArrivalsForDate}
      getDeparturesForDate={getDeparturesForDate}
      getLocationTotalsForDate={getLocationTotalsForDate}
      handleCellClick={handleCellClick}
      handleDragOver={handleDragOver}
      handleDragEnter={handleDragEnter}
      handleDragLeave={handleDragLeave}
      handleDrop={handleDrop}
      handleDragStart={handleDragStart}
      handleDragEnd={handleDragEnd}
      openGroupCalendar={openGroupCalendar}
      setSelectedActivities={setSelectedActivities}
      renderActivityCard={renderActivityCard}
    />
  );

  // 渲染活动卡片 - 根据不同样式
  const renderActivityCard = (activity, group, location, compact = false) => {
    const isArrivalDay = isGroupArrivalDay(group, activity?.date);
    const isDepartureDay = isGroupDepartureDay(group, activity?.date);
    const dayMarkers = [];
    if (isArrivalDay) dayMarkers.push('arrival');
    if (isDepartureDay) dayMarkers.push('departure');
    const activityNote = activity?.notes ? String(activity.notes).trim() : '';
    const activityDetail = location?.name || activityNote;
    const renderDayMarkers = () => (
      dayMarkers.length ? (
        <div className="activity-day-marker">
          {dayMarkers.map((marker) => (
            <span
              key={`${activity.id}-${marker}`}
              className={`activity-day-marker-dot ${marker}`}
            />
          ))}
        </div>
      ) : null
    );

    // 标签式（默认）
    if (cardStyle === 'tag') {
      return (
        <div
          className="activity-card-tag"
          style={{
            display: 'inline-block',
            padding: '4px 12px 4px 10px',
            backgroundColor: group?.color + '20',
            borderRadius: '14px',
            border: `1px solid ${group?.color}`,
            fontSize: '11px',
            marginRight: '4px',
            marginBottom: '4px',
            cursor: 'grab',
            position: 'relative'
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleCellClick(null, null, [activity]);
          }}
        >
          {renderDayMarkers()}
          <span style={{ fontWeight: '600', color: 'var(--text-strong)' }}>{group?.name}</span>
          {activityDetail && (
            <span style={{ opacity: 0.7, fontSize: '10px', color: 'var(--text-muted)' }}>
              {' '}
              @{activityDetail}
            </span>
          )}

          {/* 悬停时显示的删除按钮 */}
          <span
            className="tag-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteActivity(activity.id);
            }}
            style={{
              marginLeft: '6px',
              padding: '0 4px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.8)',
              color: 'var(--text-muted)',
              fontSize: '10px',
              display: 'none',
              cursor: 'pointer'
            }}
          >
            ×
          </span>
        </div>
      );
    }

    // 极简式
    if (cardStyle === 'minimal') {
      if (compact) {
        return (
          <div
            className="activity-card-minimal compact"
            style={{
              borderLeft: `2px solid ${group?.color}`,
              marginBottom: '4px',
              cursor: 'grab',
              backgroundColor: 'rgba(255,255,255,0.06)',
              padding: '2px 8px',
              borderRadius: '0 4px 4px 0',
              position: 'relative'
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleCellClick(null, null, [activity]);
            }}
          >
            {renderDayMarkers()}
            <div className="activity-card-line activity-card-group">{group?.name}</div>
            {activityDetail && (
              <div className="activity-card-line activity-card-location">{activityDetail}</div>
            )}
            <span
              className="minimal-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteActivity(activity.id);
              }}
              style={{
                padding: '0 4px',
                color: 'var(--text-muted)',
                fontSize: '10px',
                display: 'none',
                cursor: 'pointer'
              }}
            >
              ×
            </span>
          </div>
        );
      }

      return (
        <div
          className="activity-card-minimal"
          style={{
            borderLeft: `2px solid ${group?.color}`,
            marginBottom: '4px',
            fontSize: '11px',
            cursor: 'grab',
            backgroundColor: 'rgba(255,255,255,0.06)',
            padding: '2px 8px',
            borderRadius: '0 4px 4px 0',
            position: 'relative'
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleCellClick(null, null, [activity]);
          }}
        >
          {renderDayMarkers()}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: '500', lineHeight: '16px', color: 'var(--text-strong)' }}>{group?.name}</div>
            <span
              className="minimal-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteActivity(activity.id);
              }}
              style={{
                padding: '0 4px',
                color: 'var(--text-muted)',
                fontSize: '10px',
                display: 'none',
                cursor: 'pointer'
              }}
            >
              ×
            </span>
          </div>
          {activityDetail && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '14px' }}>
              {activityDetail}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // 点击时间格子
  const handleCellClick = (date, timeSlot, activities, slotConflictInfo = null) => {
    const nextSelectedTimeSlot = {
      date: date ? formatDateString(date) : '',
      timeSlot,
      activities
    };
    setSelectedTimeSlot(nextSelectedTimeSlot);

    if (slotConflictInfo?.conflicts?.length) {
      setModalVisible(false);
      setSelectedSlotConflict({
        ...slotConflictInfo,
        date: nextSelectedTimeSlot.date,
        timeSlot
      });
      return;
    }

    setSelectedSlotConflict(null);
    setModalVisible(true);
  };

  const handleOpenEditFromConflict = () => {
    setSelectedSlotConflict(null);
    setModalVisible(true);
  };

  // 添加新活动
  const handleAddActivity = async (groupId, locationId, participantCount) => {
    const group = groups.find(g => g.id === groupId);
    const finalParticipantCount = participantCount || group?.student_count || 0;

    // 检查冲突
    const conflicts = checkConflicts(
      null, // 新活动没有ID
      groupId,
      locationId,
      selectedTimeSlot.date,
      selectedTimeSlot.timeSlot,
      finalParticipantCount
    );

    const addActivity = async () => {
      try {
        const newActivity = {
          groupId,
          locationId,
          date: selectedTimeSlot.date,
          timeSlot: selectedTimeSlot.timeSlot,
          participantCount: finalParticipantCount
        };

        const response = await api.post('/activities', newActivity);

        // 更新本地状态
        setActivities(prev => [...prev, response.data]);

        // 更新选中的时段活动
        const updatedActivities = [...selectedTimeSlot.activities, response.data];
        setSelectedTimeSlot(prev => ({...prev, activities: updatedActivities}));

        message.success('活动添加成功');
        refreshData();
      } catch (error) {
        message.error('添加活动失败');
      }
    };

    if (conflicts.length > 0) {
      await addActivity();
      return;
    }

    await addActivity();
  };

  // 删除活动
  const handleDeleteActivity = async (activityId) => {
    try {
      await api.delete(`/activities/${activityId}`);

      // 更新本地状态
      setActivities(prev => prev.filter(a => a.id !== activityId));

      // 更新选中的时段活动
      const updatedActivities = selectedTimeSlot.activities.filter(a => a.id !== activityId);
      setSelectedTimeSlot(prev => ({...prev, activities: updatedActivities}));

      message.success('活动删除成功');
      refreshData();
    } catch (error) {
      message.error('删除活动失败');
    }
  };

  // 更新活动
  const handleUpdateActivity = async (activityId, updates) => {
    try {
      const response = await api.put(`/activities/${activityId}`, updates);

      // 更新本地状态
      setActivities(prev => prev.map(a => a.id === activityId ? response.data : a));

      // 更新选中的时段活动
      if (selectedTimeSlot) {
        const updatedActivities = selectedTimeSlot.activities.map(a =>
          a.id === activityId ? response.data : a
        );
        setSelectedTimeSlot(prev => ({...prev, activities: updatedActivities}));
      }

      message.success('活动更新成功');
      refreshData();
    } catch (error) {
      message.error('更新活动失败');
    }
  };

  // 导出数据功能
  const exportData = () => {
    try {
      // 获取当前周的活动数据
      const exportActivities = activities.filter(a => {
        // 只导出选中团组的活动
        if (!selectedGroups.includes(a.groupId)) return false;

        // 只导出当前周的活动
        const activityDate = dayjs(a.date);
        return activityDate.isSame(currentWeek, 'week');
      });

      // 构建导出数据
      const exportData = exportActivities.map(activity => {
        const group = groups.find(g => g.id === activity.groupId);
        const location = locations.find(l => l.id === activity.locationId);

        return {
          日期: activity.date,
          时段: activity.timeSlot === 'MORNING' ? '上午' :
                activity.timeSlot === 'AFTERNOON' ? '下午' : '晚上',
          团组: group?.name || '',
          类型: group?.type === 'primary' ? '小学' : '中学',
          人数: activity.participantCount,
          地点: location?.name || '未安排',
          联系人: group?.contact_person || '',
          联系电话: group?.contact_phone || ''
        };
      });

      // 按日期和时段排序
      exportData.sort((a, b) => {
        if (a.日期 !== b.日期) return a.日期.localeCompare(b.日期);
        const timeOrder = { '上午': 0, '下午': 1, '晚上': 2 };
        return timeOrder[a.时段] - timeOrder[b.时段];
      });

      // 生成CSV内容
      if (exportData.length === 0) {
        message.warning('当前周没有可导出的活动数据');
        return;
      }

      const headers = ['日期', '时段', '团组', '类型', '人数', '地点', '联系人', '联系电话'];
      const csvContent = [
        headers.join(','),
        ...exportData.map(row =>
          headers.map(header => {
            const value = row[header] || '';
            // 如果值包含逗号或引号，需要用引号包裹并转义
            if (value.toString().includes(',') || value.toString().includes('"')) {
              return `"${value.toString().replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // 添加BOM以支持Excel正确识别UTF-8
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

      // 创建下载链接
      const link = document.createElement('a');
      const weekStart = currentWeek.format('YYYY-MM-DD');
      const weekEnd = currentWeek.endOf('week').format('YYYY-MM-DD');
      link.href = URL.createObjectURL(blob);
      link.download = `行程安排_${weekStart}_至_${weekEnd}.csv`;

      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      message.success('数据导出成功');
    } catch (error) {
      console.error('Export error:', error);
      message.error('数据导出失败');
    }
  };

  // 拖拽开始
  const handleDragStart = (e, activity) => {
    setDraggedActivity(activity);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');

    // 添加拖拽样式
    setTimeout(() => {
      e.target.classList.add('dragging');
    }, 0);
  };

  // 拖拽结束
  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    setDraggedActivity(null);
  };

  // 拖拽经过
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // 拖拽进入
  const handleDragEnter = (e) => {
    e.preventDefault();
    if (e.currentTarget.classList.contains('timeline-cell')) {
      e.currentTarget.classList.add('drag-over');
    }
  };

  // 拖拽离开
  const handleDragLeave = (e) => {
    if (e.currentTarget.classList.contains('timeline-cell')) {
      e.currentTarget.classList.remove('drag-over');
    }
  };

  // 检测冲突
  const checkConflicts = (activityId, groupId, locationId, date, timeSlot, participantCount) => {
    const conflicts = [];

    // 1. 检查同一团组的时间冲突
    const groupActivities = activities.filter(a =>
      a.groupId === groupId &&
      a.id !== activityId &&
      a.date === date &&
      a.timeSlot === timeSlot
    );

    if (groupActivities.length > 0) {
      conflicts.push({
        type: 'time',
        message: '该团组在此时段已有其他活动安排'
      });
    }

    // 2. 检查地点容量限制
    if (locationId) {
      const location = locations.find(l => l.id === locationId);
      if (location) {
        // 获取同一时段同一地点的所有活动
        const locationActivities = activities.filter(a =>
          a.locationId === locationId &&
          a.id !== activityId &&
          a.date === date &&
          a.timeSlot === timeSlot
        );

        const totalParticipants = locationActivities.reduce((sum, a) => sum + a.participantCount, 0) + participantCount;

        if (totalParticipants > location.capacity) {
          conflicts.push({
            type: 'capacity',
            message: `地点容量超限：${totalParticipants}/${location.capacity}人`
          });
        }

        // 3. 检查地点不可用日期
        const dayOfWeek = dayjs(date).day();
        const blockedWeekdays = (location.blocked_weekdays || '')
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);

        if (blockedWeekdays.includes(String(dayOfWeek))) {
          conflicts.push({
            type: 'unavailable',
            message: `${location.name}在${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayOfWeek]}不可用`
          });
        }

        // 4. 检查地点是否适用于团组类型
        const group = groups.find(g => g.id === groupId);
        const targetGroups = location.target_groups || 'all';
        if (group && targetGroups !== 'all' && targetGroups !== group.type) {
          conflicts.push({
            type: 'groupType',
            message: `${location.name}不适用于${group.type === 'primary' ? '小学' : '中学'}团组`
          });
        }
      }
    }

    return conflicts;
  };

  const getLocationUnavailableReason = (location, dateString) => {
    if (!location) return null;
    if (Number(location.is_active) === 0) {
      return `${location.name || '该地点'}已停用，不能拖入`;
    }
    const weekday = dayjs(dateString).day();
    const blockedWeekdays = parseDelimitedValues(location.blocked_weekdays);
    if (blockedWeekdays.includes(String(weekday))) {
      return `${location.name || '该地点'}在该日期不可用，不能拖入`;
    }
    const closedDates = new Set(parseDelimitedValues(location.closed_dates));
    if (closedDates.has(dateString)) {
      return `${location.name || '该地点'}在${dateString}闭馆，不能拖入`;
    }
    return null;
  };

  // 放置
  const handleDrop = async (e, targetDate, targetTimeSlot) => {
    e.preventDefault();
    if (e.currentTarget.classList.contains('timeline-cell')) {
      e.currentTarget.classList.remove('drag-over');
    }

    if (!draggedActivity) return;

    const targetDateString = formatDateString(targetDate);
    const targetGroup = groups.find(group => group.id === draggedActivity.groupId);
    if (!isDateWithinGroupRange(targetGroup, targetDateString)) {
      message.warning('不能拖入团组行程区间外的日期');
      return;
    }
    const targetLocation = locations.find(location => location.id === draggedActivity.locationId);
    const locationUnavailableReason = getLocationUnavailableReason(targetLocation, targetDateString);
    if (locationUnavailableReason) {
      message.warning(locationUnavailableReason);
      return;
    }

    // 检查是否移动到相同位置
    if (draggedActivity.date === targetDateString && draggedActivity.timeSlot === targetTimeSlot) {
      return;
    }

    try {
      await handleUpdateActivity(draggedActivity.id, {
        date: targetDateString,
        timeSlot: targetTimeSlot,
        ignoreConflicts: true
      });

      message.success('活动时间调整成功');
    } catch (error) {
      const errorMessage = error?.response?.data?.conflicts?.[0]?.message
        || error?.response?.data?.error
        || '调整活动时间失败';
      message.error(errorMessage);
    }
  };

  const GROUP_CONSOLE_DRAG_TYPE = 'application/x-ec-group-console';

  const readGroupConsoleDragPayload = (event) => {
    if (event?.dataTransfer) {
      const encoded = event.dataTransfer.getData(GROUP_CONSOLE_DRAG_TYPE);
      if (encoded) {
        try {
          const parsed = JSON.parse(encoded);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        } catch (error) {
          // ignore parse error and fallback to in-memory payload
        }
      }
    }
    return groupConsoleDragPayload;
  };

  const handleGroupConsoleCardDragStart = (event, payload) => {
    if (!payload || typeof payload !== 'object') return;
    setGroupConsoleDragPayload(payload);
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(payload.locationName || payload.locationId || ''));
      event.dataTransfer.setData(GROUP_CONSOLE_DRAG_TYPE, JSON.stringify(payload));
    }
  };

  const handleGroupConsoleCardDragEnd = () => {
    setGroupConsoleDragPayload(null);
    setGroupConsoleDropTarget(null);
  };

  const handleGroupConsoleCellDragOver = (event, inactive) => {
    if (inactive) return;
    event.preventDefault();
    if (event?.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };

  const handleGroupConsoleCellDragEnter = (event, dateString, slotKey, inactive) => {
    if (inactive) return;
    event.preventDefault();
    setGroupConsoleDropTarget({ date: dateString, slotKey });
  };

  const handleGroupConsoleCellDragLeave = (event, dateString, slotKey) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
      return;
    }
    setGroupConsoleDropTarget((prev) => (
      prev && prev.date === dateString && prev.slotKey === slotKey ? null : prev
    ));
  };

  const handleGroupConsoleRemoveActivity = async (activityId) => {
    if (!activityId) return;
    try {
      await api.delete(`/activities/${activityId}`);
      setActivities(prev => prev.filter(item => item.id !== activityId));
      message.success('安排已移除');
      refreshData();
    } catch (error) {
      message.error(getRequestErrorMessage(error, '移除安排失败'));
    }
  };

  const handleGroupConsoleClearSlot = (slotKey) => {
    if (!groupCalendarGroup) return;
    const slotActivities = groupCalendarActivities.filter((activity) => activity.timeSlot === slotKey);
    if (!slotActivities.length) {
      message.info(`${getTimeSlotLabel(slotKey)}暂无可清空安排`);
      return;
    }
    Modal.confirm({
      title: `清空${getTimeSlotLabel(slotKey)}安排？`,
      content: `将删除 ${slotActivities.length} 条活动，其他时段保持不变。`,
      okText: '确认清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await Promise.all(slotActivities.map((activity) => api.delete(`/activities/${activity.id}`)));
          const deleteIds = new Set(slotActivities.map(activity => activity.id));
          setActivities(prev => prev.filter(activity => !deleteIds.has(activity.id)));
          message.success(`${getTimeSlotLabel(slotKey)}已清空`);
          refreshData();
        } catch (error) {
          message.error(getRequestErrorMessage(error, '清空失败'));
        }
      }
    });
  };

  const handleGroupConsoleDrop = async (event, targetDate, slotKey, inactive) => {
    event.preventDefault();
    setGroupConsoleDropTarget(null);
    if (inactive || !groupCalendarGroup) return;
    const payload = readGroupConsoleDragPayload(event);
    setGroupConsoleDragPayload(null);
    if (!payload) return;

    const targetDateString = formatDateString(targetDate);
    if (!targetDateString) return;
    if (!isDateWithinGroupRange(groupCalendarGroup, targetDateString)) {
      message.warning('不能拖入团组行程区间外的日期');
      return;
    }

    const locationId = Number(payload.locationId);
    if (!Number.isFinite(locationId) || locationId <= 0) {
      message.warning('该卡片缺少地点，无法安排');
      return;
    }

    const targetLocation = locations.find(location => Number(location.id) === locationId);
    const locationUnavailableReason = getLocationUnavailableReason(targetLocation, targetDateString);
    if (locationUnavailableReason) {
      message.warning(locationUnavailableReason);
      return;
    }

    const fallbackAssignments = groupConsoleMustVisitActivityMap.get(locationId) || [];
    let movingActivity = null;
    const payloadActivityId = Number(payload.activityId);
    if (Number.isFinite(payloadActivityId)) {
      movingActivity = groupCalendarActivities.find(activity => Number(activity.id) === payloadActivityId) || null;
    }
    if (!movingActivity && fallbackAssignments.length > 0) {
      movingActivity = fallbackAssignments[0];
    }

    try {
      if (movingActivity) {
        const samePosition = (
          movingActivity.date === targetDateString
          && movingActivity.timeSlot === slotKey
          && Number(movingActivity.locationId) === locationId
        );
        if (samePosition) {
          return;
        }
        await handleUpdateActivity(movingActivity.id, {
          date: targetDateString,
          timeSlot: slotKey,
          locationId,
          ignoreConflicts: true
        });
        if (fallbackAssignments.length > 1) {
          message.warning(`${targetLocation?.name || `#${locationId}`} 存在重复安排，请手动清理其余 ${fallbackAssignments.length - 1} 条`);
        }
        return;
      }

      const participantCount = (
        Number(groupCalendarGroup.student_count || 0)
        + Number(groupCalendarGroup.teacher_count || 0)
      ) || 1;
      const response = await api.post('/activities', {
        groupId: groupCalendarGroup.id,
        locationId,
        date: targetDateString,
        timeSlot: slotKey,
        participantCount
      });
      setActivities(prev => [...prev, response.data]);
      message.success('必去行程点已安排');
      refreshData();
    } catch (error) {
      message.error(getRequestErrorMessage(error, '安排失败'));
    }
  };

  const planningImportPayloadGroupIds = planningImportPayload
    ? extractPlanningGroupIds(planningImportPayload)
    : [];
  const planningImportRange = planningImportPayload
    ? extractPlanningRange(planningImportPayload)
    : null;
  const planningImportAssignmentsCount = planningImportPayload
    ? extractPlanningAssignments(planningImportPayload).length
    : 0;
  const planningImportOnlySelectedValue = planningImportOnlySelected !== false;
  const planningImportSelectedGroupIds = planningImportOnlySelectedValue
    ? selectedGroups.filter(id => planningImportPayloadGroupIds.includes(id))
    : (planningImportGroupIds || []).filter(id => planningImportPayloadGroupIds.includes(id));
  const planningImportSummary = planningImportResult?.summary || null;
  const planningImportConflicts = planningImportResult?.conflicts || [];
  const planningConflictTodayDate = dayjs().format('YYYY-MM-DD');
  const planningSlotOrder = {
    MORNING: 0,
    AFTERNOON: 1,
    EVENING: 2
  };
  const planningConflictRows = useMemo(() => (
    planningImportConflicts.map((item, index) => {
      const rawReasons = Array.isArray(item.reasons) && item.reasons.length
        ? item.reasons
        : [item.reason].filter(Boolean);
      const reasonCode = String(rawReasons[0] || '').trim() || 'UNKNOWN';
      const groupId = Number(item.groupId ?? item.group_id);
      const locationId = Number(item.locationId ?? item.location_id);
      const groupLabel = item.groupName
        || item.group_name
        || (groups.find(g => g.id === groupId)?.name || (Number.isFinite(groupId) ? `#${groupId}` : '未知团组'));
      const locationLabel = item.locationName
        || item.location_name
        || (Number.isFinite(locationId) ? (locations.find(loc => loc.id === locationId)?.name || `#${locationId}`) : '未指定地点');
      const slotKey = item.timeSlot ?? item.time_slot ?? '';
      const slotLabel = slotKey ? getTimeSlotLabel(slotKey) : '未知时段';
      const reasonLabel = item.reasonMessage || getPlanningConflictReasonLabel(reasonCode);
      const manualRequired = rawReasons.some(isPlanningConflictManualRequired);
      const suggestion = getPlanningConflictHandlingTip(reasonCode);
      const dateText = item.date || '-';
      const dateValue = dayjs(dateText).isValid() ? dayjs(dateText).valueOf() : Number.MAX_SAFE_INTEGER;
      return {
        key: `${groupId || 'g'}-${item.date || 'd'}-${slotKey || 's'}-${locationId || 'l'}-${reasonCode}-${index}`,
        date: dateText,
        dateValue,
        groupId: Number.isFinite(groupId) ? groupId : null,
        groupLabel,
        locationId: Number.isFinite(locationId) ? locationId : null,
        locationLabel,
        slotKey,
        slotLabel,
        reasonCode,
        reasonLabel,
        manualRequired,
        suggestion
      };
    })
  ), [planningImportConflicts, groups, locations]);
  const planningConflictBuckets = useMemo(() => {
    const bucketMap = new Map();
    planningConflictRows.forEach((row) => {
      const key = row.reasonCode || 'UNKNOWN';
      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          reasonCode: key,
          reasonLabel: getPlanningConflictReasonLabel(key),
          count: 0,
          manualRequiredCount: 0
        });
      }
      const bucket = bucketMap.get(key);
      bucket.count += 1;
      if (row.manualRequired) bucket.manualRequiredCount += 1;
    });
    return Array.from(bucketMap.values()).sort((a, b) => b.count - a.count);
  }, [planningConflictRows]);
  const planningConflictFilteredRows = useMemo(() => {
    const filtered = planningConflictRows.filter((row) => {
      if (planningConflictManualOnly && !row.manualRequired) return false;
      if (planningConflictActiveReason !== 'ALL' && row.reasonCode !== planningConflictActiveReason) return false;
      if (planningConflictTodayOnly && row.date !== planningConflictTodayDate) return false;
      return true;
    });
    return filtered.sort((left, right) => {
      if (planningConflictSortBy === 'GROUP_ASC') {
        if (left.groupLabel !== right.groupLabel) {
          return String(left.groupLabel).localeCompare(String(right.groupLabel), 'zh-CN');
        }
        if (left.dateValue !== right.dateValue) return left.dateValue - right.dateValue;
        return (planningSlotOrder[left.slotKey] ?? 99) - (planningSlotOrder[right.slotKey] ?? 99);
      }
      if (planningConflictSortBy === 'DATE_DESC') {
        if (left.dateValue !== right.dateValue) return right.dateValue - left.dateValue;
        if ((planningSlotOrder[left.slotKey] ?? 99) !== (planningSlotOrder[right.slotKey] ?? 99)) {
          return (planningSlotOrder[right.slotKey] ?? 99) - (planningSlotOrder[left.slotKey] ?? 99);
        }
        return String(left.groupLabel).localeCompare(String(right.groupLabel), 'zh-CN');
      }
      if (left.dateValue !== right.dateValue) return left.dateValue - right.dateValue;
      if ((planningSlotOrder[left.slotKey] ?? 99) !== (planningSlotOrder[right.slotKey] ?? 99)) {
        return (planningSlotOrder[left.slotKey] ?? 99) - (planningSlotOrder[right.slotKey] ?? 99);
      }
      return String(left.groupLabel).localeCompare(String(right.groupLabel), 'zh-CN');
    });
  }, [
    planningConflictRows,
    planningConflictManualOnly,
    planningConflictActiveReason,
    planningConflictTodayOnly,
    planningConflictTodayDate,
    planningConflictSortBy
  ]);
  const planningConflictTodayCount = useMemo(() => (
    planningConflictRows.filter((row) => row.date === planningConflictTodayDate).length
  ), [planningConflictRows, planningConflictTodayDate]);
  const planningImportFile = planningImportFileList[0];
  const groupCalendarDetailGroup = groups.find(group => group.id === groupCalendarDetailGroupId);
  const groupCalendarDetailAvailableHeight = groupCalendarVisible ? groupCalendarHeight : 0;
  const groupCalendarDetailHeight = Math.max(20, 100 - groupCalendarDetailAvailableHeight);
  const groupCalendarDetailTop = 0;
  const groupCalendarSlotKeys = ['MORNING', 'AFTERNOON'];
  const groupCalendarGroup = groups.find(group => group.id === groupCalendarGroupId);
  const groupConsoleDates = groupCalendarGroup
    ? getGroupDateRange(groupCalendarGroup)
    : dateRange;
  const groupCalendarActivities = groupCalendarGroup
    ? activities.filter(activity => activity.groupId === groupCalendarGroup.id)
    : [];
  const groupCalendarIndex = new Map();
  if (groupCalendarGroup) {
    groupCalendarActivities.forEach((activity) => {
      if (!groupCalendarSlotKeys.includes(activity.timeSlot)) return;
      const key = `${activity.date}|${activity.timeSlot}`;
      if (!groupCalendarIndex.has(key)) {
        groupCalendarIndex.set(key, []);
      }
      groupCalendarIndex.get(key).push(activity);
    });
  }
  const groupCalendarLocationMap = new Map(locations.map(location => [Number(location.id), location]));
  const groupCalendarSlotOrder = {
    MORNING: 0,
    AFTERNOON: 1
  };
  const groupConsoleManualMustVisitIds = normalizeManualMustVisitLocationIds(
    groupCalendarGroup?.manual_must_visit_location_ids
  );
  const groupConsoleFallbackMode = groupConsoleManualMustVisitIds.length > 0 ? 'manual' : 'plan';
  const groupConsoleMustVisitMode = normalizeMustVisitMode(
    groupCalendarGroup?.must_visit_mode,
    groupConsoleFallbackMode
  );
  const groupConsoleActivePlan = Number.isFinite(Number(groupCalendarGroup?.itinerary_plan_id))
    ? itineraryPlanById.get(Number(groupCalendarGroup.itinerary_plan_id)) || null
    : null;
  const groupConsolePlanMustVisitIds = extractPlanLocationIds(groupConsoleActivePlan?.items || []);
  const groupConsoleMustVisitIds = Array.from(new Set(
    (groupConsoleMustVisitMode === 'manual'
      ? groupConsoleManualMustVisitIds
      : groupConsolePlanMustVisitIds)
      .map(id => Number(id))
      .filter(id => Number.isFinite(id) && id > 0)
  ));
  const groupConsoleMustVisitIdSet = new Set(groupConsoleMustVisitIds);
  const groupConsoleMustVisitActivityMap = new Map();
  groupCalendarActivities.forEach((activity) => {
    if (!groupCalendarSlotKeys.includes(activity.timeSlot)) return;
    const locationId = Number(activity.locationId);
    if (!Number.isFinite(locationId) || !groupConsoleMustVisitIdSet.has(locationId)) return;
    if (!groupConsoleMustVisitActivityMap.has(locationId)) {
      groupConsoleMustVisitActivityMap.set(locationId, []);
    }
    groupConsoleMustVisitActivityMap.get(locationId).push(activity);
  });
  groupConsoleMustVisitActivityMap.forEach((items) => {
    items.sort((left, right) => {
      if (left.date !== right.date) return String(left.date).localeCompare(String(right.date), 'zh-CN');
      return (groupCalendarSlotOrder[left.timeSlot] ?? 99) - (groupCalendarSlotOrder[right.timeSlot] ?? 99);
    });
  });
  const groupConsoleMustVisitCards = groupConsoleMustVisitIds.map((locationId) => {
    const location = groupCalendarLocationMap.get(locationId);
    const assignedActivities = groupConsoleMustVisitActivityMap.get(locationId) || [];
    return {
      locationId,
      locationName: location?.name || `#${locationId}`,
      assignedActivity: assignedActivities[0] || null,
      duplicateCount: Math.max(0, assignedActivities.length - 1)
    };
  });
  const groupConsoleUnassignedMustVisitCards = groupConsoleMustVisitCards.filter(
    (card) => !card.assignedActivity
  );
  const groupConsoleAssignedMustVisitCount = groupConsoleMustVisitCards.length - groupConsoleUnassignedMustVisitCards.length;
  const groupConsoleTypeLabel = groupCalendarGroup?.type === 'primary'
    ? '小学'
    : groupCalendarGroup?.type === 'secondary'
      ? '中学'
      : '团组';
  const groupConsoleSchedule = groupCalendarSlotKeys.map((slotKey) => ({
    key: slotKey,
    label: getTimeSlotLabel(slotKey),
    cells: groupConsoleDates.map((date) => {
      const dateString = formatDateString(date);
      const inactive = !groupCalendarGroup || !isGroupActiveOnDate(groupCalendarGroup, date);
      const items = (groupCalendarIndex.get(`${dateString}|${slotKey}`) || [])
        .slice()
        .sort((left, right) => Number(left.id) - Number(right.id))
        .map((activity) => {
          const locationId = Number(activity.locationId);
          const location = groupCalendarLocationMap.get(locationId);
          const locationName = location?.name
            || (activity?.notes ? String(activity.notes) : '')
            || '未设置场地';
          return {
            ...activity,
            locationId,
            locationName,
            isMustVisit: Number.isFinite(locationId) && groupConsoleMustVisitIdSet.has(locationId)
          };
        });
      return {
        key: `${dateString}|${slotKey}`,
        date,
        dateString,
        inactive,
        activities: items
      };
    })
  }));
  if (loading && groups.length === 0 && activities.length === 0) {
    return <ItineraryDesignerSkeleton />;
  }

  if (!canAccess('designer')) {
    return (
      <Result
        status="403"
        title="无权限"
        subTitle="仅管理员可访问行程设计器"
      />
    );
  }
  return (
    <div className="itinerary-designer" ref={designerRef}>
      {renderTimelineHeader()}

      <div className="itinerary-body">
        {/* 中央时间轴 */}
        <div className="itinerary-center">
        <div className="timeline-wrapper">
          {renderTimelineGrid()}
        </div>
      </div>
      </div>

      <Drawer
        title="团组控制台"
        placement="left"
        open={groupPanelVisible}
        onClose={() => setGroupPanelVisible(false)}
        width={240}
        mask={false}
        closable
        bodyStyle={{ padding: 0 }}
        getContainer={false}
        style={{ position: 'absolute' }}
      >
        {renderGroupPanel(false)}
      </Drawer>

      <GroupConsoleDrawer
        open={groupCalendarVisible}
        onClose={() => setGroupCalendarVisible(false)}
        heightVh={groupCalendarHeight}
        resizing={groupCalendarResizing}
        onResizeStart={handleGroupCalendarResizeStart}
        getContainer={getDesignerContainer}
        group={groupCalendarGroup}
        groupConsoleTypeLabel={groupConsoleTypeLabel}
        groupConsoleUnassignedMustVisitCards={groupConsoleUnassignedMustVisitCards}
        groupConsoleMustVisitCards={groupConsoleMustVisitCards}
        groupConsoleMustVisitMode={groupConsoleMustVisitMode}
        groupConsoleActivePlan={groupConsoleActivePlan}
        groupConsoleAssignedMustVisitCount={groupConsoleAssignedMustVisitCount}
        groupConsoleDates={groupConsoleDates}
        groupConsoleSchedule={groupConsoleSchedule}
        groupConsoleDropTarget={groupConsoleDropTarget}
        formatDateString={formatDateString}
        onCardDragStart={handleGroupConsoleCardDragStart}
        onCardDragEnd={handleGroupConsoleCardDragEnd}
        onClearSlot={handleGroupConsoleClearSlot}
        onOpenCalendarDetail={() => openGroupCalendarDetail(groupCalendarGroup.id)}
        onCellDragOver={handleGroupConsoleCellDragOver}
        onCellDragEnter={handleGroupConsoleCellDragEnter}
        onCellDragLeave={handleGroupConsoleCellDragLeave}
        onDrop={handleGroupConsoleDrop}
        onRemoveActivity={handleGroupConsoleRemoveActivity}
      />

      <Modal
        open={groupCalendarDetailVisible}
        onCancel={() => setGroupCalendarDetailVisible(false)}
        footer={null}
        closable={false}
        mask={false}
        width="100%"
        className="group-calendar-detail-modal"
        wrapClassName="group-calendar-detail-wrap itinerary-modal-wrap"
        style={{ top: `${groupCalendarDetailTop}vh` }}
        styles={{
          ...overlayStyles,
          body: { padding: 0, height: `${groupCalendarDetailHeight}vh` }
        }}
        getContainer={getDesignerContainer}
      >
        <div className="group-calendar-detail">
          <div className="group-calendar-detail-header">
            <div className="group-calendar-detail-info">
              <span
                className="group-color-dot"
                style={{ backgroundColor: groupCalendarDetailGroup?.color || '#d9d9d9' }}
              />
              <span className="group-calendar-detail-name">
                {groupCalendarDetailGroup?.name || '\u672a\u9009\u62e9\u56e2\u7ec4'}
              </span>
              {groupCalendarDetailGroup && (
                <span className="group-calendar-detail-dates">
                  {dayjs(groupCalendarDetailGroup.start_date).format('YYYY-MM-DD')} ~ {dayjs(groupCalendarDetailGroup.end_date).format('YYYY-MM-DD')}
                </span>
              )}
            </div>
            <div className="group-calendar-detail-actions">
              <Tooltip title={groupCalendarDetailResourcesVisible ? '收起资源栏' : '展开资源栏'}>
                <Button
                  size="small"
                  type="text"
                  icon={groupCalendarDetailResourcesVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
                  onClick={() => setGroupCalendarDetailResourcesVisible(prev => !prev)}
                />
              </Tooltip>
              <Button
                size="small"
                type="text"
                icon={<CloseOutlined />}
                onClick={() => setGroupCalendarDetailVisible(false)}
              />
            </div>
          </div>
          <div className="group-calendar-detail-body">
            <CalendarDaysView
              groupData={groupCalendarDetailGroup}
              schedules={groupCalendarDetailSchedules}
              onUpdate={handleGroupCalendarDetailUpdate}
              onPushedToDesigner={() => refreshActivitiesOnly()}
              showResources={groupCalendarDetailResourcesVisible}
              resourceWidth="25%"
              loading={groupCalendarDetailLoading}
            />
          </div>
        </div>
      </Modal>

      <SlotConflictModal
        conflictInfo={selectedSlotConflict}
        onClose={() => setSelectedSlotConflict(null)}
        getContainer={getDesignerContainer}
        overlayStyles={overlayStyles}
        getTimeSlotLabel={getTimeSlotLabel}
        onOpenEdit={handleOpenEditFromConflict}
        canOpenEdit={Boolean(selectedTimeSlot)}
      />

      {/* 详情编辑弹窗 */}
      <Modal
        title={`编辑行程 - ${selectedTimeSlot?.date} ${timeSlots.find(t => t.key === selectedTimeSlot?.timeSlot)?.label}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        wrapClassName="itinerary-modal-wrap"
        footer={null}
        getContainer={getDesignerContainer}
        styles={overlayStyles}
      >
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {/* 添加活动按钮 */}
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                form.setFieldValue('date', selectedTimeSlot?.date);
                form.setFieldValue('timeSlot', selectedTimeSlot?.timeSlot);
              }}
              style={{ width: '100%', height: '40px' }}
            >
              添加团组活动
            </Button>
          </div>

          {/* 添加活动表单 */}
          <Form
            form={form}
            layout="inline"
            onFinish={(values) => {
              handleAddActivity(values.groupId, values.locationId, values.participantCount);
              form.resetFields();
            }}
            style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '6px' }}
          >
            <Form.Item name="groupId" label="选择团组" rules={[{ required: true, message: '请选择团组' }]}>
              <Select placeholder="选择团组" style={{ width: 150 }}>
                {groups.filter(g => selectedGroups.includes(g.id)).map(group => (
                  <Option key={group.id} value={group.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          backgroundColor: group.color,
                          borderRadius: '50%'
                        }}
                      />
                      {group.name}
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="locationId" label="选择地点">
              <Select placeholder="选择地点" allowClear style={{ width: 150 }}>
                {locations.map(location => (
                  <Option key={location.id} value={location.id}>
                    {location.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="participantCount" label="参与人数">
              <InputNumber placeholder="人数" min={1} style={{ width: 80 }} />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" size="small">
                添加
              </Button>
            </Form.Item>
          </Form>

          {/* 现有活动列表 */}
          {selectedTimeSlot?.activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              该时段暂无安排
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
              {selectedTimeSlot?.activities.map(activity => {
                const group = groups.find(g => g.id === activity.groupId);
                const location = locations.find(l => l.id === activity.locationId);

                return (
                  <Card key={activity.id} size="small" style={{ backgroundColor: group?.color + '20' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: group?.color,
                          borderRadius: '2px'
                        }}
                      />
                      <span style={{ fontWeight: 'bold' }}>{group?.name}</span>
                    </div>

                    {/* 可编辑的地点选择 */}
                    <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                      📍 地点:
                      <Select
                        size="small"
                        value={activity.locationId}
                        placeholder="选择地点"
                        allowClear
                        style={{ width: '100%', marginLeft: '4px' }}
                        onChange={(value) => handleUpdateActivity(activity.id, { locationId: value })}
                      >
                        {locations.map(loc => (
                          <Option key={loc.id} value={loc.id}>
                            {loc.name}
                          </Option>
                        ))}
                      </Select>
                    </div>

                    {/* 可编辑的人数 */}
                    <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                      👥 人数:
                      <InputNumber
                        size="small"
                        value={activity.participantCount}
                        min={1}
                        style={{ width: '80px', marginLeft: '4px' }}
                        onChange={(value) => handleUpdateActivity(activity.id, { participantCount: value })}
                      />
                      人
                    </div>

                    <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                      <Button
                        size="small"
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() => handleDeleteActivity(activity.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      
      
      <PlanningImportModal
        open={planningImportVisible}
        onClose={() => setPlanningImportVisible(false)}
        getContainer={getDesignerContainer}
        overlayStyles={overlayStyles}
        planningImportFileList={planningImportFileList}
        handlePlanningImportFile={handlePlanningImportFile}
        handlePlanningImportRemove={handlePlanningImportRemove}
        planningImportPayload={planningImportPayload}
        planningImportFile={planningImportFile}
        planningImportRange={planningImportRange}
        planningImportAssignmentsCount={planningImportAssignmentsCount}
        planningImportPayloadGroupIds={planningImportPayloadGroupIds}
        planningImportForm={planningImportForm}
        setPlanningImportValidatedKey={setPlanningImportValidatedKey}
        planningImportOnlySelectedValue={planningImportOnlySelectedValue}
        planningImportSelectedGroupIds={planningImportSelectedGroupIds}
        groups={groups}
        handlePlanningImportRollback={handlePlanningImportRollback}
        planningImportRollbackLoading={planningImportRollbackLoading}
        planningImportSnapshotToken={planningImportSnapshotToken}
        handlePlanningImportValidate={handlePlanningImportValidate}
        planningImportValidating={planningImportValidating}
        handlePlanningImportApply={handlePlanningImportApply}
        planningImportLoading={planningImportLoading}
        planningImportValidatedKey={planningImportValidatedKey}
        planningImportResult={planningImportResult}
        planningImportSummary={planningImportSummary}
        planningImportConflicts={planningImportConflicts}
        planningConflictActiveReason={planningConflictActiveReason}
        setPlanningConflictActiveReason={setPlanningConflictActiveReason}
        planningConflictRows={planningConflictRows}
        planningConflictBuckets={planningConflictBuckets}
        planningConflictManualOnly={planningConflictManualOnly}
        setPlanningConflictManualOnly={setPlanningConflictManualOnly}
        planningConflictTodayOnly={planningConflictTodayOnly}
        setPlanningConflictTodayOnly={setPlanningConflictTodayOnly}
        planningConflictTodayCount={planningConflictTodayCount}
        planningConflictSortBy={planningConflictSortBy}
        setPlanningConflictSortBy={setPlanningConflictSortBy}
        planningConflictTodayDate={planningConflictTodayDate}
        planningConflictFilteredRows={planningConflictFilteredRows}
      />


      <PlanningExportModal
        open={planningExportVisible}
        onClose={() => setPlanningExportVisible(false)}
        getContainer={getDesignerContainer}
        overlayStyles={overlayStyles}
        planningForm={planningForm}
        planningAvailableGroups={planningAvailableGroups}
        planningDateRange={planningDateRange}
        handlePlanningExportCsv={handlePlanningExportCsv}
        planningExportCsvLoading={planningExportCsvLoading}
        handlePlanningExport={handlePlanningExport}
        planningExportLoading={planningExportLoading}
        planningMissingMustVisitGroupIds={planningMissingMustVisitGroupIds}
        planningMissingMustVisitGroups={planningMissingMustVisitGroups}
      />

    </div>
  );
}

export default ItineraryDesigner;



















