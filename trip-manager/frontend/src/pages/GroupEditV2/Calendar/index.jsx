
import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import { Modal, Select, Button, message } from 'antd';
import dayjs from 'dayjs';
import api from '../../../services/api';
import CalendarGrid from './components/CalendarGrid';
import ResourceSidebar from './components/ResourceSidebar';
import ActivityPopover from './components/ActivityPopover';
import EventChip from './components/EventChip';
import CalendarSkeleton from './CalendarSkeleton';
import '../CalendarDaysView.css';
import './styles.css';

const { Option } = Select;

const START_HOUR = 6;
const END_HOUR = 20;
const SLOT_MINUTES = 15;
const HEADER_HEIGHT = 30;
const SLOT_HEIGHT = 10;
const MIN_SLOT_HEIGHT = 8;
const SLOTS_PER_HOUR = Math.max(1, Math.round(60 / SLOT_MINUTES));

const presetResourcesData = [
  { id: 'meal', type: 'meal', title: '早餐', icon: '', duration: 1, description: '酒店自助早餐', isUnique: false },
  { id: 'lunch', type: 'meal', title: '午餐', icon: '', duration: 1, description: '特色午餐', isUnique: false },
  { id: 'dinner', type: 'meal', title: '晚餐', icon: '', duration: 1.5, description: '特色晚餐', isUnique: false },
  { id: 'transport', type: 'transport', title: '大巴交通', icon: '', duration: 1, description: '团队集体交通', isUnique: false },
  { id: 'rest', type: 'rest', title: '休息', icon: '', duration: 1, description: '酒店休息', isUnique: false },
  { id: 'free', type: 'free', title: '自由活动', icon: '', duration: 2, description: '自由安排', isUnique: false },
  { id: 'science', type: 'visit', title: '香港科学馆', icon: '', duration: 2.5, description: '常设展览参观', isUnique: true },
  { id: 'ocean', type: 'visit', title: '海洋公园', icon: '', duration: 4, description: '海洋动物展示', isUnique: true },
  { id: 'peak', type: 'visit', title: '太平山顶', icon: '', duration: 3, description: '观光与拍照', isUnique: true },
  { id: 'university', type: 'visit', title: '香港大学', icon: '', duration: 2, description: '校园参观', isUnique: true },
  { id: 'museum', type: 'visit', title: '历史博物馆', icon: '', duration: 2, description: '文化历史学习', isUnique: true },
  { id: 'activity', type: 'activity', title: '团队活动', icon: '', duration: 2, description: '互动游戏', isUnique: true }
];

const DEFAULT_PLAN_DURATION = 2;

