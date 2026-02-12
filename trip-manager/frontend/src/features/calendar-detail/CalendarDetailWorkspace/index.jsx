
import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import { Button, DatePicker, Modal, message } from 'antd';
import dayjs from 'dayjs';
import api from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import CalendarDetailTimeGrid from './components/CalendarDetailTimeGrid';
import CalendarDetailSidebar from './components/CalendarDetailSidebar';
import CalendarDetailResourceLibrary from './components/CalendarDetailResourceLibrary';
import CalendarDetailEventEditorPopover from './components/CalendarDetailEventEditorPopover';
import CalendarDetailEventChip from './components/CalendarDetailEventChip';
import CalendarDetailSkeleton from './CalendarDetailSkeleton';
import useCalendarDetailShixingResources from './hooks/useCalendarDetailShixingResources';
import useCalendarDetailDesignerSync from './hooks/useCalendarDetailDesignerSync';
import useCalendarDetailMustVisitPool from './hooks/useCalendarDetailMustVisitPool';
import { buildCalendarDays, computeWindow, generateTimeSlots } from './model/calendarWindow';
import '../CalendarDetail.css';
import './styles.css';

import { buildClientId } from './utils/clientId';
import { hashString } from './utils/hash';
import { isDailyActivity, parseDailyDate } from './utils/calendarDetailResourceId';
import { calcDurationHours, calcDurationMinutes } from './utils/time';
import {
  buildShixingResourceId,
  getResourceId,
  isCustomResourceId,
  isPlanResourceId,
  isShixingResourceId,
  parseShixingResourceId
} from '../../../domain/resourceId';
import { resolveSourceMeta, resolveSourceMetaByKind } from '../../../domain/resourceSource';

const START_HOUR = 6;
const END_HOUR = 20;
const SLOT_MINUTES = 15;
const HEADER_HEIGHT = 30;
const SLOT_HEIGHT = 10;
const MIN_SLOT_HEIGHT = 8;
const SLOTS_PER_HOUR = Math.max(1, Math.round(60 / SLOT_MINUTES));

const DEFAULT_PLAN_DURATION = 2;
const MAX_FULL_DAYS = 9;
const DEFAULT_WINDOW_DAYS = 7;
const SHIXING_MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];
const SHIXING_MEAL_LABELS = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐'
};
const SHIXING_TRANSFER_LABELS = {
  pickup: '接站',
  dropoff: '送站'
};
const LEGACY_MEAL_TITLES = new Set([
  '早餐',
  '午餐',
  '晚餐',
  '早饭',
  '午饭',
  '晚饭'
]);
const SHIXING_MEAL_DEFAULTS = {
  breakfast: { start: '07:30', end: '08:30' },
  lunch: { start: '12:00', end: '13:00' },
  dinner: { start: '18:00', end: '19:00' }
};

