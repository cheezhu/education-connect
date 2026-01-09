import React, { useState, useEffect } from 'react';
import { Card, Select, Input, Tag, Button, Space, Table, message } from 'antd';
import {
  PlusOutlined,
  FileTextOutlined,
  ExportOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import dayjs from 'dayjs';
import './GroupManagementV2.css';

const { Option } = Select;
const { Search } = Input;

const GroupManagementV2 = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    searchText: ''
  });

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
      title: '联系人',
      key: 'contact',
      render: (_, record) => `${record.contact_person || ''} ${record.contact_phone || ''}`.trim() || '—'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<FileTextOutlined />}
            size="small"
            onClick={() => navigate(`/groups/v2/edit/${record.id}`)}
          >
            查看详情
          </Button>
          <Button
            icon={<PlusOutlined />}
            size="small"
            onClick={() => navigate(`/groups/v2/edit/${record.id}`)}
          >
            编辑团组
          </Button>
          <Button
            icon={<ExportOutlined />}
            size="small"
            onClick={() => message.info('导出功能开发中')}
          >
            导出报告
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
    </div>
  );
};

export default GroupManagementV2;
