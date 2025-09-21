import React, { useState, useEffect } from 'react';
import { Card, Modal, Form, Select, InputNumber, message, Tag, Button } from 'antd';
import { PlusOutlined, LeftOutlined, RightOutlined, StepBackwardOutlined, StepForwardOutlined } from '@ant-design/icons';
import api from '../services/api';
import './DragDropTable.css';

const { Option } = Select;

function DragDropTable({ editMode, onRefresh }) {
  const [events, setEvents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [locations, setLocations] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentSlot, setCurrentSlot] = useState(null);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(0); // 当前周的偏移量
  const [currentDayOffset, setCurrentDayOffset] = useState(0); // 当前天的偏移量
  const [form] = Form.useForm();

  // 主题包相关状态
  const [currentThemePackage, setCurrentThemePackage] = useState(null);
  const [themePackageResources, setThemePackageResources] = useState([]);
  const [loadingThemePackage, setLoadingThemePackage] = useState(false);

  // 时间段定义
  const timeSlots = [
    { key: 'MORNING', label: '上午 (9:00-12:00)', color: '#e6f7ff', borderColor: '#1890ff' },
    { key: 'AFTERNOON', label: '下午 (14:00-17:00)', color: '#f6ffed', borderColor: '#52c41a' },
    { key: 'EVENING', label: '晚上 (19:00-21:00)', color: '#fff2e8', borderColor: '#fa8c16' }
  ];

  // 生成日期范围（7天一页，支持导航）
  const generateDateRange = (weekOffset = 0, dayOffset = 0) => {
    const dates = [];
    const today = new Date();
    const startOffset = weekOffset * 7 + dayOffset; // 加入天的偏移
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + startOffset + i);
      dates.push(date);
    }
    return dates;
  };

  const dateRange = generateDateRange(currentWeekStart, currentDayOffset);

  // 格式化日期为 YYYY-MM-DD 格式，避免时区问题
  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 加载数据
  const loadData = async () => {
    try {
      const [eventsRes, groupsRes, locationsRes] = await Promise.all([
        api.get('/activities'),
        api.get('/groups'),
        api.get('/locations')
      ]);

      // 为有主题包的团组加载资源信息
      const groupsWithResources = await Promise.all(
        groupsRes.data.map(async (group) => {
          if (group.themePackageId) {
            try {
              const themePackageRes = await api.get(`/theme-packages/${group.themePackageId}`);
              // 映射嵌套的资源结构
              const resources = themePackageRes.data.resources?.map(r => r.resource) || [];
              return {
                ...group,
                themePackageResources: resources
              };
            } catch (error) {
              console.warn(`Failed to load theme package ${group.themePackageId}:`, error);
              return { ...group, themePackageResources: [] };
            }
          }
          return { ...group, themePackageResources: [] };
        })
      );

      setEvents(eventsRes.data);
      setGroups(groupsWithResources);
      setLocations(locationsRes.data);
    } catch (error) {
      message.error('加载数据失败');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 当收到外部刷新信号时重新加载数据
  useEffect(() => {
    if (onRefresh) {
      loadData();
    }
  }, [onRefresh]);

  // 1. 页面刷新时读取主题包数据
  const loadThemePackageDataForActivity = async (groupId) => {
    if (!groupId) {
      setCurrentThemePackage(null);
      setThemePackageResources([]);
      return;
    }

    setLoadingThemePackage(true);
    try {
      // 获取团组信息
      const groupResponse = await api.get(`/groups/${groupId}`);
      const group = groupResponse.data;

      if (group.themePackageId) {
        // 获取主题包详细信息
        const themePackageResponse = await api.get(`/theme-packages/${group.themePackageId}`);
        const themePackage = themePackageResponse.data;

        setCurrentThemePackage(themePackage);
        setThemePackageResources(themePackage.resources || []);
      } else {
        setCurrentThemePackage(null);
        setThemePackageResources([]);
      }
    } catch (error) {
      console.error('加载主题包数据失败:', error);
      message.error('加载主题包数据失败');
      setCurrentThemePackage(null);
      setThemePackageResources([]);
    } finally {
      setLoadingThemePackage(false);
    }
  };

  // 获取指定日期和时间段的活动
  const getEventsForSlot = (date, timeSlot) => {
    const dateString = formatDateString(date);
    return events.filter(event => {
      const eventDate = event.start.split('T')[0]; // 直接从字符串获取日期部分
      return eventDate === dateString && event.extendedProps.timeSlot === timeSlot;
    });
  };

  // 处理拖拽开始
  const handleDragStart = (e, event) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', event.id);
    
    // 添加拖拽样式
    e.target.classList.add('dragging');
  };

  // 处理拖拽结束
  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    setDraggedEvent(null);
  };

  // 处理放置目标进入
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // 处理拖拽进入
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.target.closest('.table-cell').classList.add('drag-over');
  };

  // 处理拖拽离开
  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.target.closest('.table-cell').contains(e.relatedTarget)) {
      e.target.closest('.table-cell').classList.remove('drag-over');
    }
  };

  // 处理放置
  const handleDrop = async (e, targetDate, targetTimeSlot) => {
    e.preventDefault();
    
    const cell = e.target.closest('.table-cell');
    cell.classList.remove('drag-over');
    
    if (!draggedEvent) return;

    const newDate = formatDateString(targetDate);
    
    // 检查是否真的有变化
    const oldDate = draggedEvent.start.split('T')[0];
    const oldTimeSlot = draggedEvent.extendedProps.timeSlot;
    
    if (newDate === oldDate && targetTimeSlot === oldTimeSlot) {
      return;
    }

    try {
      await api.put(`/activities/${draggedEvent.id}`, {
        date: newDate,
        timeSlot: targetTimeSlot
      });
      
      message.success('教育资源已更新');
      await loadData(); // 确保数据同步更新
    } catch (error) {
      if (error.response?.data?.conflicts) {
        const conflicts = error.response.data.conflicts;
        Modal.error({
          title: '存在冲突',
          content: (
            <div>
              {conflicts.map((c, i) => (
                <p key={i}>{c.message}</p>
              ))}
            </div>
          )
        });
      } else {
        message.error('更新失败');
      }
    }
  };

  // 处理添加活动
  const handleAddActivity = (date, timeSlot) => {
    setCurrentSlot({
      date: formatDateString(date),
      timeSlot: timeSlot
    });
    setModalVisible(true);
  };

  // 创建或更新活动
  const handleCreateActivity = async (values) => {
    try {
      // 2. 保存更改时再次读取主题包数据
      await loadThemePackageDataForActivity(values.groupId);

      const activityData = {
        groupId: values.groupId,
        locationId: values.locationId || null,
        date: currentSlot.date,
        timeSlot: currentSlot.timeSlot,
        participantCount: values.participantCount
      };

      if (currentSlot.isEditing && currentSlot.eventId) {
        // 更新现有活动
        await api.put(`/activities/${currentSlot.eventId}`, activityData);
        message.success('教育资源更新成功');
      } else {
        // 创建新活动
        await api.post('/activities', activityData);
        message.success('教育资源创建成功');
      }

      setModalVisible(false);
      form.resetFields();
      // 清空主题包数据
      setCurrentThemePackage(null);
      setThemePackageResources([]);
      await loadData(); // 确保数据同步更新
    } catch (error) {
      console.error('保存活动失败:', error);
      if (error.response?.data?.conflicts) {
        const conflicts = error.response.data.conflicts;
        Modal.error({
          title: '存在冲突',
          content: (
            <div>
              {conflicts.map((c, i) => (
                <p key={i}>{c.message}</p>
              ))}
            </div>
          )
        });
      } else {
        message.error(currentSlot.isEditing ? '更新失败' : '创建失败');
      }
    }
  };

  // 处理活动点击
  const handleEventClick = async (event) => {
    const props = event.extendedProps;

    // 设置编辑模式的当前活动
    setCurrentSlot({
      eventId: event.id,
      date: new Date(event.start).toISOString().split('T')[0],
      timeSlot: props.timeSlot,
      isEditing: true
    });

    // 1. 页面刷新时读取主题包数据
    await loadThemePackageDataForActivity(props.groupId);

    // 预填表单数据
    form.setFieldsValue({
      groupId: props.groupId,
      locationId: props.locationId,
      participantCount: props.participantCount
    });

    setModalVisible(true);
  };

  const formatDate = (date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return '今天';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return '明天';
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  const getWeekDay = (date) => {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
  };

  // 导航方法
  const goToPrevious = () => {
    setCurrentWeekStart(prev => prev - 1);
  };

  const goToNext = () => {
    setCurrentWeekStart(prev => prev + 1);
  };

  const goToPreviousDay = () => {
    setCurrentDayOffset(prev => prev - 1);
  };

  const goToNextDay = () => {
    setCurrentDayOffset(prev => prev + 1);
  };

  const goToToday = () => {
    setCurrentWeekStart(0);
    setCurrentDayOffset(0);
  };

  // 获取当前显示的日期范围描述
  const getDateRangeDescription = () => {
    if (dateRange.length === 0) return '';
    const start = dateRange[0];
    const end = dateRange[dateRange.length - 1];
    return `${formatDateString(start)} 至 ${formatDateString(end)}`;
  };

  // 处理快速添加活动
  const handleQuickAddActivity = () => {
    // 设置为今天的上午时段
    const today = new Date();
    setCurrentSlot({
      date: formatDateString(today),
      timeSlot: 'MORNING'
    });
    setModalVisible(true);
  };

  return (
    <div>
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>行程安排表格</span>
            {/* 添加活动按钮 */}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleQuickAddActivity}
              size="small"
            >
              添加教育资源
            </Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* 单天导航 */}
              <Button 
                type="text" 
                icon={<StepBackwardOutlined />} 
                onClick={goToPreviousDay}
                size="small"
                title="前一天"
              />
              {/* 周导航 */}
              <Button 
                type="text" 
                icon={<LeftOutlined />} 
                onClick={goToPrevious}
                size="small"
                title="前一周"
              />
              <Button 
                type="link" 
                onClick={goToToday}
                size="small"
                style={{ padding: '0 8px', minWidth: '120px' }}
                title="回到今天"
              >
                {getDateRangeDescription()}
              </Button>
              <Button 
                type="text" 
                icon={<RightOutlined />} 
                onClick={goToNext}
                size="small"
                title="后一周"
              />
              {/* 单天导航 */}
              <Button 
                type="text" 
                icon={<StepForwardOutlined />} 
                onClick={goToNextDay}
                size="small"
                title="后一天"
              />
            </div>
          </div>
        }
        extra={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {editMode ? 
            <Tag color="green">编辑模式 - 可拖拽调整</Tag> : 
            <Tag>查看模式</Tag>}
          </div>
        }
      >
        <div className="drag-drop-table">
          {/* 表头 */}
          <div className="table-header">
            <div className="table-cell header-cell">时间段</div>
            {dateRange.map((date, index) => (
              <div key={index} className="table-cell header-cell">
                <div className="date-header-compact">
                  <span className="date-compact">{formatDate(date)}</span>
                  <span className="weekday-compact">{getWeekDay(date)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 表格主体 */}
          <div className="table-body">
            {timeSlots.map(timeSlot => (
              <div key={timeSlot.key} className="table-row">
                {/* 时间段标签 */}
                <div 
                  className="table-cell time-label-cell"
                  style={{ 
                    backgroundColor: timeSlot.color,
                    borderLeft: `4px solid ${timeSlot.borderColor}`
                  }}
                >
                  <span className="time-label">{timeSlot.label}</span>
                </div>
                
                {/* 日期格子 */}
                {dateRange.map((date, dateIndex) => {
                  const slotEvents = getEventsForSlot(date, timeSlot.key);
                  
                  return (
                    <div
                      key={`${timeSlot.key}-${dateIndex}`}
                      className="table-cell event-cell"
                      style={{ 
                        backgroundColor: timeSlot.color,
                        borderColor: timeSlot.borderColor
                      }}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, date, timeSlot.key)}
                    >
                      {/* 现有活动 */}
                      {slotEvents.map(event => (
                        <div
                          key={event.id}
                          className="event-item"
                          style={{ backgroundColor: event.backgroundColor }}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, event)}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleEventClick(event)}
                        >
                          <div className="event-title">
                            {(() => {
                              const props = event.extendedProps;
                              const group = groups.find(g => g.id === props.groupId);
                              const groupName = group?.name || '未知团组';

                              // 显示主题包资源信息（简化版：名称+时长）
                              if (group?.themePackageId && group?.themePackageResources && group.themePackageResources.length > 0) {
                                // 有主题包资源：显示资源名称和时长
                                const primaryResource = group.themePackageResources[0]; // 主要显示第一个资源
                                return (
                                  <>
                                    <div className="event-group">{groupName}</div>
                                    <div className="resource-title">📚 {primaryResource.name}</div>
                                    {primaryResource.duration && (
                                      <div className="resource-duration">⏰ {primaryResource.duration}小时</div>
                                    )}
                                    {group.themePackageResources.length > 1 && (
                                      <div className="more-resources">
                                        +{group.themePackageResources.length - 1}个资源
                                      </div>
                                    )}
                                  </>
                                );
                              } else {
                                // 无主题包资源：显示团组名称 + "暂无主题包"
                                return (
                                  <>
                                    <div className="event-group">{groupName}</div>
                                    <div className="event-location">暂无主题包资源</div>
                                  </>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      ))}
                      
                      {/* 添加按钮 - 始终显示，支持多个活动 */}
                      <div
                        className="add-event-btn"
                        onClick={() => handleAddActivity(date, timeSlot.key)}
                        title={slotEvents.length === 0 ? '添加教育资源' : '添加更多教育资源'}
                      >
                        <PlusOutlined />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 创建/编辑教育资源弹窗 */}
        <Modal
          title={currentSlot?.isEditing ? "编辑教育资源" : "创建教育资源"}
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            form.resetFields();
            // 清空主题包数据
            setCurrentThemePackage(null);
            setThemePackageResources([]);
          }}
          onOk={() => form.submit()}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreateActivity}
            initialValues={{
              participantCount: 44
            }}
          >
            <Form.Item
              name="groupId"
              label="选择团组"
              rules={[{ required: true, message: '请选择团组' }]}
            >
              <Select
                placeholder="请选择团组"
                onChange={(groupId) => {
                  // 当团组选择发生变化时，重新加载主题包数据
                  loadThemePackageDataForActivity(groupId);
                }}
              >
                {groups.map(g => (
                  <Option key={g.id} value={g.id}>
                    {g.name} ({g.type === 'primary' ? '小学' : '中学'})
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* 显示主题包资源信息（与卡片显示保持一致）*/}
            {currentThemePackage && (
              <div style={{
                background: '#f5f5f5',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '16px'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#1890ff'
                }}>
                  📦 主题包: {currentThemePackage.name}
                </div>
                {loadingThemePackage ? (
                  <div style={{ color: '#666', fontSize: '12px' }}>加载中...</div>
                ) : themePackageResources.length > 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {themePackageResources.map((resource, index) => (
                      <div key={index} style={{
                        background: '#e6f7ff',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #d6f2ff'
                      }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#1890ff',
                          marginBottom: '4px'
                        }}>
                          📚 {resource.name}
                        </div>
                        {resource.duration && (
                          <div style={{
                            fontSize: '12px',
                            color: '#666'
                          }}>
                            ⏰ {resource.duration}小时
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#999', fontSize: '12px' }}>暂无资源信息</div>
                )}
              </div>
            )}

            <Form.Item
              name="locationId"
              label="选择地点"
              rules={[{ required: true, message: '请选择地点' }]}
            >
              <Select placeholder="请选择地点">
                {locations.map(l => (
                  <Option key={l.id} value={l.id}>
                    {l.name} (容量: {l.capacity}人)
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="participantCount"
              label="参与人数"
              rules={[{ required: true, min: 1, type: 'number' }]}
            >
              <InputNumber min={1} max={500} style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
}

export default DragDropTable;