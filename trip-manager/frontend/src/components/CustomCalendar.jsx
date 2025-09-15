import React, { useState, useEffect, useRef } from 'react';
import { Card, Modal, Form, Select, InputNumber, message, Tooltip, Tag, Button } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import api from '../services/api';
import './CustomCalendar.css';

const { Option } = Select;

function CustomCalendar({ editMode, onRefresh }) {
  const [events, setEvents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [locations, setLocations] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [form] = Form.useForm();

  // 加载数据
  const loadData = async () => {
    try {
      const [eventsRes, groupsRes, locationsRes] = await Promise.all([
        api.get('/activities'),
        api.get('/groups'),
        api.get('/locations')
      ]);
      
      setEvents(eventsRes.data);
      setGroups(groupsRes.data);
      setLocations(locationsRes.data);
    } catch (error) {
      message.error('加载数据失败');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 生成日历网格
  const generateCalendarGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    const endDate = new Date(lastDay);

    // 找到周一作为起始日
    startDate.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));
    // 找到周日作为结束日
    endDate.setDate(lastDay.getDate() + (6 - ((lastDay.getDay() + 6) % 7)));

    const dates = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  // 获取指定日期的活动
  const getEventsForDate = (date) => {
    const dateString = date.toISOString().split('T')[0];
    return events.filter(event => {
      const eventDate = new Date(event.start).toISOString().split('T')[0];
      return eventDate === dateString;
    });
  };

  // 处理拖拽开始
  const handleDragStart = (e, event) => {
    if (!editMode) {
      e.preventDefault();
      return;
    }
    
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', event.id);
    
    // 添加拖拽样式
    e.target.style.opacity = '0.5';
  };

  // 处理拖拽结束
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedEvent(null);
  };

  // 处理放置目标进入
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // 处理放置
  const handleDrop = async (e, targetDate, targetTimeSlot) => {
    e.preventDefault();
    
    if (!draggedEvent || !editMode) return;

    const newDate = targetDate.toISOString().split('T')[0];
    
    // 检查是否真的有变化
    const oldDate = new Date(draggedEvent.start).toISOString().split('T')[0];
    const oldTimeSlot = draggedEvent.extendedProps.timeSlot;
    
    if (newDate === oldDate && targetTimeSlot === oldTimeSlot) {
      return;
    }

    try {
      await api.put(`/activities/${draggedEvent.id}`, {
        date: newDate,
        timeSlot: targetTimeSlot
      });
      
      message.success('活动已更新');
      loadData();
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

  // 处理日期点击
  const handleDateClick = (date, timeSlot) => {
    if (!editMode) {
      message.info('查看模式下不能创建活动');
      return;
    }

    setCurrentEvent({
      date: date.toISOString().split('T')[0],
      timeSlot: timeSlot
    });
    setModalVisible(true);
  };

  // 创建活动
  const handleCreateActivity = async (values) => {
    try {
      await api.post('/activities', {
        ...values,
        date: currentEvent.date,
        timeSlot: currentEvent.timeSlot
      });
      
      message.success('活动创建成功');
      setModalVisible(false);
      form.resetFields();
      loadData();
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
        message.error('创建失败');
      }
    }
  };

  // 处理活动点击
  const handleEventClick = (event) => {
    const props = event.extendedProps;
    const group = groups.find(g => g.id === props.groupId);
    const location = locations.find(l => l.id === props.locationId);
    
    Modal.info({
      title: event.title,
      content: (
        <div>
          <p>日期：{new Date(event.start).toLocaleDateString()}</p>
          <p>时间：{getTimeSlotLabel(props.timeSlot)}</p>
          <p>团组：{group?.name}</p>
          <p>地点：{location?.name}</p>
          <p>参与人数：{props.participantCount}人</p>
          <p>地点容量：{props.capacity}人</p>
        </div>
      ),
      okText: '关闭'
    });
  };

  // 导航到上个月
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // 导航到下个月
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // 辅助函数
  const getTimeSlotLabel = (slot) => {
    const labels = {
      'MORNING': '上午 (9:00-12:00)',
      'AFTERNOON': '下午 (14:00-17:00)',
      'EVENING': '晚上 (19:00-21:00)'
    };
    return labels[slot];
  };

  const getTimeSlotColor = (slot) => {
    const colors = {
      'MORNING': '#e6f7ff',
      'AFTERNOON': '#f6ffed',
      'EVENING': '#fff2e8'
    };
    return colors[slot];
  };

  const getTimeSlotBorderColor = (slot) => {
    const colors = {
      'MORNING': '#1890ff',
      'AFTERNOON': '#52c41a',
      'EVENING': '#fa8c16'
    };
    return colors[slot];
  };

  const dates = generateCalendarGrid();
  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];
  const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  return (
    <div>
      {/* 时间段说明 */}
      <Card size="small" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold' }}>时间段说明：</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#e6f7ff', border: '1px solid #1890ff' }}></div>
            <span>上午 (9:00-12:00)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#f6ffed', border: '1px solid #52c41a' }}></div>
            <span>下午 (14:00-17:00)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#fff2e8', border: '1px solid #fa8c16' }}></div>
            <span>晚上 (19:00-21:00)</span>
          </div>
        </div>
      </Card>

      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Button 
                type="text" 
                icon={<LeftOutlined />} 
                onClick={goToPreviousMonth}
              />
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                {currentDate.getFullYear()}年 {monthNames[currentDate.getMonth()]}
              </span>
              <Button 
                type="text" 
                icon={<RightOutlined />} 
                onClick={goToNextMonth}
              />
            </div>
            <div>
              {editMode ? 
                <Tag color="green">编辑模式 - 可拖拽调整</Tag> : 
                <Tag>查看模式</Tag>
              }
            </div>
          </div>
        }
      >
        {/* 自定义日历 */}
        <div className="custom-calendar">
          {/* 星期标题 */}
          <div className="calendar-header">
            {weekDays.map(day => (
              <div key={day} className="week-day-header">
                {day}
              </div>
            ))}
          </div>

          {/* 日历网格 */}
          <div className="calendar-grid">
            {dates.map((date, index) => {
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const dayEvents = getEventsForDate(date);
              const morningEvents = dayEvents.filter(e => e.extendedProps.timeSlot === 'MORNING');
              const afternoonEvents = dayEvents.filter(e => e.extendedProps.timeSlot === 'AFTERNOON');
              const eveningEvents = dayEvents.filter(e => e.extendedProps.timeSlot === 'EVENING');

              return (
                <div 
                  key={index} 
                  className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''}`}
                >
                  <div className="day-number">{date.getDate()}</div>
                  
                  {/* 上午时段 */}
                  <div 
                    className="time-slot morning-slot"
                    style={{ 
                      backgroundColor: getTimeSlotColor('MORNING'),
                      border: `1px dashed ${getTimeSlotBorderColor('MORNING')}`
                    }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, date, 'MORNING')}
                    onClick={() => handleDateClick(date, 'MORNING')}
                  >
                    <span className="slot-label">上午</span>
                    <div className="slot-events">
                      {morningEvents.map(event => (
                        <div
                          key={event.id}
                          className="event-item"
                          style={{ backgroundColor: event.backgroundColor }}
                          draggable={editMode}
                          onDragStart={(e) => handleDragStart(e, event)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEventClick(event);
                          }}
                        >
                          {event.title.split(' - ')[0]}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 下午时段 */}
                  <div 
                    className="time-slot afternoon-slot"
                    style={{ 
                      backgroundColor: getTimeSlotColor('AFTERNOON'),
                      border: `1px dashed ${getTimeSlotBorderColor('AFTERNOON')}`
                    }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, date, 'AFTERNOON')}
                    onClick={() => handleDateClick(date, 'AFTERNOON')}
                  >
                    <span className="slot-label">下午</span>
                    <div className="slot-events">
                      {afternoonEvents.map(event => (
                        <div
                          key={event.id}
                          className="event-item"
                          style={{ backgroundColor: event.backgroundColor }}
                          draggable={editMode}
                          onDragStart={(e) => handleDragStart(e, event)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEventClick(event);
                          }}
                        >
                          {event.title.split(' - ')[0]}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 晚上时段 */}
                  <div 
                    className="time-slot evening-slot"
                    style={{ 
                      backgroundColor: getTimeSlotColor('EVENING'),
                      border: `1px dashed ${getTimeSlotBorderColor('EVENING')}`
                    }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, date, 'EVENING')}
                    onClick={() => handleDateClick(date, 'EVENING')}
                  >
                    <span className="slot-label">晚上</span>
                    <div className="slot-events">
                      {eveningEvents.map(event => (
                        <div
                          key={event.id}
                          className="event-item"
                          style={{ backgroundColor: event.backgroundColor }}
                          draggable={editMode}
                          onDragStart={(e) => handleDragStart(e, event)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEventClick(event);
                          }}
                        >
                          {event.title.split(' - ')[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 创建活动弹窗 */}
        <Modal
          title="创建活动"
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            form.resetFields();
          }}
          onOk={() => form.submit()}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreateActivity}
            initialValues={{
              timeSlot: currentEvent?.timeSlot || 'MORNING',
              participantCount: 44
            }}
          >
            <Form.Item
              name="groupId"
              label="选择团组"
              rules={[{ required: true, message: '请选择团组' }]}
            >
              <Select placeholder="请选择团组">
                {groups.map(g => (
                  <Option key={g.id} value={g.id}>
                    {g.name} ({g.type === 'primary' ? '小学' : '中学'})
                  </Option>
                ))}
              </Select>
            </Form.Item>

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

export default CustomCalendar;