const CalendarDetailWorkspace = ({
  groupData,
  schedules = [],
  onUpdate,
  onLogisticsUpdate,
  onPlanChange,
  onPushedToDesigner,
  onCustomResourcesChange,
  showResources = true,
  resourceWidth,
  loading = false
}) => {
  const [itineraryPlans, setItineraryPlans] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(groupData?.itinerary_plan_id ?? null);
  const [activities, setActivities] = useState(schedules);
  const [viewStartIndex, setViewStartIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [draggedActivity, setDraggedActivity] = useState(null);
  const [draggedResource, setDraggedResource] = useState(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [resizingActivity, setResizingActivity] = useState(null);
  const [, setSaveStatus] = useState('saved');
  const saveTimeoutRef = useRef(null);
  const [dropIndicator, setDropIndicator] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const calendarRef = useRef(null);
  const scrollWrapperRef = useRef(null);
  const [slotHeight, setSlotHeight] = useState(SLOT_HEIGHT);
  const [popoverState, setPopoverState] = useState({
    isOpen: false,
    mode: 'create',
    anchorRect: null,
    activity: null,
    initialValues: null
  });

  const resourcePanelStyle = resourceWidth ? { width: resourceWidth } : undefined;
  const groupId = groupData?.id ?? null;

  const { canAccess } = useAuth();
  const canSyncDesigner = canAccess?.('designer', 'write');

  useEffect(() => {
    let isMounted = true;

    const loadPlans = async () => {
      try {
        const response = await api.get('/itinerary-plans');
        if (!isMounted) return;
        setItineraryPlans(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        if (!isMounted) return;
        setItineraryPlans([]);
      }
    };

    const loadLocations = async () => {
      try {
        const response = await api.get('/locations');
        if (!isMounted) return;
        setLocations(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        if (!isMounted) return;
        setLocations([]);
      }
    };

    loadPlans();
    loadLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setActivities(schedules || []);
  }, [groupData?.id, schedules]);

  useEffect(() => {
    setSelectedPlanId(groupData?.itinerary_plan_id ?? null);
  }, [groupData?.itinerary_plan_id]);

  const isLocationSchedule = useCallback((schedule) => {
    const locationId = Number(schedule?.locationId ?? schedule?.location_id);
    return Number.isFinite(locationId) && locationId > 0;
  }, []);

  const handleResetSchedules = () => {
    Modal.confirm({
      title: '确认重置行程？',
      content: '将清空当前日历中的所有日程，且无法恢复。',
      okText: '确认重置',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        setActivities([]);
        onUpdate?.([]);
        message.success('已清空所有日程', 1);
      }
    });
  };

  const {
    designerSourceState,
    pullingFromDesigner,
    pushingToDesigner,
    pullFromDesigner: handlePullFromDesigner,
    pushToDesigner: handlePushToDesigner
  } = useCalendarDetailDesignerSync({
    groupId,
    canSyncDesigner,
    activities,
    setActivities,
    isLocationSchedule,
    onUpdate,
    onPushedToDesigner
  });

  const {
    planResources,
    availablePlanResources,
    setAvailablePlanResources
  } = useCalendarDetailMustVisitPool({
    selectedPlanId,
    itineraryPlans,
    designerSourceList: designerSourceState.list,
    manualMustVisitLocationIds: groupData?.manual_must_visit_location_ids,
    locations,
    activities,
    schedules
  });

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      if (isDragging || draggedActivity || draggedResource) {
        setDraggedActivity(null);
        setDraggedResource(null);
        dragOffsetRef.current = { x: 0, y: 0 };
        setDropIndicator(null);
        setIsDragging(false);
      }
    };

    document.addEventListener('dragend', handleGlobalDragEnd);
    return () => document.removeEventListener('dragend', handleGlobalDragEnd);
  }, [isDragging, draggedActivity, draggedResource]);

  useEffect(() => {
    if (!popoverState.isOpen) return;
    const handleOutsideClick = () => {
      setPopoverState((prev) => ({ ...prev, isOpen: false }));
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setPopoverState((prev) => ({ ...prev, isOpen: false }));
      }
    };
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [popoverState.isOpen]);

  const activityTypes = {
    meal: { label: '餐饮', color: '#52c41a', icon: '' },
    visit: { label: '参观', color: '#1890ff', icon: '' },
    transport: { label: '交通', color: '#fa8c16', icon: '' },
    rest: { label: '休息', color: '#8c8c8c', icon: '' },
    activity: { label: '活动', color: '#722ed1', icon: '' },
    free: { label: '自由活动', color: '#13c2c2', icon: '' }
  };

  const locationColorMap = useMemo(() => {
    const entries = Array.isArray(locations)
      ? locations
          .map((loc) => [Number(loc.id), loc.color])
          .filter(([id, color]) => Number.isFinite(id) && color)
      : [];
    return new Map(entries);
  }, [locations]);

  const resolveLocationColor = (locationId, fallbackColor) => {
    const id = Number(locationId);
    if (Number.isFinite(id)) {
      const color = locationColorMap.get(id);
      if (color) return color;
    }
    return fallbackColor || null;
  };

  const resolveActivityColor = ({ type, locationId, locationColor }) => {
    if (type === 'visit') {
      return resolveLocationColor(locationId, locationColor)
        || activityTypes.visit?.color
        || '#1890ff';
    }
    return activityTypes[type]?.color || '#1890ff';
  };

  const getActivityIdentity = (activity) => (
    activity
      ? (
        activity.id
          ?? activity.clientId
          ?? `${activity.date || 'date'}-${activity.startTime || 'time'}-${activity.title || activity.location || 'activity'}`
      )
      : null
  );

  const days = buildCalendarDays({
    startDate: groupData?.start_date,
    endDate: groupData?.end_date
  });

  const timeSlots = useMemo(() => generateTimeSlots({
    startHour: START_HOUR,
    endHour: END_HOUR,
    slotMinutes: SLOT_MINUTES
  }), []);

  const viewSpan = DEFAULT_WINDOW_DAYS;
  const {
    hasPaging,
    maxViewStartIndex,
    windowStartIndex,
    visibleDays
  } = computeWindow({
    days,
    viewStartIndex,
    viewSpan,
    maxFullDays: MAX_FULL_DAYS
  });

  const shixingCardResources = useCalendarDetailShixingResources({ groupData, activities });

  const customResources = useMemo(() => (
    Array.isArray(groupData?.customResources) ? groupData.customResources : []
  ), [groupData?.customResources]);

  const availableCustomResources = useMemo(() => {
    const usedResourceIds = new Set();
    (activities || []).forEach((activity) => {
      const resourceId = activity?.resourceId ?? activity?.resource_id;
      if (typeof resourceId === 'string' && resourceId.length > 0) {
        usedResourceIds.add(resourceId);
        return;
      }

      // Backward-compat: legacy custom schedules might not have `resourceId` yet.
      // Hide the matching custom resource card by deriving its id deterministically.
      const planItemId = activity?.planItemId;
      if (planItemId) return;
      const locationPlanId = isPlanResourceId(activity?.resourceId) ? activity.resourceId : '';
      if (locationPlanId) return;

      const typeKey = activity?.type || 'activity';
      const titleKey = activity?.title || activity?.location || '自定义活动';
      const durationMinutes = calcDurationMinutes(activity?.startTime, activity?.endTime, 60);
      const hash = hashString(`${typeKey}|${titleKey}|${durationMinutes}`);
      usedResourceIds.add(`custom:${hash}`);
    });

    return customResources.filter((resource) => !usedResourceIds.has(resource.id));
  }, [customResources, activities]);

  const handleDeleteCustomResource = useCallback((resourceId) => {
    if (!resourceId) return;
    if (!onCustomResourcesChange) {
      message.warning('当前页面未接入自定义资源删除能力');
      return;
    }
    const next = customResources.filter((item) => item?.id !== resourceId);
    onCustomResourcesChange(next);
    message.success('已删除自定义卡片', 1);
  }, [customResources, onCustomResourcesChange]);

  useEffect(() => {
    // Reset to the first window when switching groups.
    setViewStartIndex(0);
  }, [groupData?.id]);

  useEffect(() => {
    if (!hasPaging) {
      if (viewStartIndex !== 0) {
        setViewStartIndex(0);
      }
      return;
    }
    if (viewStartIndex !== windowStartIndex) {
      setViewStartIndex(windowStartIndex);
    }
  }, [hasPaging, viewStartIndex, windowStartIndex]);

  const setWindowToIncludeDate = useCallback((dateStr) => {
    if (!hasPaging) return;
    if (!dateStr) return;
    const targetIndex = days.findIndex((day) => day.dateStr === dateStr);
    if (targetIndex < 0) return;
    const centeredStart = targetIndex - Math.floor(viewSpan / 2);
    setViewStartIndex(clamp(centeredStart, 0, maxViewStartIndex));
  }, [hasPaging, days, viewSpan, maxViewStartIndex]);

  const handleJumpPrevDay = useCallback(() => {
    if (!hasPaging) return;
    setViewStartIndex((prev) => clamp(prev - 1, 0, maxViewStartIndex));
  }, [hasPaging, maxViewStartIndex]);

  const handleJumpNextDay = useCallback(() => {
    if (!hasPaging) return;
    setViewStartIndex((prev) => clamp(prev + 1, 0, maxViewStartIndex));
  }, [hasPaging, maxViewStartIndex]);

  const handleJumpPrevChunk = useCallback(() => {
    if (!hasPaging) return;
    setViewStartIndex((prev) => clamp(prev - viewSpan, 0, maxViewStartIndex));
  }, [hasPaging, viewSpan, maxViewStartIndex]);

  const handleJumpNextChunk = useCallback(() => {
    if (!hasPaging) return;
    setViewStartIndex((prev) => clamp(prev + viewSpan, 0, maxViewStartIndex));
  }, [hasPaging, viewSpan, maxViewStartIndex]);

  useLayoutEffect(() => {
    const wrapper = scrollWrapperRef.current;
    if (!wrapper || !timeSlots.length) return;

    let frame = null;
    const updateSlotHeight = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = wrapper.clientHeight;
        if (!height) return;
        const available = Math.max(0, height - HEADER_HEIGHT);
        if (!available) return;
        const rawHeight = available / timeSlots.length;
        const nextHeight = Math.max(MIN_SLOT_HEIGHT, rawHeight);
        setSlotHeight(prev => (Math.abs(prev - nextHeight) < 0.1 ? prev : nextHeight));
      });
    };

    updateSlotHeight();

    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateSlotHeight);
      observer.observe(wrapper);
    }
    window.addEventListener('resize', updateSlotHeight);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateSlotHeight);
      if (observer) observer.disconnect();
    };
  }, [timeSlots.length]);

  const timeToGridRow = (time) => {
    const [hour, minute] = time.split(':').map(Number);
    const totalMinutes = (hour - START_HOUR) * 60 + minute;
    const slotIndex = Math.max(0, Math.round(totalMinutes / SLOT_MINUTES));
    return slotIndex + 2;
  };

  const gridRowToTime = (row) => {
    const totalMinutes = (row - 2) * SLOT_MINUTES;
    const hour = Math.floor(totalMinutes / 60) + START_HOUR;
    const minute = totalMinutes % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const detectOverlaps = useCallback((items) => {
    const groups = {};

    items.forEach((activity) => {
      const key = `${activity.date}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(activity);
    });

    Object.keys(groups).forEach((dateKey) => {
      const dayActivities = groups[dateKey].sort((a, b) => {
        return timeToGridRow(a.startTime) - timeToGridRow(b.startTime);
      });

      const overlaps = [];
      for (let i = 0; i < dayActivities.length; i++) {
        const current = dayActivities[i];
        const currentStart = timeToGridRow(current.startTime);
        const currentEnd = timeToGridRow(current.endTime);

        const overlapGroup = [current];

        for (let j = i + 1; j < dayActivities.length; j++) {
          const next = dayActivities[j];
          const nextStart = timeToGridRow(next.startTime);
          const nextEnd = timeToGridRow(next.endTime);

          if (nextStart < currentEnd && nextEnd > currentStart) {
            overlapGroup.push(next);
          }
        }

        if (overlapGroup.length > 1) {
          overlaps.push(overlapGroup);
        }
      }

      groups[dateKey] = { activities: dayActivities, overlaps };
    });

    return groups;
  }, []);

  const buildShixingMealDrafts = useCallback((targetDate) => {
    const drafts = {};
    const logisticsRows = Array.isArray(groupData?.logistics) ? groupData.logistics : [];
    const logisticsRow = logisticsRows.find((row) => row?.date === targetDate) || null;
    const meals = logisticsRow?.meals || {};

    const activityByMealKey = new Map();
    (activities || []).forEach((activity) => {
      const parsed = parseShixingResourceId(getResourceId(activity));
      if (!parsed || parsed.category !== 'meal' || !parsed.key) return;
      if (parsed.date !== targetDate) return;
      activityByMealKey.set(parsed.key, activity);
    });

    SHIXING_MEAL_KEYS.forEach((key) => {
      const matchedActivity = activityByMealKey.get(key);
      const defaults = SHIXING_MEAL_DEFAULTS[key] || {};
      const title = matchedActivity?.title || '';
      const description = matchedActivity?.description || '';
      const normalizedTitle = typeof title === 'string' ? title.trim() : '';
      const normalizedDescription = typeof description === 'string' ? description.trim() : '';
      const planText = (
        normalizedTitle && !LEGACY_MEAL_TITLES.has(normalizedTitle)
      )
        ? normalizedTitle
        : (normalizedDescription || normalizedTitle || meals[key] || '');
      drafts[key] = {
        disabled: matchedActivity ? false : Boolean(meals[`${key}_disabled`]),
        plan: planText,
        place: matchedActivity?.location || meals[`${key}_place`] || '',
        startTime: matchedActivity?.startTime || meals[`${key}_time`] || defaults.start || '',
        endTime: matchedActivity?.endTime || meals[`${key}_end`] || defaults.end || ''
      };
    });

    return drafts;
  }, [activities, groupData?.logistics]);

  const buildShixingTransferDrafts = useCallback((targetDate) => {
    const logisticsRows = Array.isArray(groupData?.logistics) ? groupData.logistics : [];
    const logisticsRow = logisticsRows.find((row) => row?.date === targetDate) || null;
    const pickup = logisticsRow?.pickup || {};
    const dropoff = logisticsRow?.dropoff || {};
    const activityByCategory = new Map();

    (activities || []).forEach((item) => {
      const parsed = parseShixingResourceId(getResourceId(item));
      if (!parsed) return;
      if ((parsed.category !== 'pickup' && parsed.category !== 'dropoff') || parsed.date !== targetDate) return;
      activityByCategory.set(parsed.category, item);
    });

    const buildDraft = (category, base) => {
      const event = activityByCategory.get(category);
      const fallbackFlightSummary = [
        base?.flight_no && `航班 ${base.flight_no}`,
        base?.airline,
        base?.terminal
      ].filter(Boolean).join(' / ');
      const eventDescription = (event?.description || '').trim();
      const note = event
        ? (eventDescription && eventDescription !== fallbackFlightSummary ? eventDescription : (base?.note || ''))
        : (base?.note || '');
      return {
        disabled: Boolean(base?.disabled),
        startTime: event?.startTime || base?.time || '',
        endTime: event?.endTime || base?.end_time || '',
        location: event?.location || base?.location || '',
        contact: base?.contact || '',
        flightNo: base?.flight_no || '',
        airline: base?.airline || '',
        terminal: base?.terminal || '',
        note
      };
    };

    return {
      pickup: buildDraft('pickup', pickup),
      dropoff: buildDraft('dropoff', dropoff)
    };
  }, [activities, groupData?.logistics]);

  const handleSlotClick = (date, time, anchorRect) => {
    if (isDragging || isResizing) return;

    setSelectedSlot({ date, time });

    const startTime = time;
    const endTime = dayjs(`2025-01-01 ${time}`, 'YYYY-MM-DD HH:mm')
      .add(1, 'hour')
      .format('HH:mm');

    setPopoverState({
      isOpen: true,
      mode: 'create',
      anchorRect,
      activity: null,
      initialValues: {
        date,
        startTime,
        endTime,
        type: 'visit',
        title: '',
        location: '',
        mealDrafts: buildShixingMealDrafts(date),
        transferDrafts: buildShixingTransferDrafts(date),
        shixingCardType: 'meal',
        shixingTransferType: 'pickup'
      }
    });
  };

  const handleActivityClick = (event, activity, anchorRect) => {
    event.stopPropagation();
    if (isDragging || isResizing) return;

    setSelectedSlot({ date: activity.date, time: activity.startTime });
    setPopoverState({
      isOpen: true,
      mode: 'edit',
      anchorRect,
      activity,
      initialValues: {
        date: activity.date,
        mealDrafts: buildShixingMealDrafts(activity.date),
        transferDrafts: buildShixingTransferDrafts(activity.date)
      }
    });
  };

  const handleActivityContextMenu = (event, activity, anchorRect) => {
    event.preventDefault();
    event.stopPropagation();
    handleActivityClick(event, activity, anchorRect);
  };

  const handleDragStart = (event, activity) => {
    setDraggedActivity(activity);
    setIsDragging(true);

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const offsetX = event.clientX - rect.left;

    dragOffsetRef.current = { x: offsetX, y: offsetY };

    const dragData = {
      ...activity,
      dragOffsetY: offsetY,
      dragOffsetX: offsetX
    };
    event.dataTransfer.setData('application/json', JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = 'move';

    const emptyImg = new Image();
    emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
    event.dataTransfer.setDragImage(emptyImg, 0, 0);
  };

  const handleDragEnd = (event) => {
    setDraggedActivity(null);
    setDraggedResource(null);
    dragOffsetRef.current = { x: 0, y: 0 };
    setDropIndicator(null);
    setIsDragging(false);
    event.dataTransfer.clearData();
  };

  const updateDropIndicatorForDate = (event, dateStr) => {
    if (draggedResource) return;
    if (!draggedActivity || !dateStr) return;
    if (isDailyActivity(draggedActivity) && draggedActivity.date && dateStr !== draggedActivity.date) {
      setDropIndicator(null);
      return;
    }

    const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');
    const scrollWrapper = calendarRef.current?.querySelector('.calendar-scroll-wrapper');
    if (!calendarGrid || !scrollWrapper) return;

    const wrapperRect = scrollWrapper.getBoundingClientRect();
    const scrollTop = scrollWrapper.scrollTop;
    const mouseY = event.clientY - wrapperRect.top + scrollTop;
    const activityTopY = mouseY - dragOffsetRef.current.y;

    const adjustedY = activityTopY - HEADER_HEIGHT;
    let targetSlotIndex;
    if (adjustedY < 0) {
      targetSlotIndex = 0;
    } else {
      targetSlotIndex = Math.round(adjustedY / slotHeight);
    }

    const originalStart = timeToGridRow(draggedActivity.startTime);
    const originalEnd = timeToGridRow(draggedActivity.endTime);
    const duration = originalEnd - originalStart;

    const maxStartIndex = Math.max(0, timeSlots.length - duration - 1);
    const constrainedIndex = Math.max(0, Math.min(maxStartIndex, targetSlotIndex));

    const dayIndex = visibleDays.findIndex(d => d.dateStr === dateStr);
    if (dayIndex === -1) return;

    setDropIndicator({
      dayIndex,
      slotIndex: constrainedIndex,
      duration,
      time: timeSlots[constrainedIndex]
    });
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = draggedResource ? 'copy' : 'move';

    if (draggedResource) {
      return;
    }

    if (!draggedActivity) return;

    const targetElement = event.target.closest('.time-slot');
    if (targetElement) {
      const dateStr = targetElement.dataset.date;
      if (isDailyActivity(draggedActivity) && draggedActivity.date && dateStr && dateStr !== draggedActivity.date) {
        event.dataTransfer.dropEffect = 'none';
        setDropIndicator(null);
        return;
      }
      updateDropIndicatorForDate(event, dateStr);
    }
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');
    if (calendarGrid && !calendarGrid.contains(event.relatedTarget)) {
      setDropIndicator(null);
    }
  };

  const handleDrop = (event, targetDate, targetTime) => {
    event.preventDefault();
    event.stopPropagation();

    if (draggedResource) {
      const fixedDate = draggedResource.fixedDate || parseDailyDate(draggedResource.id);
      if (fixedDate && targetDate && fixedDate !== targetDate) {
        message.warning('食行卡片活动日期已固定，只能调整时间');
        return;
      }
      const resolvedDate = fixedDate || targetDate;
      const durationSlots = Math.max(1, Math.ceil((draggedResource.duration * 60) / SLOT_MINUTES));
      const startIndex = Math.max(0, timeSlots.indexOf(targetTime));
      const maxStartIndex = Math.max(0, timeSlots.length - durationSlots - 1);
      const constrainedIndex = Math.min(maxStartIndex, startIndex);
      const adjustedStartTime = timeSlots[constrainedIndex] || targetTime;
      const startRow = constrainedIndex + 2;
      const endRow = Math.min(startRow + durationSlots, timeSlots.length + 1);
      const endTime = gridRowToTime(endRow);
      const isMealResource = draggedResource.type === 'meal';
      const resourceTitle = isMealResource
        ? (draggedResource.title || draggedResource.description || '用餐安排')
        : draggedResource.title;
      const newActivity = {
        id: null,
        clientId: buildClientId(),
        groupId: groupData.id,
        date: resolvedDate,
        startTime: adjustedStartTime,
        endTime,
        type: draggedResource.type,
        title: resourceTitle,
        location: draggedResource.locationName || draggedResource.title || '',
        locationId: draggedResource.locationId || null,
        locationColor: draggedResource.locationColor || null,
        description: isMealResource ? '' : draggedResource.description,
        color: draggedResource.color || resolveActivityColor({
          type: draggedResource.type,
          locationId: draggedResource.locationId,
          locationColor: draggedResource.locationColor
        }),
        resourceId: draggedResource.id,
        planItemId: isPlanResourceId(draggedResource.id) ? draggedResource.id : null,
        isFromResource: true
      };

      const updatedActivities = [...activities, newActivity];
      setActivities(updatedActivities);
      onUpdate?.(updatedActivities);

      setDraggedResource(null);
      setIsDragging(false);

      message.success(`已添加活动：${resourceTitle || draggedResource.title}`, 1);
      return;
    }

    if (!draggedActivity) {
      return;
    }

    if (isDailyActivity(draggedActivity) && draggedActivity.date && targetDate && targetDate !== draggedActivity.date) {
      message.warning('食行卡片活动不能跨日期移动');
      return;
    }

    const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');
    const scrollWrapper = calendarRef.current?.querySelector('.calendar-scroll-wrapper');

    if (!calendarGrid || !scrollWrapper) {
      return;
    }

    const wrapperRect = scrollWrapper.getBoundingClientRect();
    const scrollTop = scrollWrapper.scrollTop;
    const mouseY = event.clientY - wrapperRect.top + scrollTop;

    let dragOffsetY = dragOffsetRef.current.y;
    try {
      const dragDataStr = event.dataTransfer.getData('application/json');
      if (dragDataStr) {
        const dragData = JSON.parse(dragDataStr);
        if (dragData.dragOffsetY !== undefined) {
          dragOffsetY = dragData.dragOffsetY;
        }
      }
    } catch (err) {
      // ignore
    }

    const activityTopY = mouseY - dragOffsetY;

    const originalStart = timeToGridRow(draggedActivity.startTime);
    const originalEnd = timeToGridRow(draggedActivity.endTime);
    const duration = originalEnd - originalStart;

    const adjustedY = activityTopY - HEADER_HEIGHT;

    let targetSlotIndex;
    if (adjustedY < 0) {
      targetSlotIndex = 0;
    } else {
      targetSlotIndex = Math.round(adjustedY / slotHeight);
    }

    const maxStartIndex = Math.max(0, timeSlots.length - duration - 1);
    const constrainedIndex = Math.max(0, Math.min(maxStartIndex, targetSlotIndex));
    const adjustedStartTime = timeSlots[constrainedIndex];

    const newStartRow = timeToGridRow(adjustedStartTime);
    const newEndRow = Math.min(newStartRow + duration, timeSlots.length + 1);
    const newEndTime = gridRowToTime(newEndRow);

    const updatedActivities = activities.map(activity =>
      getActivityIdentity(activity) === getActivityIdentity(draggedActivity)
        ? {
            ...activity,
            date: targetDate,
            startTime: adjustedStartTime,
            endTime: newEndTime
          }
        : activity
    );

    setActivities(updatedActivities);

    setSaveStatus('saving');
    onUpdate?.(updatedActivities);

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      message.success('活动已自动保存', 1);
    }, 500);
  };

  const handleResizeStart = (event, activity) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    setResizingActivity(activity);
    setIsResizing(true);

    let latestActivities = activities;
    let isResizingNow = true;
    const initialMouseY = event.clientY;
    let hasMovedEnough = false;

    const handleMouseMove = (moveEvent) => {
      if (!isResizingNow || moveEvent.buttons !== 1) {
        handleMouseUp();
        return;
      }

      const mouseDelta = moveEvent.clientY - initialMouseY;
      if (!hasMovedEnough && Math.abs(mouseDelta) < 10) {
        return;
      }
      hasMovedEnough = true;

      const scrollWrapper = calendarRef.current?.querySelector('.calendar-scroll-wrapper');
      const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');

      if (!scrollWrapper || !calendarGrid) return;

      const wrapperRect = scrollWrapper.getBoundingClientRect();
      const scrollTop = scrollWrapper.scrollTop;
      const relativeY = moveEvent.clientY - wrapperRect.top + scrollTop;

      const adjustedY = relativeY - HEADER_HEIGHT;
      const slotIndex = Math.max(0, Math.round(adjustedY / slotHeight));

      const maxSlots = timeSlots.length - 1;
      const constrainedSlotIndex = Math.min(slotIndex, maxSlots);

      const newEndTime = timeSlots[constrainedSlotIndex];
      if (!newEndTime) return;

      const startRow = timeToGridRow(activity.startTime);
      const endRow = timeToGridRow(newEndTime);

      if (endRow > startRow) {
        const updatedActivities = latestActivities.map(act =>
          getActivityIdentity(act) === getActivityIdentity(activity)
            ? { ...act, endTime: newEndTime }
            : act
        );

        latestActivities = updatedActivities;
        setActivities(updatedActivities);
      }
    };

    const handleMouseUp = () => {
      if (!isResizingNow) return;

      isResizingNow = false;
      setIsResizing(false);
      setResizingActivity(null);

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseUp);

      setSaveStatus('saving');
      onUpdate?.(latestActivities);

      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saved');
      }, 500);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp);
  };

  const resolveStartEndTimes = (payload) => {
    const fallbackStart = selectedSlot?.time || timeSlots[0];
    const normalizedStart = payload.startTime || fallbackStart;
    const normalizedEnd = payload.endTime || dayjs(`2025-01-01 ${normalizedStart}`, 'YYYY-MM-DD HH:mm')
      .add(1, 'hour')
      .format('HH:mm');

    return { startTime: normalizedStart, endTime: normalizedEnd };
  };

  const hasTransferDraftContent = (transfer = {}) => (
    Boolean(
      transfer.location
      || transfer.contact
      || transfer.flightNo
      || transfer.flight_no
      || transfer.airline
      || transfer.terminal
      || transfer.startTime
      || transfer.time
      || transfer.endTime
      || transfer.end_time
    )
  );

  const buildTransferDescription = (transfer = {}) => {
    const note = (transfer.note || transfer.remark || '').trim();
    if (note) return note;
    return [
      transfer.flightNo && `航班 ${transfer.flightNo}`,
      transfer.airline,
      transfer.terminal
    ].filter(Boolean).join(' / ');
  };

  const resolveTransferTypeForDate = (date, fallback = 'pickup') => {
    if (!date) return null;
    const startDate = groupData?.start_date || '';
    const endDate = groupData?.end_date || '';
    const isStart = Boolean(startDate && date === startDate);
    const isEnd = Boolean(endDate && date === endDate);
    if (isStart && !isEnd) return 'pickup';
    if (isEnd && !isStart) return 'dropoff';
    if (isStart && isEnd) {
      return fallback === 'dropoff' ? 'dropoff' : 'pickup';
    }
    return null;
  };

  const applyMealDraftsToLogistics = useCallback((targetDate, mealDrafts) => {
    if (!targetDate || !mealDrafts || typeof mealDrafts !== 'object') return;
    const logisticsRows = Array.isArray(groupData?.logistics) ? groupData.logistics : [];
    const existingIndex = logisticsRows.findIndex((row) => row?.date === targetDate);
    const baseRow = existingIndex >= 0 ? logisticsRows[existingIndex] : { date: targetDate };
    const nextMeals = { ...(baseRow.meals || {}) };

    SHIXING_MEAL_KEYS.forEach((key) => {
      const row = mealDrafts[key] || {};
      const defaults = SHIXING_MEAL_DEFAULTS[key] || {};
      const disabled = Boolean(row.disabled);
      const plan = (row.plan || '').trim();
      const place = (row.place || '').trim();
      nextMeals[key] = disabled ? '' : plan;
      nextMeals[`${key}_place`] = disabled ? '' : place;
      nextMeals[`${key}_disabled`] = disabled;
      nextMeals[`${key}_time`] = disabled ? '' : (row.startTime || defaults.start || '');
      nextMeals[`${key}_end`] = disabled ? '' : (row.endTime || defaults.end || '');
      nextMeals[`${key}_detached`] = false;
    });

    const nextRow = {
      ...baseRow,
      date: targetDate,
      meals: nextMeals
    };
    const nextLogistics = [...logisticsRows];
    if (existingIndex >= 0) {
      nextLogistics[existingIndex] = nextRow;
    } else {
      nextLogistics.push(nextRow);
    }
    onLogisticsUpdate?.(nextLogistics);
  }, [groupData?.logistics, onLogisticsUpdate]);

  const applyTransferDraftToLogistics = useCallback((targetDate, transferType, transferDraft) => {
    if (!targetDate || !transferType || !transferDraft) return;
    const key = transferType === 'dropoff' ? 'dropoff' : 'pickup';
    const logisticsRows = Array.isArray(groupData?.logistics) ? groupData.logistics : [];
    const existingIndex = logisticsRows.findIndex((row) => row?.date === targetDate);
    const baseRow = existingIndex >= 0 ? logisticsRows[existingIndex] : { date: targetDate };
    const current = baseRow[key] || {};
    const nextTransfer = {
      ...current,
      time: transferDraft.startTime || '',
      end_time: transferDraft.endTime || '',
      location: transferDraft.location || '',
      contact: transferDraft.contact || '',
      flight_no: transferDraft.flightNo || '',
      airline: transferDraft.airline || '',
      terminal: transferDraft.terminal || '',
      note: transferDraft.note || '',
      disabled: Boolean(transferDraft.disabled),
      detached: false
    };

    const nextRow = {
      ...baseRow,
      date: targetDate,
      [key]: nextTransfer
    };

    const nextLogistics = [...logisticsRows];
    if (existingIndex >= 0) {
      nextLogistics[existingIndex] = nextRow;
    } else {
      nextLogistics.push(nextRow);
    }
    onLogisticsUpdate?.(nextLogistics);
  }, [groupData?.logistics, onLogisticsUpdate]);

  const handleSaveFromPopover = (baseActivity, payload) => {
    if (!payload) return false;

    const targetDate = baseActivity?.date || selectedSlot?.date;
    if (!targetDate) {
      message.error('请先选择日期');
      return false;
    }

    const { startTime, endTime } = resolveStartEndTimes(payload);

    if (timeToGridRow(endTime) <= timeToGridRow(startTime)) {
      message.error('结束时间需晚于开始时间');
      return false;
    }

    if (payload.sourceCategory === 'meal' && payload.shixingMeals) {
      const effectiveDate = payload.date || targetDate;
      if (!effectiveDate) {
        message.error('请选择日期');
        return false;
      }

      const mealResourceIds = SHIXING_MEAL_KEYS.map((key) => (
        buildShixingResourceId(effectiveDate, 'meal', key)
      ));
      const existingMealsByResource = new Map(
        (activities || [])
          .filter((activity) => mealResourceIds.includes(getResourceId(activity)))
          .map((activity) => [getResourceId(activity), activity])
      );
      const baseActivityIdentity = getActivityIdentity(baseActivity);
      const baseActivities = (activities || []).filter((activity) => {
        const identity = getActivityIdentity(activity);
        if (baseActivityIdentity && identity === baseActivityIdentity) return false;
        return !mealResourceIds.includes(getResourceId(activity));
      });

      const createdMeals = [];
      for (const key of SHIXING_MEAL_KEYS) {
        const draft = payload.shixingMeals[key] || {};
        const isDisabled = Boolean(draft.disabled);
        const plan = (draft.plan || '').trim();
        const place = (draft.place || '').trim();
        if (isDisabled || (!plan && !place)) {
          continue;
        }
        const defaults = SHIXING_MEAL_DEFAULTS[key] || {};
        const rowStart = draft.startTime || defaults.start;
        const rowEnd = draft.endTime || defaults.end;
        if (!rowStart || !rowEnd || timeToGridRow(rowEnd) <= timeToGridRow(rowStart)) {
          message.error(`${SHIXING_MEAL_LABELS[key]}时间范围无效`);
          return false;
        }
        const resourceId = buildShixingResourceId(effectiveDate, 'meal', key);
        const existingMeal = existingMealsByResource.get(resourceId);
        createdMeals.push({
          ...existingMeal,
          id: existingMeal?.id ?? null,
          clientId: existingMeal?.clientId ?? buildClientId(),
          groupId: groupData.id,
          date: effectiveDate,
          startTime: rowStart,
          endTime: rowEnd,
          type: 'meal',
          title: plan || SHIXING_MEAL_LABELS[key],
          location: place,
          description: '',
          locationId: null,
          locationColor: null,
          color: payload.color || activityTypes.meal?.color || '#52c41a',
          resourceId,
          planItemId: null,
          isFromResource: true
        });
      }

      const updatedActivities = [...baseActivities, ...createdMeals];
      setActivities(updatedActivities);
      setSaveStatus('saving');
      onUpdate?.(updatedActivities);
      applyMealDraftsToLogistics(effectiveDate, payload.shixingMeals);

      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saved');
        message.success('三餐已同步到日历和每日卡片', 1);
      }, 500);
      return true;
    }

    if (payload.sourceCategory === 'transfer' && payload.shixingTransfer) {
      const effectiveDate = payload.date || targetDate;
      if (!effectiveDate) {
        message.error('请选择日期');
        return false;
      }
      const requestedType = payload.shixingTransferType === 'dropoff' ? 'dropoff' : 'pickup';
      const transferType = resolveTransferTypeForDate(effectiveDate, requestedType);
      if (!transferType) {
        message.warning('接送站仅支持首日和末日：首日为接站，末日为送站');
        return false;
      }
      const transferLabel = SHIXING_TRANSFER_LABELS[transferType];
      const transferDraft = payload.shixingTransfer || {};
      const resourceId = buildShixingResourceId(effectiveDate, transferType);
      const baseActivityIdentity = getActivityIdentity(baseActivity);
      const start = transferDraft.startTime || transferDraft.time || '';
      let end = transferDraft.endTime || transferDraft.end_time || '';
      if (start && !end) {
        end = dayjs(`2025-01-01 ${start}`, 'YYYY-MM-DD HH:mm').add(1, 'hour').format('HH:mm');
      }
      if (!transferDraft.disabled && start && end && timeToGridRow(end) <= timeToGridRow(start)) {
        message.error('结束时间需晚于开始时间');
        return false;
      }

      const baseActivities = (activities || []).filter((item) => {
        if (getResourceId(item) === resourceId) return false;
        if (baseActivityIdentity && getActivityIdentity(item) === baseActivityIdentity) return false;
        return true;
      });

      let updatedActivities = baseActivities;
      if (!transferDraft.disabled && hasTransferDraftContent(transferDraft)) {
        const transferDescription = buildTransferDescription(transferDraft);
        const nextActivity = {
          ...baseActivity,
          id: baseActivity?.id ?? null,
          clientId: baseActivity?.clientId ?? buildClientId(),
          groupId: groupData.id,
          date: effectiveDate,
          startTime: start || selectedSlot?.time || '09:00',
          endTime: end || dayjs(`2025-01-01 ${start || '09:00'}`, 'YYYY-MM-DD HH:mm').add(1, 'hour').format('HH:mm'),
          type: 'transport',
          title: transferLabel,
          location: transferDraft.location || transferLabel,
          description: transferDescription || '',
          locationId: null,
          locationColor: null,
          color: payload.color || baseActivity?.color || activityTypes.transport?.color || '#fa8c16',
          resourceId,
          planItemId: null,
          isFromResource: true
        };
        updatedActivities = [...baseActivities, nextActivity];
      }

      setActivities(updatedActivities);
      setSaveStatus('saving');
      onUpdate?.(updatedActivities);
      applyTransferDraftToLogistics(effectiveDate, transferType, {
        ...transferDraft,
        startTime: start,
        endTime: end
      });

      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saved');
        message.success(`${transferLabel}已同步到日历和每日卡片`, 1);
      }, 500);
      return true;
    }

    let resolvedTitle = payload.title || baseActivity?.title || '';
    let resolvedLocation = payload.location || baseActivity?.location || '';
    let resolvedDescription = payload.description ?? baseActivity?.description ?? '';
    let resolvedColor = payload.color || baseActivity?.color || '';
    let resolvedLocationId = baseActivity?.locationId ?? null;
    let resolvedLocationColor = baseActivity?.locationColor ?? null;
    let resolvedResourceId = baseActivity?.resourceId ?? baseActivity?.resource_id ?? null;
    let resolvedPlanItemId = baseActivity?.planItemId ?? null;
    let isFromResource = baseActivity?.isFromResource ?? false;

    if (payload.planItemId) {
      const planResource = planResources.find(
        (resource) => String(resource.id) === String(payload.planItemId)
      );
      if (!planResource) {
        message.error('请选择行程点');
        return false;
      }
      resolvedTitle = planResource.title || resolvedTitle;
      resolvedLocation = planResource.locationName || planResource.title || resolvedLocation;
      resolvedLocationId = planResource.locationId || null;
      resolvedLocationColor = planResource.locationColor || null;
      resolvedResourceId = planResource.id;
      resolvedPlanItemId = planResource.id;
      isFromResource = true;
    } else if (isPlanResourceId(resolvedResourceId)) {
      resolvedResourceId = null;
      resolvedPlanItemId = null;
      isFromResource = false;
    }

    // Treat custom activities as a unique sidebar resource (the "其他" pool).
    // This enforces a 1-of-1 behavior: either scheduled on the calendar, or returned to the pool.
    const resourceIdStr = typeof resolvedResourceId === 'string' ? resolvedResourceId : '';
    const isShixingResource = isShixingResourceId(resourceIdStr);
    const isPlanResource = isPlanResourceId(resourceIdStr);
    const isCustomResource = isCustomResourceId(resourceIdStr);
    if (!isShixingResource && !isPlanResource) {
      if (!resourceIdStr) {
        const typeKey = payload.type || baseActivity?.type || 'activity';
        const durationMinutes = calcDurationMinutes(startTime, endTime, 60);
        const titleKey = resolvedTitle || resolvedLocation || '自定义活动';
        const hash = hashString(`${typeKey}|${titleKey}|${durationMinutes}`);
        resolvedResourceId = `custom:${hash}`;
        isFromResource = true;
      } else if (isCustomResource) {
        isFromResource = true;
      }
    }

    const computedColor = resolveActivityColor({
      type: payload.type || baseActivity?.type || 'visit',
      locationId: resolvedLocationId,
      locationColor: resolvedLocationColor
    });
    if (!resolvedColor) {
      resolvedColor = computedColor;
    }

    const activityData = {
      ...baseActivity,
      id: baseActivity?.id ?? null,
      clientId: baseActivity?.clientId ?? buildClientId(),
      groupId: groupData.id,
      date: targetDate,
      startTime,
      endTime,
      type: payload.type || baseActivity?.type || 'visit',
      title: resolvedTitle,
      location: resolvedLocation,
      description: resolvedDescription,
      locationId: resolvedLocationId,
      locationColor: resolvedLocationColor,
      color: resolvedColor,
      resourceId: resolvedResourceId,
      planItemId: resolvedPlanItemId,
      isFromResource
    };

    let updatedActivities;
    if (baseActivity) {
      updatedActivities = activities.map(activity =>
        getActivityIdentity(activity) === getActivityIdentity(baseActivity) ? activityData : activity
      );
    } else {
      updatedActivities = [...activities, activityData];
    }

    setActivities(updatedActivities);
    setSaveStatus('saving');
    onUpdate?.(updatedActivities);

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      message.success(baseActivity ? '活动已更新并保存' : '活动已创建并保存', 1);
    }, 500);
    return true;
  };

  const handleDeleteActivity = (activityId) => {
    const updatedActivities = activities.filter(activity => getActivityIdentity(activity) !== activityId);
    setActivities(updatedActivities);

    setSaveStatus('saving');
    onUpdate?.(updatedActivities);

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      message.success('活动已删除并保存', 1);
    }, 500);
  };

  const renderActivity = (activity, dayIndex) => {
    const isDragged = getActivityIdentity(draggedActivity) === getActivityIdentity(activity);
    const activityColor = activity.color || resolveActivityColor({
      type: activity.type,
      locationId: activity.locationId,
      locationColor: activity.locationColor
    });

    const startRow = timeToGridRow(activity.startTime);
    const endRow = timeToGridRow(activity.endTime);

    const durationRows = Math.max(1, endRow - startRow);
    const style = {
      gridColumn: dayIndex + 2,
      gridRow: `${startRow} / ${endRow}`,
      zIndex: isDragged ? 1 : 20,
      '--activity-height': `${durationRows * slotHeight}px`,
      backgroundColor: activityColor
    };

    return (
      <CalendarDetailEventChip
        key={getActivityIdentity(activity)}
        activity={activity}
        style={style}
        isDragged={isDragged}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={(event) => {
          if (!draggedActivity && !draggedResource) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = draggedResource ? 'copy' : 'move';
          updateDropIndicatorForDate(event, activity.date);
        }}
        onDrop={(event) => {
          if (!draggedActivity && !draggedResource) return;
          event.preventDefault();
          event.stopPropagation();
          handleDrop(event, activity.date, activity.startTime);
        }}
        onClick={handleActivityClick}
        onContextMenu={handleActivityContextMenu}
        onResizeStart={handleResizeStart}
        isResizing={getActivityIdentity(resizingActivity) === getActivityIdentity(activity)}
      />
    );
  };
  const handleResourceDrop = (event) => {
    event.preventDefault();
    if (draggedActivity) {
      const resourceId = getResourceId(draggedActivity);
      let planResource = null;

      if (resourceId) {
        planResource = planResources.find(r => String(r.id) === String(resourceId)) || null;
      }

      if (!planResource) {
        const activityLocationId = Number(draggedActivity.locationId);
        if (Number.isFinite(activityLocationId)) {
          planResource = planResources.find(r => Number(r.locationId) === activityLocationId) || null;
        }
      }

      if (planResource) {
        setAvailablePlanResources(prev => {
          if (prev.find(r => r.id === planResource.id)) {
            return prev;
          }
          return [...prev, planResource].sort((a, b) => {
            const aIndex = planResources.findIndex(r => r.id === a.id);
            const bIndex = planResources.findIndex(r => r.id === b.id);
            return aIndex - bIndex;
          });
        });

        const updatedActivities = activities.filter(
          (activity) => getActivityIdentity(activity) !== getActivityIdentity(draggedActivity)
        );
        setActivities(updatedActivities);
        onUpdate?.(updatedActivities);
        message.success(`${draggedActivity.title} 已归还到${resolveSourceMetaByKind('plan').title}`, 1);
      } else {
        // Shixing card and custom activities are "returned" by removing them from the calendar.
        // Shixing resources will reappear automatically via `shixingCardResources` once unscheduled.
        const updatedActivities = activities.filter(
          (activity) => getActivityIdentity(activity) !== getActivityIdentity(draggedActivity)
        );
        setActivities(updatedActivities);
        onUpdate?.(updatedActivities);
        const sourceMeta = resolveSourceMeta(draggedActivity);
        message.success(
          sourceMeta.kind === 'shixing'
            ? `${draggedActivity.title} 已归还到${sourceMeta.title}`
            : `${draggedActivity.title} 已移出日历`,
          1
        );
      }
    }

    setDraggedActivity(null);
    setDraggedResource(null);
    setDropIndicator(null);
    setIsDragging(false);
    dragOffsetRef.current = { x: 0, y: 0 };
  };

  const handleCheckConflicts = () => {
    const dayGroups = detectOverlaps(activities);
    const conflictCount = Object.values(dayGroups).reduce((sum, day) => {
      return sum + (day.overlaps?.length || 0);
    }, 0);
    if (conflictCount === 0) {
      message.success('未发现时间冲突', 1);
    } else {
      message.warning(`发现 ${conflictCount} 处时间冲突`, 2);
    }
  };

  const handleAutoPlan = () => {
    message.info('AI 自动排程正在接入中');
  };

  const handleOptimizeRoute = () => {
    message.info('路线优化能力正在接入中');
  };

  const sidebarWidth = resourcePanelStyle?.width ?? 260;

  if (loading) {
    return (
      <CalendarDetailSkeleton
        showResources={showResources}
        resourceWidth={sidebarWidth}
      />
    );
  }

  const locationScheduleCount = (activities || []).filter(isLocationSchedule).length;

  const resourcePane = (
    <CalendarDetailResourceLibrary
      loading={loading}
      canSyncDesigner={canSyncDesigner}
      designerSourceState={designerSourceState}
      pullingFromDesigner={pullingFromDesigner}
      pushingToDesigner={pushingToDesigner}
      locationScheduleCount={locationScheduleCount}
      onPullFromDesigner={handlePullFromDesigner}
      onPushToDesigner={handlePushToDesigner}
      onResetSchedules={handleResetSchedules}
      availablePlanResources={availablePlanResources}
      shixingCardResources={shixingCardResources}
      availableCustomResources={availableCustomResources}
      activityTypes={activityTypes}
      onResourceDragStart={(resource) => {
        setDraggedResource(resource);
        setIsDragging(true);
      }}
      onResourceDragEnd={() => {
        setDraggedResource(null);
        setIsDragging(false);
      }}
      onDeleteCustomResource={handleDeleteCustomResource}
    />
  );

  if (!groupData) {
    return <div className="calendar-empty">请选择团组查看日程</div>;
  }

  const atWindowStart = hasPaging && windowStartIndex <= 0;
  const atWindowEnd = hasPaging && windowStartIndex >= maxViewStartIndex;
  const windowStartLabel = visibleDays[0]?.dateStr || '';
  const windowEndLabel = visibleDays[visibleDays.length - 1]?.dateStr || '';

  const startDay = groupData?.start_date ? dayjs(groupData.start_date) : null;
  const endDay = groupData?.end_date ? dayjs(groupData.end_date) : null;
  const disableJumpDate = (current) => {
    if (!current || !startDay || !endDay) return false;
    return current.isBefore(startDay.startOf('day')) || current.isAfter(endDay.endOf('day'));
  };

  return (
    <div
      className={`calendar-days-view calendar-workshop${showResources ? '' : ' calendar-only'}`}
      ref={calendarRef}
      style={{ '--slot-height': `${slotHeight}px` }}
    >
      <div className={`calendar-layout${showResources ? '' : ' calendar-only'}`}>
        <div className="calendar-container">
          {hasPaging ? (
            <div className="calendar-range-toolbar">
              <div className="calendar-range-actions">
                <Button size="small" onClick={handleJumpPrevChunk} disabled={atWindowStart}>
                  上一段
                </Button>
                <Button size="small" onClick={handleJumpPrevDay} disabled={atWindowStart}>
                  上一天
                </Button>
              </div>

              <div className="calendar-range-center" title={`${windowStartLabel} ~ ${windowEndLabel}`}>
                <div className="calendar-range-title">
                  {windowStartLabel} ~ {windowEndLabel}
                </div>
                <div className="calendar-range-subtitle">
                  第 {windowStartIndex + 1}-{windowStartIndex + visibleDays.length} 天 / 共 {days.length} 天
                </div>
              </div>

              <div className="calendar-range-actions">
                <Button size="small" onClick={handleJumpNextDay} disabled={atWindowEnd}>
                  下一天
                </Button>
                <Button size="small" onClick={handleJumpNextChunk} disabled={atWindowEnd}>
                  下一段
                </Button>
                <DatePicker
                  size="small"
                  allowClear
                  placeholder="跳转日期"
                  disabledDate={disableJumpDate}
                  onChange={(value) => {
                    if (!value) return;
                    setWindowToIncludeDate(value.format('YYYY-MM-DD'));
                  }}
                  style={{ width: 120 }}
                />
              </div>
            </div>
          ) : null}
          <div className="calendar-scroll-wrapper" ref={scrollWrapperRef}>
            <CalendarDetailTimeGrid
              days={visibleDays}
              timeSlots={timeSlots}
              slotHeight={slotHeight}
              slotsPerHour={SLOTS_PER_HOUR}
              activities={activities}
              onSlotClick={handleSlotClick}
              onSlotDrop={handleDrop}
              onSlotDragOver={handleDragOver}
              onSlotDragEnter={handleDragEnter}
              onSlotDragLeave={handleDragLeave}
              renderActivity={renderActivity}
              dropIndicator={dropIndicator}
              isDragging={isDragging}
            />
          </div>
        </div>

        <CalendarDetailSidebar
          width={sidebarWidth}
          resourcePane={resourcePane}
          aiProps={{
            onAutoPlan: handleAutoPlan,
            onOptimizeRoute: handleOptimizeRoute,
            onCheckConflicts: handleCheckConflicts,
            onClearPlan: handleResetSchedules,
            onSend: (text) => message.info(`AI 提示已收到：${text}`)
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={handleResourceDrop}
          show={showResources}
        />

        <CalendarDetailEventEditorPopover
          anchorRect={popoverState.anchorRect}
          isOpen={popoverState.isOpen}
          mode={popoverState.mode}
          activity={popoverState.activity}
          groupStartDate={groupData?.start_date}
          groupEndDate={groupData?.end_date}
          planItems={planResources}
          initialValues={popoverState.initialValues}
          onSave={(payload) => {
            const saved = handleSaveFromPopover(popoverState.activity, payload);
            if (saved) {
              setPopoverState(prev => ({ ...prev, isOpen: false }));
            }
          }}
          onDelete={(activity) => {
            handleDeleteActivity(getActivityIdentity(activity));
            setPopoverState(prev => ({ ...prev, isOpen: false }));
          }}
          onClose={() => setPopoverState(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
    </div>
  );
};

export default CalendarDetailWorkspace;

