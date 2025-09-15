import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, ColorPicker, message, Space, Collapse, Tag, Row, Col, Avatar, Divider, Tooltip, Badge } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, UserOutlined, CalendarOutlined, TeamOutlined, EnvironmentOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';
import useDataSync from '../hooks/useDataSync';
import './GroupManagement.css';

const { Option } = Select;
const { Panel } = Collapse;

function GroupManagement({ editMode }) {
  const [groups, setGroups] = useState([]);
  const [activities, setActivities] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [form] = Form.useForm();
  const { registerRefreshCallback, triggerGlobalRefresh } = useDataSync();
  const [draggedActivity, setDraggedActivity] = useState(null);

  // 加载所有数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, activitiesRes, locationsRes] = await Promise.all([
        api.get('/groups'),
        api.get('/activities/raw'), // 使用原始活动数据
        api.get('/locations')
      ]);
      setGroups(groupsRes.data);
      setActivities(activitiesRes.data);
      setLocations(locationsRes.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 注册数据刷新回调
    const unregister = registerRefreshCallback(loadData);
    return unregister;
  }, [registerRefreshCallback]);

  // 显示创建/编辑对话框
  const showModal = (group = null) => {
    if (!editMode && !group) {
      message.warning('请先进入编辑模式');
      return;
    }
    
    setEditingGroup(group);
    setModalVisible(true);
    
    if (group) {
      form.setFieldsValue({
        ...group,
        startDate: dayjs(group.start_date),
        endDate: group.end_date ? dayjs(group.end_date) : null,
        studentCount: group.student_count,
        teacherCount: group.teacher_count,
        duration: group.duration,
        color: group.color || '#1890ff'
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        type: 'primary',
        studentCount: 40,
        teacherCount: 4,
        duration: 5,
        color: '#1890ff'
      });
    }
  };

  // 保存团组
  const handleSave = async (values) => {
    try {
      const data = {
        name: values.name,
        type: values.type,
        student_count: parseInt(values.studentCount),
        teacher_count: parseInt(values.teacherCount),
        start_date: values.startDate.format('YYYY-MM-DD'),
        end_date: values.endDate.format('YYYY-MM-DD'),
        duration: values.duration,
        color: typeof values.color === 'string' ? values.color : values.color.toHexString(),
        contact_person: values.contactPerson || '',
        contact_phone: values.contactPhone || '',
        notes: values.notes || ''
      };

      if (editingGroup) {
        await api.put(`/groups/${editingGroup.id}`, data);
        message.success('团组更新成功');
      } else {
        await api.post('/groups', data);
        message.success('团组创建成功');
      }

      setModalVisible(false);
      form.resetFields();
      triggerGlobalRefresh();
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 删除团组
  const handleDelete = (group) => {
    if (!editMode) {
      message.warning('请先进入编辑模式');
      return;
    }

    Modal.confirm({
      title: '确认删除团组？',
      content: `确定要删除团组"${group.name}"吗？此操作无法撤销。`,
      onOk: async () => {
        try {
          await api.delete(`/groups/${group.id}`);
          message.success('团组删除成功');
          triggerGlobalRefresh();
        } catch (error) {
          message.error(error.response?.data?.error || '删除失败');
        }
      }
    });
  };

  // 获取团组每日行程状态
  const getGroupDailyStatus = (group) => {
    if (!group.start_date || !group.end_date || !activities.length) return [];

    const startDate = new Date(group.start_date);
    const endDate = new Date(group.end_date);
    const dailyStatus = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // 获取当天的活动
      const dayActivities = activities.filter(a =>
        a.groupId === group.id && a.date === dateStr
      );

      const morningActivities = dayActivities.filter(a => a.timeSlot === 'MORNING');
      const afternoonActivities = dayActivities.filter(a => a.timeSlot === 'AFTERNOON');

      dailyStatus.push({
        date: dateStr,
        dayName: currentDate.toLocaleDateString('zh-CN', { weekday: 'short' }),
        morningActivities,
        afternoonActivities
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyStatus;
  };

  // 处理地点选择变更
  const handleLocationChange = async (groupId, date, timeSlot, locationId, activityId = null) => {
    try {
      let targetActivity;

      if (activityId) {
        // 如果指定了活动ID，直接使用
        targetActivity = activities.find(a => a.id === activityId);
      } else {
        // 兼容旧的调用方式，查找第一个匹配的活动
        targetActivity = activities.find(a =>
          a.groupId === groupId && a.date === date && a.timeSlot === timeSlot
        );
      }

      if (targetActivity) {
        // 更新现有活动
        await api.put(`/activities/${targetActivity.id}`, {
          locationId: locationId || null
        });
      } else {
        // 如果找不到基础活动，先重新加载数据
        await loadData();

        // 重新查找
        const reloadedActivity = activities.find(a =>
          activityId ? a.id === activityId : (a.groupId === groupId && a.date === date && a.timeSlot === timeSlot)
        );

        if (reloadedActivity) {
          await api.put(`/activities/${reloadedActivity.id}`, {
            locationId: locationId || null
          });
        } else {
          message.error('未找到对应的活动记录，请刷新页面重试');
          return;
        }
      }

      message.success('地点安排已更新');
      // 触发全局数据同步
      triggerGlobalRefresh();
    } catch (error) {
      console.error('更新地点失败:', error);
      message.error(error.response?.data?.error || '更新地点失败');
    }
  };

  // 获取所有可用地点选项（移除冲突检测）
  const getAvailableLocations = (group, date, timeSlot) => {
    return locations || [];
  };

  // 新增活动
  const handleAddActivity = async (groupId, date, timeSlot) => {
    if (!editMode) {
      message.warning('请先进入编辑模式');
      return;
    }

    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      await api.post('/activities', {
        groupId,
        locationId: null, // 默认未安排地点
        date,
        timeSlot,
        participantCount: group.student_count + group.teacher_count
      });

      message.success('行程已添加');
      triggerGlobalRefresh();
    } catch (error) {
      console.error('添加行程失败:', error);
      message.error('添加行程失败');
    }
  };

  // 删除活动
  const handleDeleteActivity = async (activityId) => {
    if (!editMode) {
      message.warning('请先进入编辑模式');
      return;
    }

    try {
      await api.delete(`/activities/${activityId}`);
      message.success('行程已删除');
      triggerGlobalRefresh();
    } catch (error) {
      console.error('删除行程失败:', error);
      message.error('删除行程失败');
    }
  };

  // 拖拽开始
  const handleDragStart = (e, activity) => {
    if (!editMode) {
      e.preventDefault();
      return;
    }
    setDraggedActivity(activity);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', activity.id);

    // 添加拖拽样式
    e.target.classList.add('dragging');
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
  const handleDragEnter = (e, timeSlot) => {
    e.preventDefault();
    const target = e.currentTarget;
    target.classList.add('drag-over');
  };

  // 拖拽离开
  const handleDragLeave = (e) => {
    e.preventDefault();
    const target = e.currentTarget;
    // 只有当鼠标真正离开目标区域时才移除样式
    if (!target.contains(e.relatedTarget)) {
      target.classList.remove('drag-over');
    }
  };

  // 拖拽放置
  const handleDrop = async (e, targetDate, targetTimeSlot) => {
    e.preventDefault();
    const target = e.currentTarget;
    target.classList.remove('drag-over');

    if (!draggedActivity || !editMode) return;

    // 检查是否真的有变化
    if (draggedActivity.date === targetDate && draggedActivity.timeSlot === targetTimeSlot) {
      return;
    }

    try {
      await api.put(`/activities/${draggedActivity.id}`, {
        date: targetDate,
        timeSlot: targetTimeSlot
      });

      message.success('行程已移动');
      triggerGlobalRefresh();
    } catch (error) {
      console.error('移动行程失败:', error);
      message.error('移动行程失败');
    }
  };


  // 渲染单个时段的活动
  const renderTimeSlotActivities = (group, day, timeSlot, timeSlotActivities) => {
    const availableLocations = getAvailableLocations(group, day.date, timeSlot);
    const timeSlotLabel = timeSlot === 'MORNING' ? '上午' : '下午';

    return (
      <div
        style={{ marginBottom: '12px' }}
        className="time-slot-container"
        onDragOver={handleDragOver}
        onDragEnter={(e) => handleDragEnter(e, timeSlot)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, day.date, timeSlot)}
      >
        <div
          className="drop-zone"
          style={{
            marginBottom: '8px',
            padding: '2px',
            border: '2px dashed transparent',
            borderRadius: '4px',
            transition: 'all 0.2s ease'
          }}
        >
          {timeSlotActivities.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px' }}>
              <span style={{ fontWeight: 'bold', minWidth: '40px' }}>{timeSlotLabel}:</span>
              <div style={{ color: '#999', fontSize: '12px', fontStyle: 'italic', flex: 1 }}>
                {editMode ? '点击+添加行程或拖拽到这里' : '暂无行程'}
              </div>
              {editMode && (
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() => handleAddActivity(group.id, day.date, timeSlot)}
                  title="添加行程"
                  style={{ color: '#1890ff' }}
                />
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {timeSlotActivities.map((activity, actIndex) => {
                return (
                  <div
                    key={activity.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0' }}
                  >
                    {/* 第一个行程显示标签，其他行程显示空白占位 */}
                    <span style={{ fontWeight: 'bold', minWidth: '40px' }}>
                      {actIndex === 0 ? `${timeSlotLabel}:` : ''}
                    </span>

                    <div
                      className="activity-card"
                      draggable={editMode}
                      onDragStart={(e) => handleDragStart(e, activity)}
                      onDragEnd={handleDragEnd}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px 6px',
                        backgroundColor: group.color || '#1890ff',
                        color: 'white',
                        borderRadius: '4px',
                        cursor: editMode ? 'grab' : 'default',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        minHeight: '28px'
                      }}
                      title={editMode ? '拖拽移动此行程' : ''}
                    >
                      <Select
                        style={{ flex: 1 }}
                        size="small"
                        placeholder="选择地点"
                        value={activity.locationId || null}
                        onChange={(value) => handleLocationChange(group.id, day.date, timeSlot, value, activity.id)}
                        disabled={!editMode}
                        allowClear
                        dropdownStyle={{ zIndex: 2000 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Option value={null}>未安排</Option>
                        {availableLocations.map(location => (
                          <Option key={location.id} value={location.id}>
                            {location.name}
                          </Option>
                        ))}
                      </Select>
                    </div>

                    {editMode && (
                      <Button
                        type="text"
                        icon={<PlusOutlined />}
                        size="small"
                        onClick={() => handleAddActivity(group.id, day.date, timeSlot)}
                        title="添加更多行程"
                        style={{ color: '#1890ff' }}
                      />
                    )}

                    {editMode && timeSlotActivities.length > 1 && (
                      <Button
                        type="text"
                        icon={<MinusCircleOutlined />}
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteActivity(activity.id);
                        }}
                        style={{ color: '#ff4d4f' }}
                        title="删除此行程"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 渲染每日行程状态
  const renderDailyStatus = (group) => {
    const dailyStatus = getGroupDailyStatus(group);

    return (
      <div style={{ marginTop: '16px' }}>
        <h4>每日行程安排</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', maxWidth: '100%' }}>
          {dailyStatus.map((day, index) => (
            <Card
              key={index}
              size="small"
              title={`${dayjs(day.date).format('MM-DD')} ${day.dayName}`}
              style={{ fontSize: '12px' }}
            >
              {renderTimeSlotActivities(group, day, 'MORNING', day.morningActivities)}
              {renderTimeSlotActivities(group, day, 'AFTERNOON', day.afternoonActivities)}
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const columns = [
    {
      title: '团组名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div 
            style={{ 
              width: '12px', 
              height: '12px', 
              backgroundColor: record.color, 
              borderRadius: '2px' 
            }}
          />
          {text}
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => type === 'primary' ? '小学' : '中学'
    },
    {
      title: '人数',
      key: 'participants',
      render: (_, record) => `${record.student_count + record.teacher_count}人`
    },
    {
      title: '开始日期',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (date) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (date) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '行程天数',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration) => `${duration}天`
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person'
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            size="small" 
            onClick={() => showModal(record)}
            disabled={!editMode}
          >
            编辑
          </Button>
          <Button 
            icon={<DeleteOutlined />} 
            size="small" 
            danger 
            onClick={() => handleDelete(record)}
            disabled={!editMode}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Card 
      title="团组管理" 
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => showModal()}
          disabled={!editMode}
        >
          添加团组
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={groups}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender: (record) => renderDailyStatus(record),
          rowExpandable: () => true, // 所有团组都显示展开按钮
        }}
      />

      <Modal
        title={editingGroup ? '编辑团组' : '添加团组'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="name"
            label="团组名称"
            rules={[{ required: true, message: '请输入团组名称' }]}
          >
            <Input placeholder="请输入团组名称" />
          </Form.Item>

          <Form.Item
            name="type"
            label="团组类型"
            rules={[{ required: true, message: '请选择团组类型' }]}
          >
            <Select placeholder="请选择团组类型">
              <Option value="primary">小学</Option>
              <Option value="secondary">中学</Option>
            </Select>
          </Form.Item>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="studentCount"
              label="学生人数"
              rules={[
                { required: true, message: '请输入学生人数' },
                {
                  validator: (_, value) => {
                    if (value && (value < 1 || !Number.isInteger(Number(value)))) {
                      return Promise.reject(new Error('学生人数必须是大于0的整数'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input type="number" placeholder="学生人数" min={1} />
            </Form.Item>

            <Form.Item
              name="teacherCount"
              label="老师人数"
              rules={[
                { required: true, message: '请输入老师人数' },
                {
                  validator: (_, value) => {
                    if (value && (value < 1 || !Number.isInteger(Number(value)))) {
                      return Promise.reject(new Error('老师人数必须是大于0的整数'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input type="number" placeholder="老师人数" min={1} />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="startDate"
              label="开始日期"
              rules={[{ required: true, message: '请选择开始日期' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                onChange={() => {
                  const startDate = form.getFieldValue('startDate');
                  const endDate = form.getFieldValue('endDate');
                  if (startDate && endDate) {
                    const duration = endDate.diff(startDate, 'day') + 1;
                    form.setFieldsValue({ duration });
                  }
                }}
              />
            </Form.Item>

            <Form.Item
              name="endDate"
              label="结束日期"
              rules={[{ required: true, message: '请选择结束日期' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                onChange={() => {
                  const startDate = form.getFieldValue('startDate');
                  const endDate = form.getFieldValue('endDate');
                  if (startDate && endDate) {
                    const duration = endDate.diff(startDate, 'day') + 1;
                    form.setFieldsValue({ duration });
                  }
                }}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="duration"
            label="行程天数（自动计算）"
          >
            <Input disabled style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="color"
            label="显示颜色"
            rules={[{ required: true, message: '请选择颜色' }]}
          >
            <ColorPicker showText />
          </Form.Item>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="contactPerson"
              label="联系人"
            >
              <Input placeholder="请输入联系人" />
            </Form.Item>

            <Form.Item
              name="contactPhone"
              label="联系电话"
            >
              <Input placeholder="请输入联系电话" />
            </Form.Item>
          </div>

          <Form.Item
            name="notes"
            label="备注"
          >
            <Input.TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export default GroupManagement;