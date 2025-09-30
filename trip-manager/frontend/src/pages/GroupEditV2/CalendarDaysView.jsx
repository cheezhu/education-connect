import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Form, Input, Select, TimePicker, ColorPicker, message, Tooltip, Dropdown, Button } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import './CalendarDaysView.css';

const { TextArea } = Input;
const { Option } = Select;

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

const CalendarDaysView = ({ groupData, schedules = [], onUpdate }) => {
  // 管理可用的资源卡片
  const [availableResources, setAvailableResources] = useState(presetResourcesData);
  const [activities, setActivities] = useState(schedules);
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
  const calendarRef = useRef(null);
  const dragPreviewRef = useRef(null);

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

  // 生成时间槽（6:00-20:00，每1小时） - 优化范围完全适应屏幕
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
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
    const totalMinutes = (hour - 6) * 60 + minute;  // 从6点开始
    return Math.floor(totalMinutes / 60) + 2; // +2 因为第一行是header，每小时一格
  };

  // 网格位置转换为时间
  const gridRowToTime = (row) => {
    const totalMinutes = (row - 2) * 60; // -2 因为第一行是header，每小时一格
    const hour = Math.floor(totalMinutes / 60) + 6;  // 从6点开始
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
      location: activity.location,
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

  // 拖拽悬停
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedResource ? 'copy' : 'move';

    // 如果是资源卡片拖拽，简单处理
    if (draggedResource) {
      return;
    }

    if (!draggedActivity) return;

    // 计算并显示放置指示器
    const calendarGrid = calendarRef.current?.querySelector('.calendar-grid');
    const scrollWrapper = calendarRef.current?.querySelector('.calendar-scroll-wrapper');

    if (!calendarGrid || !scrollWrapper) return;

    const wrapperRect = scrollWrapper.getBoundingClientRect();
    const scrollTop = scrollWrapper.scrollTop;

    // 使用滚动容器作为参考点
    const mouseY = e.clientY - wrapperRect.top + scrollTop;

    // 使用拖拽偏移计算活动上沿位置
    const activityTopY = mouseY - dragOffsetRef.current.y;

    // 计算目标时间槽
    const headerHeight = 30;
    const slotHeight = 40;
    const adjustedY = activityTopY - headerHeight;

    // 使用与handleDrop相同的逻辑
    let targetSlotIndex;
    if (adjustedY < 0) {
      targetSlotIndex = 0;
    } else {
      targetSlotIndex = Math.round(adjustedY / slotHeight);
    }

    // 计算持续时间
    const originalStart = timeToGridRow(draggedActivity.startTime);
    const originalEnd = timeToGridRow(draggedActivity.endTime);
    const duration = originalEnd - originalStart;

    // 限制索引范围（与handleDrop保持一致）
    const maxStartIndex = Math.max(0, timeSlots.length - duration);
    const constrainedIndex = Math.max(0, Math.min(maxStartIndex, targetSlotIndex));

    // 获取当前悬停的列（日期）
    const targetElement = e.target.closest('.time-slot');
    if (targetElement) {
      const dateStr = targetElement.dataset.date;
      const dayIndex = days.findIndex(d => d.dateStr === dateStr);

      if (dayIndex !== -1) {
        // 设置指示器位置
        setDropIndicator({
          dayIndex,
          slotIndex: constrainedIndex,
          duration,
          time: timeSlots[constrainedIndex]
        });

        // 调试：确保标尺线位置正确
        console.log('📏 标尺线位置:', {
          '活动上沿Y': activityTopY,
          '调整后Y': adjustedY,
          '目标索引': targetSlotIndex,
          '约束后索引': constrainedIndex,
          '对应时间': timeSlots[constrainedIndex],
          'Grid行': constrainedIndex + 2
        });
      }
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
      const startHour = parseInt(targetTime.split(':')[0]);
      const endHour = Math.min(20, startHour + Math.ceil(draggedResource.duration));
      const newActivity = {
        id: Date.now(),
        groupId: groupData.id,
        date: targetDate,
        startTime: targetTime,
        endTime: `${endHour.toString().padStart(2, '0')}:00`,
        type: draggedResource.type,
        title: draggedResource.title,
        location: '',
        description: draggedResource.description,
        color: activityTypes[draggedResource.type].color,
        resourceId: draggedResource.id,  // 记录资源ID
        isFromResource: true  // 标记来自资源
      };

      const updatedActivities = [...activities, newActivity];
      setActivities(updatedActivities);
      onUpdate(updatedActivities);

      // 如果是单一活动，从资源列表中移除
      if (draggedResource.isUnique) {
        setAvailableResources(prev => prev.filter(r => r.id !== draggedResource.id));
      }

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
    const headerHeight = 30;
    const slotHeight = 40;

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
    const maxStartIndex = Math.max(0, timeSlots.length - duration);
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
      const headerHeight = 30;
      const rowHeight = 40;

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
      const activityData = {
        id: editingActivity?.id || Date.now(),
        groupId: groupData.id,
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.startTime.format('HH:mm'),
        endTime: values.endTime.format('HH:mm'),
        type: values.type,
        title: values.title || '', // 允许为空
        location: values.location || '',
        description: values.description || '',
        color: activityTypes[values.type].color
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
    const type = activityTypes[activity.type];
    const isDragged = draggedActivity?.id === activity.id;

    // 计算活动的网格位置和大小
    const startRow = timeToGridRow(activity.startTime);
    const endRow = timeToGridRow(activity.endTime);

    const style = {
      gridColumn: dayIndex + 2, // +2 因为第一列是时间标签
      gridRow: `${startRow} / ${endRow}`,
      zIndex: isDragged ? 1 : 20
    };

    return (
      <div
        key={activity.id}
        className={`calendar-activity ${activity.type} ${isDragged ? 'dragging' : ''}`}
        style={style}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, activity)}
        onDragEnd={handleDragEnd}
        onClick={(e) => handleActivityClick(e, activity)}
        onContextMenu={(e) => handleActivityContextMenu(e, activity)}
        title="右键编辑活动"
      >
        <div className="activity-content">
          <div className="activity-header">
            <span className="activity-icon">{type.icon}</span>
            <span className="activity-time">
              {activity.startTime}-{activity.endTime}
            </span>
          </div>
          <div className="activity-title">{activity.title || '未命名'}</div>
          {activity.location && (
            <div className="activity-location">
              <EnvironmentOutlined />
              <span>{activity.location}</span>
            </div>
          )}
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
        {timeSlots.map((time, timeIndex) => (
          <React.Fragment key={time}>
            {/* 时间标签 */}
            <div
              className="time-label"
              style={{
                gridColumn: 1,
                gridRow: timeIndex + 2
              }}
            >
              {time}
            </div>

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
                  height: '40px'
                }}
              />
            ))}
          </React.Fragment>
        ))}

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
          background: activityTypes[dragPreview.activity.type].color
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
    <div className="calendar-days-view calendar-fully-maximized" ref={calendarRef}>
      {/* 移除独立工具栏，集成到顶部 */}

      {/* 日历容器 */}
      <div className="calendar-container">
        <div className="calendar-scroll-wrapper">
          <div
            className={`calendar-grid ${isDragging ? 'dragging-active' : ''}`}
            style={{
              gridTemplateColumns: `60px repeat(${days.length}, 1fr)`,
              gridTemplateRows: `30px repeat(${timeSlots.length}, minmax(30px, 1fr))`  // 自适应高度，最小30px
            }}
          >
            {renderGridContent()}
          </div>
        </div>
      </div>

      {/* 行程资源卡片区域 */}
      <div className="resource-cards-container"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          // 处理从日历拖回的活动
          if (draggedActivity && draggedActivity.isFromResource) {
            // 如果是单一活动，恢复到资源列表
            const resourceData = presetResourcesData.find(r => r.id === draggedActivity.resourceId);
            if (resourceData && resourceData.isUnique) {
              setAvailableResources(prev => {
                if (!prev.find(r => r.id === resourceData.id)) {
                  return [...prev, resourceData].sort((a, b) => {
                    // 保持原有顺序
                    const aIndex = presetResourcesData.findIndex(r => r.id === a.id);
                    const bIndex = presetResourcesData.findIndex(r => r.id === b.id);
                    return aIndex - bIndex;
                  });
                }
                return prev;
              });

              // 从活动列表中移除
              const updatedActivities = activities.filter(a => a.id !== draggedActivity.id);
              setActivities(updatedActivities);
              onUpdate(updatedActivities);

              message.success(`已将 ${draggedActivity.title} 返回资源区`, 1);
            }
          }

          // 清除所有拖拽状态
          setDraggedActivity(null);
          setDraggedResource(null);
          // dragGhost已移除
          setDropIndicator(null);
          setIsDragging(false);
          setReturningActivity(null);
          // 清除拖拽偏移
          dragOffsetRef.current = { x: 0, y: 0 };
        }}
      >
        <div className="resource-header">
          <span className="resource-title">行程资源</span>
          <span className="resource-hint">拖拽卡片到日历中创建活动</span>
        </div>

        {/* 可重复活动区域 */}
        <div className="resource-section">
          <div className="section-label">可重复活动</div>
          <div className="resource-cards">
            {availableResources.filter(r => !r.isUnique).map(resource => (
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
                <div className="resource-icon">{resource.icon}</div>
                <div className="resource-info">
                  <div className="resource-name">{resource.title}</div>
                  <div className="resource-duration">{resource.duration}小时</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 单一活动区域 */}
        <div className="resource-section">
          <div className="section-label">单一活动（仅使用一次）</div>
          <div className="resource-cards">
            {availableResources.filter(r => r.isUnique).map(resource => (
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
                <div className="resource-icon">{resource.icon}</div>
                <div className="resource-info">
                  <div className="resource-name">
                    {resource.title}
                    <span className="unique-badge">1</span>
                  </div>
                  <div className="resource-duration">{resource.duration}小时</div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
              <TimePicker format="HH:mm" placeholder="开始时间" />
            </Form.Item>
            <span style={{ display: 'inline-block', width: '24px', textAlign: 'center' }}>-</span>
            <Form.Item
              name="endTime"
              style={{ display: 'inline-block', width: 'calc(50% - 12px)' }}
              rules={[{ required: true, message: '请选择结束时间' }]}
            >
              <TimePicker format="HH:mm" placeholder="结束时间" />
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
    </div>
  );
};

export default CalendarDaysView;