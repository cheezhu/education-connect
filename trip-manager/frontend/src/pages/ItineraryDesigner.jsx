import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Select, InputNumber, Input, message, Checkbox, Tooltip, Badge, DatePicker, Drawer } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LeftOutlined,
  RightOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  SettingOutlined,
  ExportOutlined,
  DragOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';
import useDataSync from '../hooks/useDataSync';
import './ItineraryDesigner.css';

const { Option } = Select;

function ItineraryDesigner() {
  const timeSlotKeys = ['MORNING', 'AFTERNOON', 'EVENING'];
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

  const [groups, setGroups] = useState([]);
  const [activities, setActivities] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [weekStartDate, setWeekStartDate] = useState(() => getStoredWeekStartDate());
  const [groupPanelVisible, setGroupPanelVisible] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [enabledTimeSlots, setEnabledTimeSlots] = useState(() => getStoredTimeSlots());
  const [showDailyFocus, setShowDailyFocus] = useState(() => getStoredDailyFocus());
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [draggedActivity, setDraggedActivity] = useState(null);
  const cardStyle = 'minimal';
  const [batchMode, setBatchMode] = useState(false); // 批量选择模式
  const [selectedActivities, setSelectedActivities] = useState([]); // 选中的活动
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [planningExportVisible, setPlanningExportVisible] = useState(false);
  const [planningExportLoading, setPlanningExportLoading] = useState(false);
  const [form] = Form.useForm();
  const [aiForm] = Form.useForm();
  const [planningForm] = Form.useForm();
  const planningDateRange = Form.useWatch('dateRange', planningForm);
  const { registerRefreshCallback } = useDataSync();

  // 时间段定义
  const timeSlots = [
    { key: 'MORNING', label: '上午', time: '9:00-12:00', color: '#e6f7ff', borderColor: '#1890ff' },
    { key: 'AFTERNOON', label: '下午', time: '14:00-17:00', color: '#f6ffed', borderColor: '#52c41a' },
    { key: 'EVENING', label: '晚上', time: '19:00-21:00', color: '#fff2e8', borderColor: '#fa8c16' }
  ];

  const visibleTimeSlots = timeSlots.filter((slot) => enabledTimeSlots.includes(slot.key));
  const planningAvailableGroups = (planningDateRange && planningDateRange.length === 2)
    ? filterGroupsByRange(planningDateRange)
    : [];

  // 加载数据
  const loadData = async (preserveSelection = false) => {
    setLoading(true);
    try {
      const [groupsRes, activitiesRes, locationsRes] = await Promise.all([
        api.get('/groups'),
        api.get('/activities/raw'),
        api.get('/locations')
      ]);
      setGroups(groupsRes.data);
      setActivities(activitiesRes.data);
      setLocations(locationsRes.data);

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

  const handleTimeSlotToggle = (slots) => {
    const normalized = timeSlotKeys.filter((key) => slots.includes(key));
    persistTimeSlotConfig(normalized);
  };

  const handleDailyFocusToggle = (event) => {
    persistDailyFocusConfig(event.target.checked);
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
    const unregister = registerRefreshCallback(refreshData);
    return unregister;
  }, [registerRefreshCallback]);

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

  // 生成日期范围（7天一页）
  const generateDateRange = (startDate) => {
    const baseDate = startDate ? dayjs(startDate) : dayjs();
    return Array.from({ length: 7 }, (_, index) => (
      baseDate.add(index, 'day').toDate()
    ));
  };

  const dateRange = generateDateRange(weekStartDate);

  // 格式化日期
  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTimeSlotLabel = (slotKey) => {
    return timeSlots.find(slot => slot.key === slotKey)?.label || slotKey;
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
      const locationId = activity.locationId ?? 'none';
      const current = totals.get(locationId) || 0;
      totals.set(locationId, current + (activity.participantCount || 0));
    });

    return Array.from(totals.entries())
      .map(([locationId, total]) => {
        const location = locations.find(loc => loc.id === locationId);
        return {
          locationId,
          total,
          name: location ? location.name : '未设置场地'
        };
      })
      .sort((a, b) => b.total - a.total);
  };

  const openAiModal = () => {
    setAiPreview(null);
    setAiModalVisible(true);
    aiForm.setFieldsValue({
      groupIds: selectedGroups.length ? selectedGroups : groups.map(group => group.id),
      planNamePrefix: 'AI方案',
      replaceExisting: true,
      useAI: true,
      dateRange: [dayjs(dateRange[0]), dayjs(dateRange[6])]
    });
  };

  const buildAiPayload = (values, dryRun) => {
    const slotKeys = visibleTimeSlots.map(slot => slot.key);
    const [start, end] = values.dateRange || [];
    return {
      groupIds: values.groupIds,
      startDate: start ? start.format('YYYY-MM-DD') : formatDateString(dateRange[0]),
      endDate: end ? end.format('YYYY-MM-DD') : formatDateString(dateRange[6]),
      timeSlots: slotKeys,
      planNamePrefix: values.planNamePrefix || 'AI方案',
      replaceExisting: values.replaceExisting !== false,
      useAI: values.useAI !== false,
      dryRun
    };
  };

  const handleAiPreview = async () => {
    try {
      const values = await aiForm.validateFields();
      setAiLoading(true);
      const response = await api.post('/ai/plan/global', buildAiPayload(values, true));
      setAiPreview(response.data);
    } catch (error) {
      message.error('AI 预览失败');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiApply = async () => {
    try {
      const values = await aiForm.validateFields();
      setAiLoading(true);
      const response = await api.post('/ai/plan/global', buildAiPayload(values, false));
      message.success(`AI 生成完成：${response.data?.summary?.assignments || 0} 条安排`);
      setAiModalVisible(false);
      setAiPreview(null);
      refreshData();
    } catch (error) {
      message.error('AI 生成失败');
    } finally {
      setAiLoading(false);
    }
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

  const getFilenameFromDisposition = (disposition) => {
    if (!disposition) return null;
    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    if (utf8Match && utf8Match[1]) {
      return decodeURIComponent(utf8Match[1]);
    }
    const match = /filename=\"?([^\";]+)\"?/i.exec(disposition);
    return match ? match[1] : null;
  };

  const triggerDownload = (blob, filename) => {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePlanningExport = async () => {
    try {
      const values = await planningForm.validateFields();
      setPlanningExportLoading(true);
      const response = await api.post('/planning/export', buildPlanningPayload(values), {
        responseType: 'blob'
      });
      const disposition = response.headers?.['content-disposition'];
      const filename = getFilenameFromDisposition(disposition)
        || `planning_input_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.json`;
      const blob = new Blob([response.data], { type: 'application/json' });
      triggerDownload(blob, filename);
      message.success('导出成功');
      setPlanningExportVisible(false);
    } catch (error) {
      message.error('导出失败');
    } finally {
      setPlanningExportLoading(false);
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
                  <div style={{ fontSize: '10px', color: '#666' }}>
                    📅 {dayjs(group.start_date).format('MM-DD')} ~ {dayjs(group.end_date).format('MM-DD')}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666' }}>
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
    <div style={{
      background: '#fafafa',
      padding: '8px 16px',
      borderBottom: '1px solid #e8e8e8',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexShrink: 0,
      height: '56px'
    }}>
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
          icon={<SettingOutlined />}
          size="small"
          onClick={openAiModal}
        >
          AI 多团组生成
        </Button>
        <Button
          icon={<ExportOutlined />}
          size="small"
          onClick={openPlanningExportModal}
        >
          导出排程输入包(JSON)
        </Button>
        <Button
          icon={<ExportOutlined />}
          size="small"
          onClick={() => exportData()}
        >
          导出
        </Button>
      </div>
    </div>
  );

  // 时间轴网格
  const renderTimelineGrid = () => (
    <div className="timeline-grid">
      {/* 表头 */}
      <div className="timeline-header">
        <div className="time-label-cell">时间段</div>
        {dateRange.map((date, index) => (
          <div key={index} className="date-header-cell">
            <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 'bold' }}>
                {dayjs(date).format('MM-DD')}
              </span>
              <span style={{ fontSize: '12px', color: '#666' }}>
                {dayjs(date).format('ddd')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 表格主体 */}
      {visibleTimeSlots.map(timeSlot => (
        <div key={timeSlot.key} className="timeline-row">
          <div
            className="time-label-cell"
            style={{
              backgroundColor: timeSlot.color,
              borderLeft: `4px solid ${timeSlot.borderColor}`
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold' }}>{timeSlot.label}</div>
              <div style={{ fontSize: '10px' }}>{timeSlot.time}</div>
            </div>
          </div>

          {(() => {
            const groupNamesForSlot = new Set();
            dateRange.forEach((date) => {
              const slotActivities = getActivitiesForSlot(date, timeSlot.key);
              slotActivities.forEach((activity) => {
                const group = groups.find(g => g.id === activity.groupId);
                const groupName = group?.name || '未命名团组';
                groupNamesForSlot.add(groupName);
              });
            });
            const orderedGroupNames = Array.from(groupNamesForSlot).sort((a, b) => a.localeCompare(b, 'zh'));

            return dateRange.map((date, dateIndex) => {
              const slotActivities = getActivitiesForSlot(date, timeSlot.key);
              const groupedByName = slotActivities.reduce((acc, activity) => {
                const group = groups.find(g => g.id === activity.groupId);
                const groupName = group?.name || '未命名团组';
                if (!acc.has(groupName)) {
                  acc.set(groupName, []);
                }
                acc.get(groupName).push({ activity, group });
                return acc;
              }, new Map());

              return (
                <div
                  key={`${timeSlot.key}-${dateIndex}`}
                  className="timeline-cell"
                  style={{ backgroundColor: timeSlot.color }}
                  onClick={() => handleCellClick(date, timeSlot.key, slotActivities)}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, date, timeSlot.key)}
                >
                  {orderedGroupNames.length === 0 ? (
                    <div className="empty-cell">
                      <PlusOutlined style={{ color: '#999' }} />
                      <div style={{ fontSize: '10px', color: '#999' }}>点击添加</div>
                    </div>
                  ) : (
                    <div className="activity-summary grouped">
                      {orderedGroupNames.map((groupName) => {
                        const items = groupedByName.get(groupName) || [];
                        return (
                          <div
                            key={groupName}
                            className={`activity-group-row ${items.length ? '' : 'empty'}`}
                          >
                            {items.map(({ activity, group }) => {
                              const isCompact = items.length > 1;
                              const location = locations.find(l => l.id === activity.locationId);
                              const isSelected = selectedActivities.includes(activity.id);

                              return (
                                <div
                                  key={activity.id}
                                  draggable={!batchMode}
                                  onDragStart={(e) => !batchMode && handleDragStart(e, activity)}
                                  onDragEnd={!batchMode && handleDragEnd}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (batchMode) {
                                      if (isSelected) {
                                        setSelectedActivities(prev => prev.filter(id => id !== activity.id));
                                      } else {
                                        setSelectedActivities(prev => [...prev, activity.id]);
                                      }
                                    } else {
                                      handleCellClick(date, timeSlot.key, [activity]);
                                    }
                                  }}
                                  style={{
                                    opacity: batchMode && !isSelected ? 0.6 : 1,
                                    outline: isSelected ? '2px solid #1890ff' : 'none',
                                    borderRadius: '4px'
                                  }}
                                  title={`${group?.name}${location ? ` - ${location.name}` : ''} (${activity.participantCount}人)`}
                                >
                                  {renderActivityCard(activity, group, location, isCompact)}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      ))}

      {showDailyFocus && (
        <div
          className="daily-focus-row"
          style={{ gridTemplateColumns: `100px repeat(${dateRange.length}, minmax(0, 1fr))` }}
        >
          <div className="daily-focus-label-cell">
            <div className="daily-focus-title">每日关注</div>
          </div>
          {dateRange.map((date) => {
            const dateString = formatDateString(date);
            const arrivals = getArrivalsForDate(dateString);
            const departures = getDeparturesForDate(dateString);

            return (
              <div key={dateString} className="daily-focus-cell">
                <div className="daily-focus-section">
                  <div className="daily-focus-item">
                    {arrivals.length
                      ? arrivals.map(group => `${group.name}团组抵达`).join('，')
                      : '暂无团组抵达'}
                  </div>
                  <div className="daily-focus-item">
                    {departures.length
                      ? departures.map(group => `${group.name}团组结束`).join('，')
                      : '暂无团组结束'}
                  </div>
                </div>

                {visibleTimeSlots.map((slot) => {
                  const totals = getLocationTotalsForDate(dateString, slot.key);
                  return (
                    <div key={`${dateString}-${slot.key}`} className="daily-focus-section">
                      <div className="daily-focus-section-title">{slot.label}</div>
                      {totals.length ? (
                        totals.map(item => (
                          <div key={`${item.locationId}-${slot.key}`} className="daily-focus-item">
                            {item.name} {item.total}人
                          </div>
                        ))
                      ) : (
                        <div className="daily-focus-item">暂无安排</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // 渲染活动卡片 - 根据不同样式
  const renderActivityCard = (activity, group, location, compact = false) => {
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
            border: `1.5px solid ${group?.color}`,
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
          <span style={{ fontWeight: '600', color: '#333' }}>{group?.name}</span>
          {location && <span style={{ opacity: 0.7, fontSize: '10px', color: '#666' }}> @{location.name}</span>}

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
              color: '#999',
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
              borderLeft: `3px solid ${group?.color}`,
              marginBottom: '4px',
              cursor: 'grab',
              backgroundColor: 'rgba(255,255,255,0.5)',
              padding: '2px 8px',
              borderRadius: '0 4px 4px 0',
              position: 'relative'
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleCellClick(null, null, [activity]);
            }}
          >
            <div className="activity-card-line activity-card-group">{group?.name}</div>
            {location && (
              <div className="activity-card-line activity-card-location">{location.name}</div>
            )}
            <span
              className="minimal-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteActivity(activity.id);
              }}
              style={{
                padding: '0 4px',
                color: '#999',
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
            borderLeft: `3px solid ${group?.color}`,
            marginBottom: '4px',
            fontSize: '11px',
            cursor: 'grab',
            backgroundColor: 'rgba(255,255,255,0.5)',
            padding: '2px 8px',
            borderRadius: '0 4px 4px 0',
            position: 'relative'
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleCellClick(null, null, [activity]);
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: '500', lineHeight: '16px', color: '#333' }}>{group?.name}</div>
            <span
              className="minimal-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteActivity(activity.id);
              }}
              style={{
                padding: '0 4px',
                color: '#999',
                fontSize: '10px',
                display: 'none',
                cursor: 'pointer'
              }}
            >
              ×
            </span>
          </div>
          {location && <div style={{ fontSize: '10px', color: '#666', lineHeight: '14px' }}>{location.name}</div>}
        </div>
      );
    }

    return null;
  };

  // 点击时间格子
  const handleCellClick = (date, timeSlot, activities) => {
    setSelectedTimeSlot({
      date: formatDateString(date),
      timeSlot,
      activities
    });
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
    if (e.target.classList.contains('timeline-cell')) {
      e.target.classList.add('drag-over');
    }
  };

  // 拖拽离开
  const handleDragLeave = (e) => {
    if (e.target.classList.contains('timeline-cell')) {
      e.target.classList.remove('drag-over');
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

  // 放置
  const handleDrop = async (e, targetDate, targetTimeSlot) => {
    e.preventDefault();
    e.target.classList.remove('drag-over');

    if (!draggedActivity) return;

    const targetDateString = formatDateString(targetDate);

    // 检查是否移动到相同位置
    if (draggedActivity.date === targetDateString && draggedActivity.timeSlot === targetTimeSlot) {
      return;
    }

    // 检查冲突
    const conflicts = checkConflicts(
      draggedActivity.id,
      draggedActivity.groupId,
      draggedActivity.locationId,
      targetDateString,
      targetTimeSlot,
      draggedActivity.participantCount
    );

    try {
      await handleUpdateActivity(draggedActivity.id, {
        date: targetDateString,
        timeSlot: targetTimeSlot
      });

      message.success('活动时间调整成功');
    } catch (error) {
      message.error('调整活动时间失败');
    }
  };

  return (
    <div className="itinerary-designer">
      {renderTimelineHeader()}

      <div style={{ display: 'flex', height: 'calc(100vh - 56px)', flex: 1 }}>
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

      {/* 详情编辑弹窗 */}
      <Modal
        title={`编辑行程 - ${selectedTimeSlot?.date} ${timeSlots.find(t => t.key === selectedTimeSlot?.timeSlot)?.label}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={null}
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
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
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

      <Modal
        title="导出排程输入包(JSON)"
        open={planningExportVisible}
        onCancel={() => setPlanningExportVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setPlanningExportVisible(false)}>
            取消
          </Button>,
          <Button
            key="export"
            type="primary"
            onClick={handlePlanningExport}
            loading={planningExportLoading}
          >
            导出
          </Button>
        ]}
        destroyOnClose
      >
        <Form form={planningForm} layout="vertical">
          <Form.Item
            name="dateRange"
            label="日期范围"
            rules={[{ required: true, message: '请选择日期范围' }]}
          >
            <DatePicker.RangePicker />
          </Form.Item>

          <Form.Item
            name="groupIds"
            label="选择团组"
            rules={[{ required: true, message: '请选择团组' }]}
          >
            <Select
              mode="multiple"
              placeholder={planningAvailableGroups.length ? '选择需要导出的团组' : '请先选择日期范围'}
              disabled={!planningDateRange || planningDateRange.length !== 2}
              dropdownRender={(menu) => (
                <>
                  <div style={{ padding: '8px', display: 'flex', gap: '8px' }}>
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        planningForm.setFieldsValue({
                          groupIds: planningAvailableGroups.map(group => group.id)
                        });
                      }}
                      disabled={planningAvailableGroups.length === 0}
                    >
                      全选
                    </Button>
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        planningForm.setFieldsValue({ groupIds: [] });
                      }}
                    >
                      全不选
                    </Button>
                  </div>
                  {menu}
                </>
              )}
            >
              {planningAvailableGroups.map(group => (
                <Option key={group.id} value={group.id}>
                  {group.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="AI 多团组生成"
        open={aiModalVisible}
        onCancel={() => {
          setAiModalVisible(false);
          setAiPreview(null);
        }}
        width={720}
        footer={[
          <Button key="preview" onClick={handleAiPreview} loading={aiLoading}>
            预览
          </Button>,
          <Button key="apply" type="primary" onClick={handleAiApply} loading={aiLoading}>
            生成并保存
          </Button>
        ]}
        destroyOnClose
      >
        <Form form={aiForm} layout="vertical">
          <Form.Item
            name="groupIds"
            label="选择团组"
            rules={[{ required: true, message: '请选择团组' }]}
          >
            <Select mode="multiple" placeholder="选择需要生成的团组">
              {groups.map(group => (
                <Option key={group.id} value={group.id}>
                  {group.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="日期范围"
            rules={[{ required: true, message: '请选择日期范围' }]}
          >
            <DatePicker.RangePicker />
          </Form.Item>

          <Form.Item name="planNamePrefix" label="方案前缀">
            <Input placeholder="例如：AI方案" />
          </Form.Item>

          <Form.Item name="replaceExisting" valuePropName="checked">
            <Checkbox>覆盖该日期范围内已有安排</Checkbox>
          </Form.Item>

          <Form.Item name="useAI" valuePropName="checked">
            <Checkbox>使用AI排序偏好（需联网）</Checkbox>
          </Form.Item>
        </Form>

        {aiPreview ? (
          <div style={{ marginTop: 12, background: '#fafafa', padding: 12, borderRadius: 6 }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
              <span>团组数：{aiPreview.summary?.groups || 0}</span>
              <span>天数：{aiPreview.summary?.days || 0}</span>
              <span>安排数：{aiPreview.summary?.assignments || 0}</span>
              <span>冲突：{aiPreview.summary?.conflicts || 0}</span>
            </div>
            {aiPreview.conflicts?.length ? (
              <div style={{ maxHeight: 160, overflow: 'auto', fontSize: 12, color: '#d4380d' }}>
                {aiPreview.conflicts.slice(0, 20).map((item, index) => (
                  <div key={`${item.groupId}-${index}`}>
                    {item.groupName} · {item.date} · {getTimeSlotLabel(item.timeSlot)} · {item.reason}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#52c41a' }}>未发现冲突</div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default ItineraryDesigner;
