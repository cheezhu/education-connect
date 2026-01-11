import React, { useState, useEffect, useRef } from 'react';
import { Card, Select, Input, Tag, Button, Space, Table, Modal, message } from 'antd';
import {
  PlusOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import dayjs from 'dayjs';
import GroupInfoSimple from '../GroupEditV2/GroupInfoSimple';
import ScheduleDetail from '../GroupEditV2/ScheduleDetail';
import './GroupManagementV2.css';

const { Option } = Select;
const { Search } = Input;

const GroupManagementV2 = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [itineraryPlans, setItineraryPlans] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalView, setModalView] = useState(null);
  const [modalGroup, setModalGroup] = useState(null);
  const [modalSchedules, setModalSchedules] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    searchText: ''
  });
  const autoSaveTimeoutRef = useRef(null);

  // 状态颜色映射
  const statusColors = {
    '准备中': 'blue',
    '进行中': 'green',
    '已完成': 'default',
    '已取消': 'red'
  };

  // 加载团组数据
  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await api.get('/groups');

      // 为V1数据添加V2扩展字段（临时处理）
      const enhancedGroups = response.data.map(group => ({
        ...group,
        status: calculateStatus(group),
        completed_activities: Math.floor(Math.random() * 15) + 1,
        activity_count: 15,
        contact_person: group.contact_person || '张老师',
        contact_phone: group.contact_phone || '13800138000',
        tags: generateTags(group),
        completion_rate: calculateCompletionRate(group)
      }));

      setGroups(enhancedGroups);
      setFilteredGroups(enhancedGroups);
    } catch (error) {
      message.error('加载团组数据失败');
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  // 计算团组状态
  const calculateStatus = (group) => {
    const today = dayjs();
    const startDate = dayjs(group.start_date);
    const endDate = dayjs(group.end_date);

    if (today.isBefore(startDate)) return '准备中';
    if (today.isAfter(endDate)) return '已完成';
    return '进行中';
  };

  // 生成标签
  const generateTags = (group) => {
    const tags = [];
    if (group.student_count > 45) tags.push('大型团组');
    if (group.type === 'primary') tags.push('小学');
    else tags.push('中学');
    if (dayjs(group.start_date).month() === 8) tags.push('9月出行');
    return tags;
  };

  // 计算完成率
  const calculateCompletionRate = (group) => {
    const today = dayjs();
    const startDate = dayjs(group.start_date);
    const endDate = dayjs(group.end_date);

    if (today.isBefore(startDate)) return 0;
    if (today.isAfter(endDate)) return 100;

    const totalDays = endDate.diff(startDate, 'day') + 1;
    const passedDays = today.diff(startDate, 'day') + 1;
    return Math.round((passedDays / totalDays) * 100);
  };

  // 应用筛选
  useEffect(() => {
    let filtered = [...groups];

    // 状态筛选
    if (filters.status !== 'all') {
      filtered = filtered.filter(g => g.status === filters.status);
    }

    // 类型筛选
    if (filters.type !== 'all') {
      filtered = filtered.filter(g => g.type === filters.type);
    }

    // 搜索筛选
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(g =>
        g.name.toLowerCase().includes(searchLower) ||
        g.contact_person?.toLowerCase().includes(searchLower) ||
        g.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    setFilteredGroups(filtered);
  }, [filters, groups]);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchItineraryPlans = async () => {
    try {
      const response = await api.get('/itinerary-plans');
      setItineraryPlans(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setItineraryPlans([]);
    }
  };

  useEffect(() => {
    fetchItineraryPlans();
  }, []);

  useEffect(() => () => {
    clearTimeout(autoSaveTimeoutRef.current);
  }, []);

  const handlePlanChange = async (group, planId) => {
    const nextPlanId = planId ?? null;
    const prevPlanId = group.itinerary_plan_id ?? null;

    setGroups(prev =>
      prev.map(item =>
        item.id === group.id ? { ...item, itinerary_plan_id: nextPlanId } : item
      )
    );
    setFilteredGroups(prev =>
      prev.map(item =>
        item.id === group.id ? { ...item, itinerary_plan_id: nextPlanId } : item
      )
    );

    try {
      await api.put(`/groups/${group.id}`, { itinerary_plan_id: nextPlanId });
      message.success('行程方案已保存', 1);
    } catch (error) {
      setGroups(prev =>
        prev.map(item =>
          item.id === group.id ? { ...item, itinerary_plan_id: prevPlanId } : item
        )
      );
      setFilteredGroups(prev =>
        prev.map(item =>
          item.id === group.id ? { ...item, itinerary_plan_id: prevPlanId } : item
        )
      );
      message.error('保存行程方案失败');
    }
  };

  const loadSchedules = async (groupId) => {
    setModalLoading(true);
    try {
      const response = await api.get(`/groups/${groupId}/schedules`);
      setModalSchedules(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('加载日程失败');
      setModalSchedules([]);
    } finally {
      setModalLoading(false);
    }
  };

  const openModal = async (view, group) => {
    if (view === 'calendar' && group?.id) {
      navigate(`/groups/v2/edit/${group.id}?tab=schedule`);
      return;
    }
    setModalView(view);
    setModalGroup(group);
    setModalVisible(true);
    if (view === 'detail' && group?.id) {
      await loadSchedules(group.id);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalView(null);
    setModalGroup(null);
    setModalSchedules([]);
  };

  const updateModalGroup = (field, value) => {
    setModalGroup(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      if (field === 'start_date' || field === 'end_date') {
        if (updated.start_date && updated.end_date) {
          updated.duration = dayjs(updated.end_date).diff(dayjs(updated.start_date), 'day') + 1;
        }
      }
      return updated;
    });
  };

  const handleAutoSave = () => {
    clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (!modalGroup?.id) return;
      try {
        await api.put(`/groups/${modalGroup.id}`, {
          name: modalGroup.name,
          type: modalGroup.type,
          student_count: modalGroup.student_count,
          teacher_count: modalGroup.teacher_count,
          start_date: modalGroup.start_date,
          end_date: modalGroup.end_date,
          duration: modalGroup.duration,
          color: modalGroup.color,
          itinerary_plan_id: modalGroup.itinerary_plan_id,
          contact_person: modalGroup.contact_person,
          contact_phone: modalGroup.contact_phone,
          notes: modalGroup.notes
        });
        fetchGroups();
      } catch (error) {
        message.error('保存团组信息失败');
      }
    }, 800);
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
              backgroundColor: record.color || '#1890ff',
              borderRadius: '2px'
            }}
          />
          {text}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status] || 'default'}>
          {status || '—'}
        </Tag>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (type === 'primary' ? '小学' : '中学')
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
      title: '行程方案',
      key: 'itinerary_plan_id',
      render: (_, record) => (
        <Select
          size="small"
          allowClear
          placeholder="未选择"
          value={record.itinerary_plan_id ?? undefined}
          style={{ width: 160 }}
          onChange={(value) => handlePlanChange(record, value)}
        >
          {(itineraryPlans || []).map(plan => (
            <Option key={plan.id} value={plan.id}>
              {plan.name}
            </Option>
          ))}
        </Select>
      )
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<FileTextOutlined />}
            size="small"
            onClick={() => openModal('info', record)}
          >
            团组信息
          </Button>
          <Button
            icon={<PlusOutlined />}
            size="small"
            onClick={() => openModal('calendar', record)}
          >
            日历详情
          </Button>
          <Button
            size="small"
            onClick={() => openModal('detail', record)}
          >
            详细日程
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="group-management-v2">
      {/* 筛选栏 */}
      <Card className="filter-card">
        <Space size="small" wrap>
          <Select
            size="small"
            style={{ width: 120 }}
            value={filters.status}
            onChange={val => setFilters({...filters, status: val})}
            placeholder="选择状态"
          >
            <Option value="all">全部状态</Option>
            <Option value="准备中">准备中</Option>
            <Option value="进行中">进行中</Option>
            <Option value="已完成">已完成</Option>
            <Option value="已取消">已取消</Option>
          </Select>

          <Select
            size="small"
            style={{ width: 100 }}
            value={filters.type}
            onChange={val => setFilters({...filters, type: val})}
            placeholder="团组类型"
          >
            <Option value="all">全部类型</Option>
            <Option value="primary">小学</Option>
            <Option value="secondary">中学</Option>
          </Select>

          <Search
            size="small"
            placeholder="搜索团组名称、联系人或标签"
            allowClear
            style={{ width: 200 }}
            onSearch={val => setFilters({...filters, searchText: val})}
            onChange={e => !e.target.value && setFilters({...filters, searchText: ''})}
          />

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: '#999' }}>
              共 {filteredGroups.length} 个团组
            </span>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={() => navigate('/groups/v2/new')}
            >
              创建新团组
            </Button>
          </div>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredGroups}
        loading={loading}
        rowKey="id"
        size="small"
        className="group-table"
        pagination={{ pageSize: 10, size: 'small' }}
      />

      <Modal
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={720}
        bodyStyle={{
          maxHeight: '70vh',
          overflow: 'auto',
          padding: '16px'
        }}
        title={
          modalGroup
            ? `${modalGroup.name || '团组'} · ${
                modalView === 'info' ? '团组信息' : '详细日程'
              }`
            : ''
        }
        destroyOnClose
      >
        {modalLoading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>加载中...</div>
        ) : null}
        {!modalLoading && modalView === 'info' && modalGroup ? (
          <GroupInfoSimple
            groupData={modalGroup}
            itineraryPlans={itineraryPlans}
            onUpdate={updateModalGroup}
            handleAutoSave={handleAutoSave}
            isNew={false}
          />
        ) : null}
        {!modalLoading && modalView === 'detail' && modalGroup ? (
          <ScheduleDetail
            groupData={modalGroup}
            schedules={modalSchedules}
          />
        ) : null}
      </Modal>
    </div>
  );
};

export default GroupManagementV2;