const CalendarWorkshop = ({
  groupData,
  schedules = [],
  onUpdate,
  onPlanChange,
  showResources = true,
  resourceWidth,
  loading = false
}) => {
  const repeatableResources = useMemo(
    () => presetResourcesData.filter((resource) => !resource.isUnique),
    []
  );
  const [itineraryPlans, setItineraryPlans] = useState([]);
  const [locations, setLocations] = useState([]);
  const [planResources, setPlanResources] = useState([]);
  const [availablePlanResources, setAvailablePlanResources] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(groupData?.itinerary_plan_id ?? null);
  const [activities, setActivities] = useState(schedules);
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

  if (loading) {
    return (
      <CalendarSkeleton
        showResources={showResources}
        resourceWidth={resourcePanelStyle?.width ?? 260}
      />
    );
  }
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

  useEffect(() => {
    const selectedPlan = itineraryPlans.find(
      (plan) => plan.id === selectedPlanId
    );
    if (!selectedPlan || !Array.isArray(selectedPlan.items)) {
      setPlanResources([]);
      setAvailablePlanResources([]);
      return;
    }

    const resources = [...selectedPlan.items]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((item) => ({
        id: `plan-${selectedPlan.id}-loc-${item.location_id}`,
        type: 'visit',
        title: item.location_name,
        icon: '',
        duration: DEFAULT_PLAN_DURATION,
        description: item.address
          ? `${item.address} · 容量${item.capacity || 0}人`
          : `容量${item.capacity || 0}人`,
        isUnique: true,
        locationId: item.location_id,
        locationName: item.location_name,
        location: item.location_name,
        locationColor: item.location_color || null,
        planId: selectedPlan.id
      }));

    setPlanResources(resources);
  }, [selectedPlanId, itineraryPlans]);

  useEffect(() => {
    const sourceActivities = (activities && activities.length > 0)
      ? activities
      : (schedules || []);
    const usedResourceIds = new Set();
    const usedLocationIds = new Set();

    sourceActivities.forEach((activity) => {
      if (activity?.resourceId) {
        usedResourceIds.add(activity.resourceId);
      }
      const locationId = Number(activity?.locationId);
      if (Number.isFinite(locationId)) {
        usedLocationIds.add(locationId);
      }
    });

    setAvailablePlanResources(
      planResources.filter((resource) => {
        if (usedResourceIds.has(resource.id)) return false;
        const resourceLocationId = Number(resource.locationId);
        if (Number.isFinite(resourceLocationId) && usedLocationIds.has(resourceLocationId)) {
          return false;
        }
        return true;
      })
    );
  }, [planResources, schedules, activities]);

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

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
        slots.push(
          `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        );
      }
    }
    return slots;
  };

  const calculateDays = () => {
    if (!groupData?.start_date || !groupData?.end_date) return [];

    const start = new Date(groupData.start_date);
    const end = new Date(groupData.end_date);
    const days = [];
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const dayNamesFull = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      days.push({
        date: new Date(d),
        dateStr: d.toISOString().split('T')[0],
        dayName: dayNames[d.getDay()],
        dayNameFull: dayNamesFull[d.getDay()],
        month: d.getMonth() + 1,
        day: d.getDate(),
        isToday,
        isWeekend
      });
    }
    return days;
  };

  const days = calculateDays();
  const timeSlots = generateTimeSlots();

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
        startTime,
        endTime,
        type: 'visit',
        title: '',
        location: ''
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
      initialValues: null
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

    const dayIndex = days.findIndex(d => d.dateStr === dateStr);
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
      const durationSlots = Math.max(1, Math.ceil((draggedResource.duration * 60) / SLOT_MINUTES));
      const startIndex = Math.max(0, timeSlots.indexOf(targetTime));
      const maxStartIndex = Math.max(0, timeSlots.length - durationSlots - 1);
      const constrainedIndex = Math.min(maxStartIndex, startIndex);
      const adjustedStartTime = timeSlots[constrainedIndex] || targetTime;
      const startRow = constrainedIndex + 2;
      const endRow = Math.min(startRow + durationSlots, timeSlots.length + 1);
      const endTime = gridRowToTime(endRow);
      const newActivity = {
        id: Date.now(),
        groupId: groupData.id,
        date: targetDate,
        startTime: adjustedStartTime,
        endTime,
        type: draggedResource.type,
        title: draggedResource.title,
        location: draggedResource.locationName || draggedResource.title || '',
        locationId: draggedResource.locationId || null,
        locationColor: draggedResource.locationColor || null,
        description: draggedResource.description,
        color: resolveActivityColor({
          type: draggedResource.type,
          locationId: draggedResource.locationId,
          locationColor: draggedResource.locationColor
        }),
        resourceId: draggedResource.id,
        planItemId: (typeof draggedResource.id === 'string' && draggedResource.id.startsWith('plan-'))
          ? draggedResource.id
          : null,
        isFromResource: true
      };

      const updatedActivities = [...activities, newActivity];
      setActivities(updatedActivities);
      onUpdate?.(updatedActivities);

      setDraggedResource(null);
      setIsDragging(false);

      message.success(`已添加活动：${draggedResource.title}`, 1);
      return;
    }

    if (!draggedActivity) {
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

    let resolvedTitle = payload.title || baseActivity?.title || '';
    let resolvedLocation = payload.location || baseActivity?.location || '';
    let resolvedLocationId = baseActivity?.locationId ?? null;
    let resolvedLocationColor = baseActivity?.locationColor ?? null;
    let resolvedResourceId = baseActivity?.resourceId ?? null;
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
    } else if (typeof resolvedResourceId === 'string' && resolvedResourceId.startsWith('plan-')) {
      resolvedResourceId = null;
      resolvedPlanItemId = null;
      isFromResource = false;
    }

    const activityData = {
      ...baseActivity,
      id: baseActivity?.id || Date.now(),
      groupId: groupData.id,
      date: targetDate,
      startTime,
      endTime,
      type: payload.type || baseActivity?.type || 'visit',
      title: resolvedTitle,
      location: resolvedLocation,
      locationId: resolvedLocationId,
      locationColor: resolvedLocationColor,
      color: resolveActivityColor({
        type: payload.type || baseActivity?.type || 'visit',
        locationId: resolvedLocationId,
        locationColor: resolvedLocationColor
      }),
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
      <EventChip
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
      const resourceId = draggedActivity.resourceId || '';
      let planResource = null;

      if (typeof resourceId === 'string' && resourceId.startsWith('plan-')) {
        planResource = planResources.find(r => r.id === resourceId) || null;
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
        message.success(`${draggedActivity.title} 已归还`, 1);
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

  const resourcePane = (
    <div className="resource-pane-scroll">
      <div className="resource-header">
        <div className="resource-hint">
          <div className="resource-hint-header">
            <span className="resource-hint-label">行程方案</span>
          </div>
          <Select
            size="small"
            allowClear
            placeholder="请选择行程方案"
            value={selectedPlanId ?? undefined}
            style={{ width: '100%' }}
            onChange={(value) => {
              const nextPlanId = value ?? null;
              setSelectedPlanId(nextPlanId);
              onPlanChange?.(nextPlanId);
            }}
          >
            {(itineraryPlans || []).map(plan => (
              <Option key={plan.id} value={plan.id}>
                {plan.name}
              </Option>
            ))}
          </Select>
        </div>
        <div className="resource-actions">
          <Button size="small" danger onClick={handleResetSchedules}>
            重置行程
          </Button>
        </div>
      </div>

      <div className="resource-columns">
        <div className="resource-column">
          <div className="resource-section unique-section">
            <div className="section-label">方案行程点</div>
            <div className="resource-cards">
              {availablePlanResources.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#999', padding: '8px 4px' }}>
                  暂无可用方案行程点
                </div>
              ) : availablePlanResources.map(resource => (
                <div
                  key={resource.id}
                  className={`resource-card ${resource.type} unique`}
                  draggable
                  onDragStart={(event) => {
                    setDraggedResource(resource);
                    setIsDragging(true);
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('resource', JSON.stringify(resource));
                  }}
                  onDragEnd={() => {
                    setDraggedResource(null);
                    setIsDragging(false);
                  }}
                  style={{
                    background: activityTypes[resource.type].color,
                    cursor: 'grab'
                  }}
                  title={resource.description}
                >
                  <div className="resource-info">
                    <div className="resource-name">{resource.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="resource-column">
          <div className="resource-section repeatable-section">
            <div className="section-label">可重复活动</div>
            <div className="resource-cards">
              {repeatableResources.map(resource => (
                <div
                  key={resource.id}
                  className={`resource-card ${resource.type} repeatable`}
                  draggable
                  onDragStart={(event) => {
                    setDraggedResource(resource);
                    setIsDragging(true);
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('resource', JSON.stringify(resource));
                  }}
                  onDragEnd={() => {
                    setDraggedResource(null);
                    setIsDragging(false);
                  }}
                  style={{
                    background: activityTypes[resource.type].color,
                    cursor: 'grab'
                  }}
                  title={resource.description}
                >
                  <div className="resource-info">
                    <div className="resource-name">{resource.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!groupData) {
    return <div className="calendar-empty">请选择团组查看日程</div>;
  }

  return (
    <div
      className={`calendar-days-view calendar-workshop${showResources ? '' : ' calendar-only'}`}
      ref={calendarRef}
      style={{ '--slot-height': `${slotHeight}px` }}
    >
      <div className={`calendar-layout${showResources ? '' : ' calendar-only'}`}>
        <div className="calendar-container">
          <div className="calendar-scroll-wrapper" ref={scrollWrapperRef}>
            <CalendarGrid
              days={days}
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

        <ResourceSidebar
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

        <ActivityPopover
          anchorRect={popoverState.anchorRect}
          isOpen={popoverState.isOpen}
          mode={popoverState.mode}
          activity={popoverState.activity}
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

export default CalendarWorkshop;

