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

const CalendarDaysView = ({ groupData, schedules = [], onUpdate }) => {
  const [activities, setActivities] = useState(schedules);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [draggedActivity, setDraggedActivity] = useState(null);
  const [resizingActivity, setResizingActivity] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [form] = Form.useForm();
  const calendarRef = useRef(null);
  const dragPreviewRef = useRef(null);

  // 活动类型配置
  const activityTypes = {
    meal: { label: '餐饮', color: '#52c41a', icon: '🍽️' },
    visit: { label: '参观', color: '#1890ff', icon: '🏛️' },
    transport: { label: '交通', color: '#fa8c16', icon: '🚌' },
    rest: { label: '休息', color: '#8c8c8c', icon: '🏨' },
    activity: { label: '活动', color: '#722ed1', icon: '🎯' },
    free: { label: '自由活动', color: '#13c2c2', icon: '🚶' }
  };

  // 生成时间槽（6:00-23:00，每30分钟）
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 23) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
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
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      days.push({
        date: new Date(d),
        dateStr: d.toISOString().split('T')[0],
        dayName: dayNames[d.getDay()],
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
    const totalMinutes = (hour - 6) * 60 + minute;
    return Math.floor(totalMinutes / 30) + 2; // +2 因为第一行是header
  };

  // 网格位置转换为时间
  const gridRowToTime = (row) => {
    const totalMinutes = (row - 2) * 30; // -2 因为第一行是header
    const hour = Math.floor(totalMinutes / 60) + 6;
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

  // 处理活动点击 - 编辑
  const handleActivityClick = (e, activity) => {
    e.stopPropagation();
    if (isDragging || isResizing) return;

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

    // 设置拖拽数据
    e.dataTransfer.setData('application/json', JSON.stringify(activity));
    e.dataTransfer.effectAllowed = 'move';
  };

  // 拖拽结束
  const handleDragEnd = (e) => {
    console.log('拖拽结束');
    setDraggedActivity(null);
    setIsDragging(false);
  };

  // 拖拽悬停
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // 拖拽进入
  const handleDragEnter = (e) => {
    e.preventDefault();
  };

  // 拖拽离开
  const handleDragLeave = (e) => {
    e.preventDefault();
  };

  // 拖拽放置
  const handleDrop = (e, targetDate, targetTime) => {
    e.preventDefault();
    console.log('拖拽放置到:', targetDate, targetTime);

    if (!draggedActivity) {
      console.log('没有被拖拽的活动');
      return;
    }

    // 计算原始持续时间
    const originalStart = timeToGridRow(draggedActivity.startTime);
    const originalEnd = timeToGridRow(draggedActivity.endTime);
    const duration = originalEnd - originalStart;

    // 计算新的结束时间
    const newStartRow = timeToGridRow(targetTime);
    const newEndTime = gridRowToTime(newStartRow + duration);

    console.log('更新活动时间:', targetTime, '->', newEndTime);

    // 更新活动
    const updatedActivities = activities.map(activity =>
      activity.id === draggedActivity.id
        ? {
            ...activity,
            date: targetDate,
            startTime: targetTime,
            endTime: newEndTime
          }
        : activity
    );

    setActivities(updatedActivities);
    onUpdate(updatedActivities);
    message.success('活动时间已更新');
  };

  // 时间调整开始
  const handleResizeStart = (e, activity) => {
    e.stopPropagation();
    setResizingActivity(activity);
    setIsResizing(true);

    const handleMouseMove = (moveEvent) => {
      const calendarRect = calendarRef.current.getBoundingClientRect();
      const relativeY = moveEvent.clientY - calendarRect.top;
      const scrollTop = calendarRef.current.querySelector('.calendar-scroll-wrapper').scrollTop;

      // 计算新的结束时间（30分钟精度，对应时间槽）
      const totalY = relativeY + scrollTop;
      const rowHeight = 40; // 每个时间槽的高度
      const newRow = Math.round(totalY / rowHeight) + 2; // +2 因为前面有header
      const startRow = timeToGridRow(activity.startTime);

      if (newRow > startRow) {
        const newEndTime = gridRowToTime(newRow);

        // 实时更新活动时长，无需确认
        setActivities(prev => prev.map(act =>
          act.id === activity.id
            ? { ...act, endTime: newEndTime }
            : act
        ));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizingActivity(null);

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // 直接保存，无需确认对话框
      onUpdate(activities);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
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
      onUpdate(updatedActivities);
      setModalVisible(false);
      message.success(editingActivity ? '活动已更新' : '活动已创建');
    } catch (error) {
      console.error('保存活动失败:', error);
    }
  };

  // 删除活动
  const handleDeleteActivity = (activityId) => {
    const updatedActivities = activities.filter(activity => activity.id !== activityId);
    setActivities(updatedActivities);
    onUpdate(updatedActivities);
    message.success('活动已删除');
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
        />
      </div>
    );
  };

  // 渲染网格内容
  const renderGridContent = () => {
    const dayGroups = detectOverlaps(activities);

    return (
      <>
        {/* 角落单元格 */}
        <div className="corner-cell">时间</div>

        {/* 日期头部 */}
        {days.map((day, dayIndex) => (
          <div
            key={day.dateStr}
            className={`date-header ${day.isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''}`}
            style={{
              gridColumn: dayIndex + 2,
              gridRow: 1
            }}
          >
            <div className="date-number">{day.month}月{day.day}日</div>
            <div className="day-name">{day.dayName}</div>
            {day.isToday && <div className="today-indicator">今日</div>}
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
    <div className="calendar-days-view" ref={calendarRef}>
      {/* 工具栏 */}
      <div className="calendar-toolbar">
        <div className="calendar-info">
          📅 {groupData.name} | {days.length}天行程 | {activities.length}个活动
        </div>
        <div className="toolbar-actions">
          <Button size="small" icon={<PlusOutlined />}>
            快速添加
          </Button>
        </div>
      </div>

      {/* 日历容器 */}
      <div className="calendar-container">
        <div className="calendar-scroll-wrapper">
          <div
            className="calendar-grid"
            style={{
              gridTemplateColumns: `80px repeat(${days.length}, 1fr)`,
              gridTemplateRows: `60px repeat(${timeSlots.length}, 40px)`
            }}
          >
            {renderGridContent()}
          </div>
        </div>
      </div>

      {/* 拖拽预览 - 暂时禁用，使用浏览器原生拖拽 */}
      {/* <DragPreview /> */}

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