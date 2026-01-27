import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Modal, Form, Input, Select, TimePicker, ColorPicker, message, Tooltip, Dropdown, Button, Checkbox, InputNumber } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import './CalendarDaysView.css';

const { TextArea } = Input;
const { Option } = Select;

const START_HOUR = 6;
const END_HOUR = 20;
const SLOT_MINUTES = 15;
const HEADER_HEIGHT = 30;
const SLOT_HEIGHT = 10;
const SLOTS_PER_HOUR = Math.max(1, Math.round(60 / SLOT_MINUTES));

// 拖拽影子组件已移除 - 使用简单虚线框代替

// 预设行程资源
const presetResourcesData = [
  // 重复性活动（可多次使用）
  { id: 'meal', type: 'meal', title: '早餐', icon: '🍽️', duration: 1, description: '酒店自助早餐', isUnique: false },
  { id: 'lunch', type: 'meal', title: '午餐', icon: '🍽️', duration: 1, description: '粤菜午餐', isUnique: false },
  { id: 'dinner', type: 'meal', title: '晚餐', icon: '🍽️', duration: 1.5, description: '特色晚餐', isUnique: false },
  { id: 'transport', type: 'transport', title: '大巴交通', icon: '🚌', duration: 1, description: '团组集体交通', isUnique: false },
  { id: 'rest', type: 'rest', title: '休息', icon: '🏨', duration: 1, description: '酒店休息', isUnique: false },
  { id: 'free', type: 'free', title: '自由活动', icon: '🚶', duration: 2, description: '自由安排', isUnique: false },

  // 单一活动（只能使用一次） - 蓝色visit类型
  { id: 'science', type: 'visit', title: '香港科学馆', icon: '🏛️', duration: 2.5, description: '常设展览参观', isUnique: true },
  { id: 'ocean', type: 'visit', title: '海洋公园', icon: '🏛️', duration: 4, description: '海洋动物展示', isUnique: true },
  { id: 'peak', type: 'visit', title: '太平山顶', icon: '🏛️', duration: 3, description: '观光与拍照', isUnique: true },
  { id: 'university', type: 'visit', title: '香港大学', icon: '🏛️', duration: 2, description: '校园参观', isUnique: true },
  { id: 'museum', type: 'visit', title: '历史博物馆', icon: '🏛️', duration: 2, description: '文化历史学习', isUnique: true },
  { id: 'activity', type: 'activity', title: '团队活动', icon: '🎯', duration: 2, description: '互动游戏', isUnique: true }
];

const DEFAULT_PLAN_DURATION = 2;

