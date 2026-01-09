import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Select, Input, Tag, Button, Space, Spin, Empty, Badge, Progress, Tooltip, message } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  CalendarOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
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

  // 状态图标映射
  const statusIcons = {
    '准备中': <ClockCircleOutlined />,
    '进行中': <CheckCircleOutlined />,
    '已完成': <CheckCircleOutlined />,
    '已取消': <ClockCircleOutlined />
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

  // 渲染团组卡片
  const renderGroupCard = (group) => {
    const startDate = dayjs(group.start_date);
    const endDate = dayjs(group.end_date);

    return (
      <Card
        hoverable
        className="group-card-v2"
        style={{ borderLeft: `4px solid ${group.color || '#1890ff'}` }}
        actions={[
          <Button
            type="link"
            icon={<FileTextOutlined />}
            onClick={() => navigate(`/groups/v2/edit/${group.id}`)}
          >
            查看详情
          </Button>,
          <Button
            type="link"
            icon={<PlusOutlined />}
            onClick={() => navigate(`/groups/v2/edit/${group.id}`)}
          >
            编辑团组
          </Button>,
          <Button
            type="link"
            icon={<ExportOutlined />}
            onClick={() => message.info('导出功能开发中')}
          >
            导出报告
          </Button>
        ]}
      >
        <div className="card-header">
          <div className="group-name">
            <h3>{group.name}</h3>
            <Badge
              status={group.status === '进行中' ? 'processing' : 'default'}
              text={
                <Tag color={statusColors[group.status]} icon={statusIcons[group.status]}>
                  {group.status}
                </Tag>
              }
            />
          </div>
        </div>

        <div className="card-content">
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div className="info-row">
              <CalendarOutlined />
              <span>{startDate.format('YYYY.MM.DD')} - {endDate.format('MM.DD')} ({group.duration}天)</span>
            </div>

            <div className="info-row">
              <TeamOutlined />
              <span>学生: {group.student_count}人 | 老师: {group.teacher_count}人</span>
            </div>

            <div className="info-row">
              <EnvironmentOutlined />
              <span>行程完成度:</span>
              <Progress
                percent={group.completion_rate}
                size="small"
                style={{ width: 120, marginLeft: 8 }}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
            </div>

            <div className="info-row">
              <CheckCircleOutlined />
              <span>已安排活动: {group.completed_activities}个 | 待安排: {group.activity_count - group.completed_activities}个</span>
            </div>

            <div className="info-row">
              <PhoneOutlined />
              <span>联系人: {group.contact_person} {group.contact_phone}</span>
            </div>

            {group.tags && group.tags.length > 0 && (
              <div className="tags-row">
                {group.tags.map((tag, index) => (
                  <Tag key={index} color="blue">{tag}</Tag>
                ))}
              </div>
            )}
          </Space>
        </div>
      </Card>
    );
  };

  return (
    <div className="group-management-v2">
      {/* 页面标题和操作栏 */}
      <div className="page-header">
        <div className="header-content">
          <h1>团组管理 V2</h1>
          <span className="subtitle">专业版团组管理系统</span>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => navigate('/groups/v2/new')}
        >
          创建新团组
        </Button>
      </div>

      {/* 筛选栏 */}
      <Card className="filter-card">
        <Space size="middle" wrap>
          <Select
            style={{ width: 140 }}
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
            style={{ width: 120 }}
            value={filters.type}
            onChange={val => setFilters({...filters, type: val})}
            placeholder="团组类型"
          >
            <Option value="all">全部类型</Option>
            <Option value="primary">小学</Option>
            <Option value="secondary">中学</Option>
          </Select>

          <Search
            placeholder="搜索团组名称、联系人或标签"
            allowClear
            style={{ width: 300 }}
            onSearch={val => setFilters({...filters, searchText: val})}
            onChange={e => !e.target.value && setFilters({...filters, searchText: ''})}
          />

          <div style={{ marginLeft: 'auto' }}>
            <span style={{ color: '#999' }}>
              共 {filteredGroups.length} 个团组
            </span>
          </div>
        </Space>
      </Card>

      {/* 团组卡片列表 */}
      <Spin spinning={loading}>
        {filteredGroups.length > 0 ? (
          <Row gutter={[16, 16]}>
            {filteredGroups.map(group => (
              <Col xs={24} sm={24} md={12} lg={8} xl={8} xxl={6} key={group.id}>
                {renderGroupCard(group)}
              </Col>
            ))}
          </Row>
        ) : (
          <Empty
            description={loading ? "加载中..." : "暂无团组数据"}
            style={{ marginTop: 60 }}
          >
            {!loading && (
              <Button type="primary" onClick={() => navigate('/groups/v2/new')}>
                创建第一个团组
              </Button>
            )}
          </Empty>
        )}
      </Spin>
    </div>
  );
};

export default GroupManagementV2;