const CalendarDaysView = ({
  groupData,
  schedules = [],
  onUpdate,
  onPlanChange,
  showResources = true,
  resourceWidth,
  showAiRuleLink = true
}) => {
  const repeatableResources = useMemo(
    () => presetResourcesData.filter((resource) => !resource.isUnique),
    []
  );
  const defaultAiRules = useMemo(() => ({
    timeSlots: ['MORNING', 'AFTERNOON'],
    slotWindows: {
      MORNING: { start: 9, end: 12 },
      AFTERNOON: { start: 14, end: 17 },
      EVENING: { start: 19, end: 21 }
    },
    requireAllPlanItems: false
  }), []);
  const [itineraryPlans, setItineraryPlans] = useState([]);
  const [locations, setLocations] = useState([]);
  const [planResources, setPlanResources] = useState([]);
  const [availablePlanResources, setAvailablePlanResources] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(groupData?.itinerary_plan_id ?? null);
  const [activities, setActivities] = useState(schedules);
  const [aiRules, setAiRules] = useState(null);
  const [aiRulesVisible, setAiRulesVisible] = useState(false);
  const [aiPlanning, setAiPlanning] = useState(false);
  const [aiConflictsVisible, setAiConflictsVisible] = useState(false);
  const [aiConflicts, setAiConflicts] = useState([]);
  const [aiConflictSummary, setAiConflictSummary] = useState(null);
  const [aiHistoryVisible, setAiHistoryVisible] = useState(false);
  const [aiHistoryLoading, setAiHistoryLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [draggedActivity, setDraggedActivity] = useState(null);
  const [draggedResource, setDraggedResource] = useState(null); // 拖拽的资源卡片
  const [returningActivity, setReturningActivity] = useState(null); // 正在返回的活动
  const dragOffsetRef = useRef({ x: 0, y: 0 }); // 使用ref记录拖拽偏移，避免状态更新延迟
  const [resizingActivity, setResizingActivity] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  // dragGhost已移除 - 使用简单虚线框代替
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'
  const saveTimeoutRef = useRef(null);
  const [dropIndicator, setDropIndicator] = useState(null); // 拖拽放置指示器
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [form] = Form.useForm();
  const [aiRulesForm] = Form.useForm();
  const calendarRef = useRef(null);
  const dragPreviewRef = useRef(null);
  const resourcePanelStyle = resourceWidth ? { width: resourceWidth } : undefined;

  // 加载行程方案
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

    const loadAiRules = async () => {
      try {
        const response = await api.get('/ai/rules');
        if (!isMounted) return;
        setAiRules(response.data || null);
      } catch (error) {
        if (!isMounted) return;
        setAiRules(null);
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
    loadAiRules();
    loadLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!aiRules) return;
    aiRulesForm.setFieldsValue({
      timeSlots: aiRules.timeSlots,
      requireAllPlanItems: aiRules.requireAllPlanItems,
      slotWindows: aiRules.slotWindows
    });
  }, [aiRules, aiRulesForm]);

  // 同步外部日程数据
  useEffect(() => {
    setActivities(schedules || []);
  }, [groupData?.id, schedules]);

  useEffect(() => {
    setSelectedPlanId(groupData?.itinerary_plan_id ?? null);
  }, [groupData?.itinerary_plan_id]);

  // 根据团组选中的行程方案生成资源卡片
  useEffect(() => {
    const selectedPlan = itineraryPlans.find(
      (plan) => plan.id === selectedPlanId
    );
    setActivePlan(selectedPlan || null);

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
        icon: '🏛️',
        duration: DEFAULT_PLAN_DURATION,
        description: item.address
          ? `${item.address} · 容量${item.capacity || 0}人`
          : `容量${item.capacity || 0}人`,
        isUnique: true,
        locationId: item.location_id,
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

  const handleAutoPlan = async () => {
    if (!groupData?.id) return;
    if (!selectedPlanId && !groupData?.itinerary_plan_id) {
      message.warning('请先选择行程方案');
      return;
    }
    setAiPlanning(true);
    try {
      const response = await api.post(
        '/ai/plan/itinerary',
        {
          groupId: groupData.id,
          planId: selectedPlanId ?? groupData?.itinerary_plan_id
        },
        { timeout: 60000 }
      );
      const scheduleList = Array.isArray(response.data?.scheduleList)
        ? response.data.scheduleList
        : [];
      const conflicts = Array.isArray(response.data?.conflicts)
        ? response.data.conflicts
        : [];
      const summary = response.data?.summary || null;

      if (scheduleList.length > 0) {
        setActivities(scheduleList);
        onUpdate?.(scheduleList);
      }

      if (conflicts.length > 0) {
        setAiConflicts(conflicts);
        setAiConflictSummary(summary);
        setAiConflictsVisible(true);
        message.warning(`已安排${response.data?.summary?.planned || 0}个，${conflicts.length}个未排入`, 2);
      } else {
        message.success('已生成行程', 1);
      }
    } catch (error) {
      if (error?.code === 'ECONNABORTED') {
        message.error('AI行程生成超时，请稍后重试');
        return;
      }
      const status = error?.response?.status;
      if (status === 409) {
        const conflicts = Array.isArray(error?.response?.data?.conflicts)
          ? error.response.data.conflicts
          : [];
        const summary = error?.response?.data?.summary || null;
        if (conflicts.length > 0) {
          setAiConflicts(conflicts);
          setAiConflictSummary(summary);
          setAiConflictsVisible(true);
        }
        message.error('无法排完全部方案行程点，请调整日期/时段或资源限制');
      } else {
        message.error('AI行程生成失败');
      }
    } finally {
      setAiPlanning(false);
    }
  };

  const handleOpenAiHistory = async () => {
    setAiHistoryVisible(true);
    setAiHistoryLoading(true);
    try {
      const response = await api.get('/ai/history');
      const items = Array.isArray(response.data?.items) ? response.data.items : [];
      setAiHistory(items);
    } catch (error) {
      setAiHistory([]);
      message.error('加载AI记录失败');
    } finally {
      setAiHistoryLoading(false);
    }
  };

  // 全局拖拽结束事件监听 - 确保清理所有拖拽状态
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      // 如果有任何拖拽状态残留，清理它们
      if (isDragging || draggedActivity || draggedResource) {
        console.log('全局拖拽结束清理');
        setDraggedActivity(null);
        setDraggedResource(null);
        setReturningActivity(null);
        dragOffsetRef.current = { x: 0, y: 0 };
        setDropIndicator(null);
        setIsDragging(false);
      }
    };

    document.addEventListener('dragend', handleGlobalDragEnd);
    return () => document.removeEventListener('dragend', handleGlobalDragEnd);
  }, [isDragging, draggedActivity, draggedResource]);

  // 活动类型配置
  const activityTypes = {
    meal: { label: '餐饮', color: '#52c41a', icon: '🍽️' },
    visit: { label: '参观', color: '#1890ff', icon: '🏛️' },
    transport: { label: '交通', color: '#fa8c16', icon: '🚌' },
    rest: { label: '休息', color: '#8c8c8c', icon: '🏨' },
    activity: { label: '活动', color: '#722ed1', icon: '🎯' },
    free: { label: '自由活动', color: '#13c2c2', icon: '🚶' }
  };

  const locationColorMap = useMemo(() => {
    const entries = Array.isArray(locations)
      ? locations
          .map((loc) => [Number(loc.id), loc.color])
          .filter(([id, color]) => Number.isFinite(id) && color)
      : [];
    return new Map(entries);
  }, [locations]);

  const locationMap = useMemo(() => {
    const entries = Array.isArray(locations)
      ? locations
          .map((loc) => [Number(loc.id), loc])
          .filter(([id, loc]) => Number.isFinite(id) && loc)
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

  // 生成时间槽（6:00-20:45，每15分钟）
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

  // 计算天数
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

  // 时间转换为网格位置
  const timeToGridRow = (time) => {
    const [hour, minute] = time.split(':').map(Number);
    const totalMinutes = (hour - START_HOUR) * 60 + minute;
    const slotIndex = Math.max(0, Math.round(totalMinutes / SLOT_MINUTES));
    return slotIndex + 2; // +2 因为第一行是header
  };

  // 网格位置转换为时间
  const gridRowToTime = (row) => {
    const totalMinutes = (row - 2) * SLOT_MINUTES; // -2 因为第一行是header
    const hour = Math.floor(totalMinutes / 60) + START_HOUR;
    const minute = totalMinutes % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // 计算活动持续时长（网格行数）
  const calculateDuration = (startTime, endTime) => {
    const start = timeToGridRow(startTime);
    const end = timeToGridRow(endTime);
    return end - start;
  };

  // 检测时间冲突并返回重叠的活动组
  const detectOverlaps = useCallback((activities) => {
    const groups = {};

    activities.forEach(activity => {
      const key = `${activity.date}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(activity);
    });

    // 为每个日期检测重叠
    Object.keys(groups).forEach(dateKey => {
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

          // 检查时间重叠
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

  // 防止拖拽时滚动
  const preventScroll = useCallback((prevent) => {
    const scrollWrapper = calendarRef.current?.querySelector('.calendar-scroll-wrapper');
    if (scrollWrapper) {
      if (prevent) {
        scrollWrapper.classList.add('dragging-mode');
      } else {
        scrollWrapper.classList.remove('dragging-mode');
      }
    }
  }, []);

  // 处理时间格点击 - 创建新活动
  const handleSlotClick = (date, time) => {
    if (isDragging || isResizing) return;

    setSelectedSlot({ date, time });
    setEditingActivity(null);

    // 设置默认值
    const startTime = dayjs(`2025-01-01 ${time}`, 'YYYY-MM-DD HH:mm');
    const endTime = startTime.add(1, 'hour');

    form.setFieldsValue({
      date: dayjs(date),
      startTime: startTime,
      endTime: endTime,
      type: 'visit',
      title: '',
      locationId: null,
      location: '',
      description: ''
    });

    setModalVisible(true);
  };

  // 处理活动点击 - 目前禁用编辑功能
  const handleActivityClick = (e, activity) => {
    e.stopPropagation();
    if (isDragging || isResizing) return;

    // 点击活动卡片不再触发编辑弹窗
    // 如需编辑，可以通过右键菜单或其他方式触发
    console.log('点击活动:', activity.title);
  };

  // 处理活动右键菜单
  const handleActivityContextMenu = (e, activity) => {
    e.preventDefault();
    e.stopPropagation();

    // 打开编辑弹窗
    setEditingActivity(activity);

    form.setFieldsValue({
      date: dayjs(activity.date),
      startTime: dayjs(`2025-01-01 ${activity.startTime}`, 'YYYY-MM-DD HH:mm'),
      endTime: dayjs(`2025-01-01 ${activity.endTime}`, 'YYYY-MM-DD HH:mm'),
      type: activity.type,
      title: activity.title,
      locationId: activity.locationId ?? null,
      location: activity.location || locationMap.get(Number(activity.locationId))?.name || '',
      description: activity.description
    });

    setModalVisible(true);
  };

  // 拖拽开始
  const handleDragStart = (e, activity) => {
    console.log('拖拽开始:', activity.title);
    setDraggedActivity(activity);
    setIsDragging(true);

    // 记录鼠标在活动卡片内的相对位置
    const activityElement = e.currentTarget;
    const rect = activityElement.getBoundingClientRect();
    const offsetY = e.clientY - rect.top; // 鼠标距离活动卡片顶部的距离
    const offsetX = e.clientX - rect.left;

    console.log('📍 拖拽开始偏移记录:', {
      '鼠标在卡片内Y偏移': offsetY,
      '卡片高度': rect.height,
      '鼠标客户端Y': e.clientY,
      '卡片顶部Y': rect.top,
      '说明': '偏移量 = 鼠标Y - 卡片顶部Y'
    });

    // 使用ref存储偏移，确保立即可用
    dragOffsetRef.current = { x: offsetX, y: offsetY };

    // 设置拖拽数据
    const dragData = {
      ...activity,
      dragOffsetY: offsetY,
      dragOffsetX: offsetX
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';

    // 设置拖拽预览为空图像，减少视觉干扰
    const emptyImg = new Image();
    emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
    e.dataTransfer.setDragImage(emptyImg, 0, 0);

    // 不再需要创建拖拽影子 - 使用简单虚线框
  };

  // 拖拽结束
  const handleDragEnd = (e) => {
    console.log('拖拽结束');
    // 清除所有拖拽相关状态
    setDraggedActivity(null);
    setDraggedResource(null);
    setReturningActivity(null);
    dragOffsetRef.current = { x: 0, y: 0 };
    setDropIndicator(null);
    // dragGhost已移除
    setIsDragging(false);
    // 确保清除任何残留的拖拽视觉效果
    e.dataTransfer.clearData();
  };

  const updateDropIndicatorForDate = (e, dateStr) => {
    if (draggedResource) return;
    if (!draggedActivity || !dateStr) return;

    const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');
    const scrollWrapper = calendarRef.current?.querySelector('.calendar-scroll-wrapper');
    if (!calendarGrid || !scrollWrapper) return;

    const wrapperRect = scrollWrapper.getBoundingClientRect();
    const scrollTop = scrollWrapper.scrollTop;
    const mouseY = e.clientY - wrapperRect.top + scrollTop;
    const activityTopY = mouseY - dragOffsetRef.current.y;

    const adjustedY = activityTopY - HEADER_HEIGHT;
    let targetSlotIndex;
    if (adjustedY < 0) {
      targetSlotIndex = 0;
    } else {
      targetSlotIndex = Math.round(adjustedY / SLOT_HEIGHT);
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

  // 拖拽悬停
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedResource ? 'copy' : 'move';

    // 如果是资源卡片拖拽，简单处理
    if (draggedResource) {
      return;
    }

    if (!draggedActivity) return;

    // 获取当前悬停的列（日期）
    const targetElement = e.target.closest('.time-slot');
    if (targetElement) {
      const dateStr = targetElement.dataset.date;
      updateDropIndicatorForDate(e, dateStr);
    }
  };

  // 拖拽进入
  const handleDragEnter = (e) => {
    e.preventDefault();
  };

  // 拖拽离开
  const handleDragLeave = (e) => {
    e.preventDefault();
    // 离开日历区域时隐藏指示器
    const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');
    if (calendarGrid && !calendarGrid.contains(e.relatedTarget)) {
      setDropIndicator(null);
    }
  };

  // 拖拽放置
  const handleDrop = (e, targetDate, targetTime) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('拖拽放置到:', targetDate, targetTime);
    console.log('draggedResource:', draggedResource);
    console.log('draggedActivity:', draggedActivity);

    // 处理资源卡片拖拽
    if (draggedResource) {
      console.log('处理资源卡片拖拽:', draggedResource.title);
      // 创建新活动
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
        resourceId: draggedResource.id,  // 记录资源ID
        isFromResource: true  // 标记来自资源
      };

      const updatedActivities = [...activities, newActivity];
      setActivities(updatedActivities);
      onUpdate(updatedActivities);

      // 清除拖拽状态
      setDraggedResource(null);
      setIsDragging(false);

      message.success(`已添加活动：${draggedResource.title}`, 1);
      return;
    }

    // 处理已有活动的拖拽（考虑鼠标偏移）
    if (!draggedActivity) {
      console.log('没有被拖拽的活动');
      return;
    }

    // 获取整个日历网格，而不是单个时间槽
    const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');
    const scrollWrapper = calendarRef.current?.querySelector('.calendar-scroll-wrapper');

    if (!calendarGrid || !scrollWrapper) {
      console.log('找不到日历网格');
      return;
    }

    // 计算鼠标在网格中的位置
    const gridRect = calendarGrid.getBoundingClientRect();
    const wrapperRect = scrollWrapper.getBoundingClientRect();
    const scrollTop = scrollWrapper.scrollTop;

    // 方法：计算鼠标相对于滚动容器的位置，加上滚动偏移
    // 这样可以避免网格顶部滚出视窗时的计算问题
    const mouseY = e.clientY - wrapperRect.top + scrollTop;

    // 尝试从拖拽数据中获取偏移量
    let dragOffsetY = dragOffsetRef.current.y;
    try {
      const dragDataStr = e.dataTransfer.getData('application/json');
      if (dragDataStr) {
        const dragData = JSON.parse(dragDataStr);
        if (dragData.dragOffsetY !== undefined) {
          dragOffsetY = dragData.dragOffsetY;
        }
      }
    } catch (err) {
      console.log('使用ref中的偏移量');
    }

    // 使用记录的拖拽偏移量计算活动卡片上沿的位置
    const activityTopY = mouseY - dragOffsetY;

    console.log('🎯 拖拽定位计算:', {
      '鼠标客户端Y': e.clientY,
      '容器顶部': wrapperRect.top,
      '滚动偏移': scrollTop,
      '鼠标相对Y': mouseY,
      '拖拽偏移（鼠标在卡片内位置）': dragOffsetY,
      '活动上沿Y': activityTopY,
      '说明': '活动上沿Y = 鼠标Y - 拖拽偏移'
    });

    // 计算原始持续时间
    const originalStart = timeToGridRow(draggedActivity.startTime);
    const originalEnd = timeToGridRow(draggedActivity.endTime);
    const duration = originalEnd - originalStart;

    // 每个时间槽40px（1小时），头部30px
    const headerHeight = HEADER_HEIGHT;
    const slotHeight = SLOT_HEIGHT;

    // 计算活动上沿对应的时间槽索引
    const adjustedY = activityTopY - headerHeight;

    // 根据位置计算最接近的时间槽
    let targetSlotIndex;
    if (adjustedY < 0) {
      // 如果在头部上方，设置为第一个时间槽
      targetSlotIndex = 0;
    } else {
      // 使用四舍五入定位到最接近的时间槽（与标尺线保持一致）
      targetSlotIndex = Math.round(adjustedY / slotHeight);
    }

    // 确保索引在有效范围内
    const maxStartIndex = Math.max(0, timeSlots.length - duration - 1);
    const constrainedIndex = Math.max(0, Math.min(maxStartIndex, targetSlotIndex));
    const adjustedStartTime = timeSlots[constrainedIndex];

    console.log('📍 最终放置位置:', {
      '活动上沿相对网格Y': adjustedY,
      '目标时间槽索引': targetSlotIndex,
      '约束后索引': constrainedIndex,
      '对应开始时间': adjustedStartTime,
      '活动持续格数': duration,
      'Grid行': constrainedIndex + 2,
      '说明': '活动上沿对应的时间即为开始时间'
    });

    // 计算新的结束时间
    const newStartRow = timeToGridRow(adjustedStartTime);
    const newEndRow = Math.min(newStartRow + duration, timeSlots.length + 1);
    const newEndTime = gridRowToTime(newEndRow);

    console.log('更新活动时间:', adjustedStartTime, '->', newEndTime);

    // 更新活动
    const updatedActivities = activities.map(activity =>
      activity.id === draggedActivity.id
        ? {
            ...activity,
            date: targetDate,
            startTime: adjustedStartTime,
            endTime: newEndTime
          }
        : activity
    );

    setActivities(updatedActivities);

    // 自动保存
    setSaveStatus('saving');
    onUpdate(updatedActivities);

    // 模拟保存延迟
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      message.success('活动已自动保存', 1);
    }, 500);
  };

  // 时间调整开始 - 只响应鼠标左键
  const handleResizeStart = (e, activity) => {
    // 只响应鼠标左键
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    setResizingActivity(activity);
    setIsResizing(true);

    console.log('🎯 开始调整活动时长:', activity.title);

    let latestActivities = activities; // 保存最新的activities状态
    let isDragging = true; // 标记是否正在拖拽
    const initialMouseY = e.clientY; // 记录初始鼠标位置
    const initialEndTime = activity.endTime; // 记录初始结束时间
    let hasMovedEnough = false; // 标记是否移动了足够的距离

    const handleMouseMove = (moveEvent) => {
      // 检查是否还在按住鼠标左键
      if (!isDragging || moveEvent.buttons !== 1) {
        // 如果不再按住左键，触发结束
        handleMouseUp();
        return;
      }

      // 计算鼠标移动的距离
      const mouseDelta = moveEvent.clientY - initialMouseY;

      // 如果移动距离太小，忽略（防止初始抖动）
      if (!hasMovedEnough && Math.abs(mouseDelta) < 10) {
        return;
      }
      hasMovedEnough = true;

      const scrollWrapper = calendarRef.current?.querySelector('.calendar-scroll-wrapper');
      const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');

      if (!scrollWrapper || !calendarGrid) return;

      const wrapperRect = scrollWrapper.getBoundingClientRect();
      const scrollTop = scrollWrapper.scrollTop;

      // 使用滚动容器作为参考点，避免滚动问题
      const relativeY = moveEvent.clientY - wrapperRect.top + scrollTop;

      // 每个时间槽的高度是40px（1小时），第一行是30px的日期头部
      const headerHeight = HEADER_HEIGHT;
      const rowHeight = SLOT_HEIGHT;

      // 计算鼠标位置对应的时间槽行数
      const adjustedY = relativeY - headerHeight;
      const slotIndex = Math.max(0, Math.round(adjustedY / rowHeight));

      // 确保不超出时间范围
      const maxSlots = timeSlots.length - 1;
      const constrainedSlotIndex = Math.min(slotIndex, maxSlots);

      // 获取对应的时间
      const newEndTime = timeSlots[constrainedSlotIndex];

      if (!newEndTime) return;

      // 确保结束时间晚于开始时间（至少30分钟）
      const startRow = timeToGridRow(activity.startTime);
      const endRow = timeToGridRow(newEndTime);

      if (endRow > startRow) {
        console.log('📏 调整时长到:', newEndTime);

        // 实时更新活动时长
        const updatedActivities = latestActivities.map(act =>
          act.id === activity.id
            ? { ...act, endTime: newEndTime }
            : act
        );

        latestActivities = updatedActivities; // 保存最新状态
        setActivities(updatedActivities);
      }
    };

    const handleMouseUp = () => {
      if (!isDragging) return;

      isDragging = false;
      console.log('✅ 松开鼠标，确定时长调整');

      setIsResizing(false);
      setResizingActivity(null);

      // 移除事件监听
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseUp);

      // 立即保存更改，无需确认弹窗
      setSaveStatus('saving');
      onUpdate(latestActivities);

      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saved');
      }, 500);
    };

    // 监听鼠标事件
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp); // 鼠标离开页面也触发结束
  };

  // 保存活动
  const handleSaveActivity = async () => {
    try {
      const values = await form.validateFields();
      const baseActivity = editingActivity || {};
      const selectedLocationId = values.locationId ?? null;
      const locationRecord = Number.isFinite(Number(selectedLocationId))
        ? locationMap.get(Number(selectedLocationId))
        : null;
      const resolvedLocationName = values.location?.trim()
        || locationRecord?.name
        || '';
      const resolvedLocationColor = locationRecord?.color
        || baseActivity.locationColor
        || null;
      const activityData = {
        ...baseActivity,
        id: editingActivity?.id || Date.now(),
        groupId: groupData.id,
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.startTime.format('HH:mm'),
        endTime: values.endTime.format('HH:mm'),
        type: values.type,
        title: values.title || '', // 允许为空
        location: resolvedLocationName,
        description: values.description || '',
        locationId: selectedLocationId ? Number(selectedLocationId) : null,
        locationColor: resolvedLocationColor,
        color: resolveActivityColor({
          type: values.type,
          locationId: selectedLocationId,
          locationColor: resolvedLocationColor
        })
      };

      let updatedActivities;
      if (editingActivity) {
        updatedActivities = activities.map(activity =>
          activity.id === editingActivity.id ? activityData : activity
        );
      } else {
        updatedActivities = [...activities, activityData];
      }

      setActivities(updatedActivities);

      // 自动保存
      setSaveStatus('saving');
      onUpdate(updatedActivities);
      setModalVisible(false);

      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saved');
        message.success(editingActivity ? '活动已更新并保存' : '活动已创建并保存', 1);
      }, 500);
    } catch (error) {
      console.error('保存活动失败:', error);
    }
  };

  // 删除活动
  const handleDeleteActivity = (activityId) => {
    const updatedActivities = activities.filter(activity => activity.id !== activityId);
    setActivities(updatedActivities);

    // 自动保存
    setSaveStatus('saving');
    onUpdate(updatedActivities);

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      message.success('活动已删除并保存', 1);
    }, 500);
  };

  // 渲染活动卡片
  const renderActivity = (activity, dayIndex) => {
    const isDragged = draggedActivity?.id === activity.id;
    const activityColor = activity.color || resolveActivityColor({
      type: activity.type,
      locationId: activity.locationId,
      locationColor: activity.locationColor
    });

    // 计算活动的网格位置和大小
    const startRow = timeToGridRow(activity.startTime);
    const endRow = timeToGridRow(activity.endTime);

    const durationRows = Math.max(1, endRow - startRow);
    const style = {
      gridColumn: dayIndex + 2, // +2 因为第一列是时间标签
      gridRow: `${startRow} / ${endRow}`,
      zIndex: isDragged ? 1 : 20,
      '--activity-height': `${durationRows * SLOT_HEIGHT}px`,
      backgroundColor: activityColor
    };

    const displayLocation = activity.location || activity.title || '未命名';

    return (
      <div
        key={activity.id}
        className={`calendar-activity ${activity.type} ${isDragged ? 'dragging' : ''}`}
        style={style}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, activity)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => {
          if (!draggedActivity && !draggedResource) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = draggedResource ? 'copy' : 'move';
          updateDropIndicatorForDate(e, activity.date);
        }}
        onDrop={(e) => {
          if (!draggedActivity && !draggedResource) return;
          e.preventDefault();
          e.stopPropagation();
          handleDrop(e, activity.date, activity.startTime);
        }}
        onClick={(e) => handleActivityClick(e, activity)}
        onContextMenu={(e) => handleActivityContextMenu(e, activity)}
        title="右键编辑活动"
      >
        <div className="activity-content simple-activity">
          <div className="activity-time">
            {activity.startTime}-{activity.endTime}
          </div>
          <div className="activity-title">{displayLocation}</div>
        </div>

        {/* 时间调整手柄 */}
        <div
          className={`resize-handle ${resizingActivity?.id === activity.id ? 'resizing' : ''}`}
          onMouseDown={(e) => handleResizeStart(e, activity)}
          onContextMenu={(e) => e.preventDefault()} // 禁用右键菜单
          title="拖拽调整活动时长"
        />
      </div>
    );
  };

  // 渲染网格内容
  const renderGridContent = () => {
    const dayGroups = detectOverlaps(activities);

    return (
      <>
        {/* 角落单元格 - 压缩版 */}
        <div className="corner-cell-compact">时间</div>

        {/* 日期头部 - 压缩版 */}
        {days.map((day, dayIndex) => (
          <div
            key={day.dateStr}
            className={`date-header-compact ${day.isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''}`}
            style={{
              gridColumn: dayIndex + 2,
              gridRow: 1
            }}
            title={`${day.month}月${day.day}日 ${day.dayNameFull}`}
          >
            <div className="date-single-line">
              {day.month}/{day.day}<span className="weekday-inline">{day.dayName}</span>
            </div>
            {day.isToday && <div className="today-badge">今</div>}
          </div>
        ))}

        {/* 时间标签和时间槽 */}
        {timeSlots.map((time, timeIndex) => {
          const isHourSlot = time.endsWith(':00');
          const rowStart = timeIndex + 2;
          const rowEnd = Math.min(rowStart + SLOTS_PER_HOUR, timeSlots.length + 2);

          return (
            <React.Fragment key={time}>
              {/* 时间标签 */}
              {isHourSlot ? (
                <div
                  className="time-label hour-label"
                  style={{
                    gridColumn: 1,
                    gridRow: `${rowStart} / ${rowEnd}`
                  }}
                >
                  {time}
                </div>
              ) : null}

              {/* 每天的时间格 - 仅用于点击创建和拖拽放置 */}
              {days.map((day, dayIndex) => (
                <div
                  key={`${day.dateStr}-${time}`}
                  className={`time-slot ${time.endsWith(':00') ? 'hour-slot' : ''}`}
                  data-date={day.dateStr}
                  data-time={time}
                  onClick={() => handleSlotClick(day.dateStr, time)}
                  onDrop={(e) => handleDrop(e, day.dateStr, time)}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: timeIndex + 2,
                    height: `${SLOT_HEIGHT}px`
                  }}
                />
              ))}
            </React.Fragment>
          );
        })}

        {/* 渲染所有活动卡片 - 简化版本 */}
        {activities.map(activity => {
          const dayIndex = days.findIndex(d => d.dateStr === activity.date);
          if (dayIndex === -1) return null;

          return renderActivity(activity, dayIndex);
        })}

        {/* 拖拽放置指示器 */}
        {dropIndicator && isDragging && (
          <div
            className="drop-indicator"
            style={{
              gridColumn: dropIndicator.dayIndex + 2,
              gridRow: `${dropIndicator.slotIndex + 2} / ${dropIndicator.slotIndex + 2 + dropIndicator.duration}`,
              backgroundColor: 'rgba(24, 144, 255, 0.2)',
              border: '2px dashed #1890ff',
              borderRadius: '4px',
              pointerEvents: 'none',
              zIndex: 15
            }}
          >
            <div style={{
              padding: '4px 8px',
              fontSize: '12px',
              color: '#1890ff',
              fontWeight: 'bold'
            }}>
              {dropIndicator.time}
            </div>
          </div>
        )}
      </>
    );
  };

  // 拖拽预览组件
  const DragPreview = () => {
    if (!dragPreview || !isDragging) return null;

    return (
      <div
        className="drag-preview calendar-activity"
        style={{
          position: 'fixed',
          left: dragPreview.x,
          top: dragPreview.y,
          width: dragPreview.width,
          height: dragPreview.height,
          pointerEvents: 'none',
          zIndex: 1000,
          background: dragPreview.activity.color || resolveActivityColor({
            type: dragPreview.activity.type,
            locationId: dragPreview.activity.locationId,
            locationColor: dragPreview.activity.locationColor
          })
        }}
        ref={dragPreviewRef}
      >
        <div className="activity-content">
          <div className="activity-title">{dragPreview.activity.title}</div>
          <div className="activity-time">
            {dragPreview.activity.startTime}-{dragPreview.activity.endTime}
          </div>
        </div>
      </div>
    );
  };

  // 监听鼠标移动更新拖拽预览位置 - 暂时禁用，使用浏览器原生拖拽预览
  // useEffect(() => {
  //   if (!isDragging || !dragPreview) return;

  //   const handleMouseMove = (e) => {
  //     setDragPreview(prev => ({
  //       ...prev,
  //       x: e.clientX - prev.width / 2,
  //       y: e.clientY - prev.height / 2
  //     }));
  //   };

  //   document.addEventListener('mousemove', handleMouseMove);
  //   return () => document.removeEventListener('mousemove', handleMouseMove);
  // }, [isDragging, dragPreview]);

  if (!groupData) {
    return <div className="calendar-empty">请选择团组查看日程</div>;
  }

  return (
    <div
      className="calendar-days-view calendar-fully-maximized"
      ref={calendarRef}
      style={{ '--slot-height': `${SLOT_HEIGHT}px` }}
    >
      {/* 移除独立工具栏，集成到顶部 */}

      <div className={`calendar-layout${showResources ? '' : ' calendar-only'}`}>
        {/* 日历容器 */}
        <div className="calendar-container">
          <div className="calendar-scroll-wrapper">
            <div
              className={`calendar-grid ${isDragging ? 'dragging-active' : ''}`}
              style={{
                gridTemplateColumns: `60px repeat(${days.length}, 1fr)`,
                gridTemplateRows: `30px repeat(${timeSlots.length}, ${SLOT_HEIGHT}px)`
              }}
            >
              {renderGridContent()}
            </div>
          </div>
        </div>

        {/* 行程资源卡片区域 */}
        {showResources && (
          <div
            className="resource-cards-container"
            style={resourcePanelStyle}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
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

                  const updatedActivities = activities.filter(a => a.id !== draggedActivity.id);
                  setActivities(updatedActivities);
                  onUpdate(updatedActivities);
                  message.success(`?? ${draggedActivity.title} ????`, 1);
                }
              }

              // ????????
              setDraggedActivity(null);
              setDraggedResource(null);
              // dragGhost???
              setDropIndicator(null);
              setIsDragging(false);
              setReturningActivity(null);
              // ??????
              dragOffsetRef.current = { x: 0, y: 0 };
            }}
        >
          <div className="resource-header">
            <div className="resource-hint">
              <div className="resource-hint-header">
                <span className="resource-hint-label">行程方案</span>
                {showAiRuleLink && (
                  <Button
                    type="link"
                    size="small"
                    className="ai-rule-link"
                    onClick={() => {
                      const nextRules = aiRules || defaultAiRules;
                      aiRulesForm.setFieldsValue({
                        timeSlots: nextRules.timeSlots,
                        requireAllPlanItems: nextRules.requireAllPlanItems,
                        slotWindows: nextRules.slotWindows
                      });
                      setAiRulesVisible(true);
                    }}
                  >
                    AI规则
                  </Button>
                )}
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
              <Button size="small" onClick={handleAutoPlan} loading={aiPlanning}>
                AI行程
              </Button>
            </div>
            <div className="resource-history">
              <Button type="link" size="small" onClick={handleOpenAiHistory}>
                AI使用记录
              </Button>
            </div>
          </div>

          <div className="resource-columns">
            {/* 行程方案区域 */}
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
                      draggable={true}
                      onDragStart={(e) => {
                        setDraggedResource(resource);
                        setIsDragging(true);
                        e.dataTransfer.effectAllowed = 'copy';
                        e.dataTransfer.setData('resource', JSON.stringify(resource));
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

            {/* 可重复活动区域 */}
            <div className="resource-column">
              <div className="resource-section repeatable-section">
                <div className="section-label">可重复活动</div>
                <div className="resource-cards">
                  {repeatableResources.map(resource => (
                    <div
                      key={resource.id}
                      className={`resource-card ${resource.type} repeatable`}
                      draggable={true}
                      onDragStart={(e) => {
                        setDraggedResource(resource);
                        setIsDragging(true);
                        e.dataTransfer.effectAllowed = 'copy';
                        e.dataTransfer.setData('resource', JSON.stringify(resource));
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
        )}
      </div>

      {/* 拖拽影子已移除 - 使用简单虚线框 */}

      {/* 活动编辑模态框 */}
      <Modal
        title={editingActivity ? '编辑活动' : '创建活动'}
        open={modalVisible}
        onOk={handleSaveActivity}
        onCancel={() => setModalVisible(false)}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="date"
            label="日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <TimePicker.RangePicker showTime format="YYYY-MM-DD" disabled />
          </Form.Item>

          <Form.Item label="时间">
            <Form.Item
              name="startTime"
              style={{ display: 'inline-block', width: 'calc(50% - 12px)' }}
              rules={[{ required: true, message: '请选择开始时间' }]}
            >
              <TimePicker format="HH:mm" minuteStep={SLOT_MINUTES} placeholder="开始时间" />
            </Form.Item>
            <span style={{ display: 'inline-block', width: '24px', textAlign: 'center' }}>-</span>
            <Form.Item
              name="endTime"
              style={{ display: 'inline-block', width: 'calc(50% - 12px)' }}
              rules={[{ required: true, message: '请选择结束时间' }]}
            >
              <TimePicker format="HH:mm" minuteStep={SLOT_MINUTES} placeholder="结束时间" />
            </Form.Item>
          </Form.Item>

          <Form.Item
            name="type"
            label="活动类型"
            rules={[{ required: true, message: '请选择活动类型' }]}
          >
            <Select placeholder="选择活动类型">
              {Object.entries(activityTypes).map(([key, type]) => (
                <Option key={key} value={key}>
                  {type.icon} {type.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="活动标题"
          >
            <Input placeholder="例如：香港科学馆参观（可选）" />
          </Form.Item>

          <Form.Item name="locationId" label="关联地点">
            <Select
              allowClear
              placeholder="选择地点（用于色块显示）"
              showSearch
              optionFilterProp="label"
              onChange={(value) => {
                if (!value) return;
                const location = locationMap.get(Number(value));
                if (location?.name) {
                  form.setFieldsValue({ location: location.name });
                }
              }}
            >
              {locations.map((location) => (
                <Option
                  key={location.id}
                  value={location.id}
                  label={location.name}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        border: '1px solid rgba(0,0,0,0.15)',
                        backgroundColor: location.color || '#1890ff'
                      }}
                    />
                    {location.name}
                  </span>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="location" label="地点">
            <Input placeholder="例如：尖沙咀东部" />
          </Form.Item>

          <Form.Item name="description" label="详细说明">
            <TextArea rows={3} placeholder="活动的详细说明..." />
          </Form.Item>
        </Form>

        {editingActivity && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Button
              danger
              onClick={() => {
                handleDeleteActivity(editingActivity.id);
                setModalVisible(false);
              }}
            >
              删除活动
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        title="AI行程规则"
        open={aiRulesVisible}
        onOk={async () => {
          try {
            const values = await aiRulesForm.validateFields();
            const response = await api.put('/ai/rules', values);
            setAiRules(response.data || values);
            setAiRulesVisible(false);
            message.success('AI规则已保存', 1);
          } catch (error) {
            if (error?.errorFields) return;
            message.error('保存AI规则失败');
          }
        }}
        onCancel={() => setAiRulesVisible(false)}
        okText="保存规则"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <Form form={aiRulesForm} layout="vertical">
          <Form.Item
            name="timeSlots"
            label="启用时段"
            rules={[{ required: true, message: '请选择至少一个时段' }]}
          >
            <Checkbox.Group
              options={[
                { label: '上午', value: 'MORNING' },
                { label: '下午', value: 'AFTERNOON' },
                { label: '晚上', value: 'EVENING' }
              ]}
            />
          </Form.Item>

          <Form.Item label="时段时间（小时）">
            <div className="ai-rule-grid">
              <div className="ai-rule-row">
                <span className="ai-rule-label">上午</span>
                <Form.Item name={['slotWindows', 'MORNING', 'start']} noStyle>
                  <InputNumber min={0} max={23} />
                </Form.Item>
                <span className="ai-rule-sep">-</span>
                <Form.Item name={['slotWindows', 'MORNING', 'end']} noStyle>
                  <InputNumber min={0} max={23} />
                </Form.Item>
              </div>
              <div className="ai-rule-row">
                <span className="ai-rule-label">下午</span>
                <Form.Item name={['slotWindows', 'AFTERNOON', 'start']} noStyle>
                  <InputNumber min={0} max={23} />
                </Form.Item>
                <span className="ai-rule-sep">-</span>
                <Form.Item name={['slotWindows', 'AFTERNOON', 'end']} noStyle>
                  <InputNumber min={0} max={23} />
                </Form.Item>
              </div>
              <div className="ai-rule-row">
                <span className="ai-rule-label">晚上</span>
                <Form.Item name={['slotWindows', 'EVENING', 'start']} noStyle>
                  <InputNumber min={0} max={23} />
                </Form.Item>
                <span className="ai-rule-sep">-</span>
                <Form.Item name={['slotWindows', 'EVENING', 'end']} noStyle>
                  <InputNumber min={0} max={23} />
                </Form.Item>
              </div>
            </div>
          </Form.Item>

          <Form.Item name="requireAllPlanItems" valuePropName="checked">
            <Checkbox>必须安排完所有方案行程点</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="AI行程冲突"
        open={aiConflictsVisible}
        onOk={() => setAiConflictsVisible(false)}
        onCancel={() => setAiConflictsVisible(false)}
        okText="知道了"
        cancelButtonProps={{ style: { display: 'none' } }}
        width={520}
      >
        <div style={{ marginBottom: 12, color: '#595959' }}>
          {aiConflictSummary
            ? `共需安排 ${aiConflictSummary.total || 0} 个，已安排 ${aiConflictSummary.planned || 0} 个，未安排 ${aiConflictSummary.conflicts || 0} 个`
            : `未能安排 ${aiConflicts.length} 个行程点`}
        </div>
        {aiConflicts.length === 0 ? (
          <div style={{ color: '#8c8c8c' }}>暂无冲突明细</div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {aiConflicts.map((item, index) => (
              <div
                key={`${item.locationId || item.location_id || 'loc'}-${index}`}
                style={{
                  padding: '8px 10px',
                  border: '1px solid #f0f0f0',
                  borderRadius: 6,
                  background: '#fafafa',
                  fontSize: 12
                }}
              >
                <div style={{ fontWeight: 600, color: '#262626' }}>
                  {item.locationName || item.location_name || '未命名地点'}
                </div>
                <div style={{ color: '#8c8c8c', marginTop: 4 }}>
                  {item.reason || '无可用时段/容量'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        title="AI使用记录"
        open={aiHistoryVisible}
        onOk={() => setAiHistoryVisible(false)}
        onCancel={() => setAiHistoryVisible(false)}
        okText="关闭"
        cancelButtonProps={{ style: { display: 'none' } }}
        width={620}
      >
        {aiHistoryLoading ? (
          <div style={{ padding: '12px 0', color: '#8c8c8c' }}>加载中...</div>
        ) : aiHistory.length === 0 ? (
          <div style={{ padding: '12px 0', color: '#8c8c8c' }}>暂无记录</div>
        ) : (
          <div className="ai-history-list">
            {aiHistory.map((item) => {
              const summary = item.summary || {};
              const conflicts = Array.isArray(item.conflicts) ? item.conflicts : [];
              const modelLabel = item.model || item.aiModel || item.ai_model || item.provider || '未知模型';
              return (
                <div key={item.id} className="ai-history-item">
                  <div className="ai-history-header">
                    <span>{item.groupName || '未命名团组'}</span>
                    <span className="ai-history-time">
                      {item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm') : ''}
                    </span>
                  </div>
                  <div className="ai-history-meta">
                    模型：{modelLabel} · 方案：{item.planName || '-'} · 需安排{summary.total || 0}个 · 已安排{summary.planned || 0}个 · 未安排{summary.conflicts || 0}个
                  </div>
                  {conflicts.length > 0 ? (
                    <div className="ai-history-issues">
                      问题：
                      <div className="ai-history-issue-list">
                        {conflicts.map((conflict, index) => (
                          <div key={`${item.id}-${index}`} className="ai-history-issue">
                            {conflict.locationName || conflict.location_name || '未命名地点'}：{conflict.reason || '无可用时段/容量'}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="ai-history-issues">问题：无</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CalendarDaysView;
