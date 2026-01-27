import React, { useState, useEffect } from 'react';
import { Card, Select, Input, Tag, Button, Space, Table, message, Modal, DatePicker, InputNumber, Popconfirm } from 'antd';
import {
  PlusOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
  StopOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import dayjs from 'dayjs';
import './GroupManagementV2.css';

const { Option } = Select;
const { Search } = Input;
const { RangePicker } = DatePicker;

const GroupManagementV2 = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [itineraryPlans, setItineraryPlans] = useState([]);
  const [filters, setFilters] = useState({
    status: 'active',
    type: 'all',
    searchText: ''
  });
  const createBulkRow = () => ({
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    type: undefined,
    dateRange: null,
    itinerary_plan_id: undefined,
    participant_count: 44
  });

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkRows, setBulkRows] = useState(() => [createBulkRow()]);
  const [bulkErrors, setBulkErrors] = useState({});
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // 状态颜色映射
  const statusColors = {
    '准备中': 'blue',
    '进行中': 'green',
    '已完成': 'default',
    '已取消': 'red'
  };

  const normalizeTags = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean).map(item => String(item).trim()).filter(Boolean);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean).map(item => String(item).trim()).filter(Boolean);
        }
      } catch (error) {
        // ignore
      }
      return trimmed.split(',').map(item => item.trim()).filter(Boolean);
    }
    return [];
  };

  // 加载团组数据
  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await api.get('/groups');

      // 为V1数据添加V2扩展字段（临时处理）
      const enhancedGroups = response.data.map(group => ({
        ...group,
        status: group.status ?? calculateStatus(group)
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
    if (group.status === '已取消') return '已取消';
    const today = dayjs();
    const startDate = dayjs(group.start_date);
    const endDate = dayjs(group.end_date);

    if (today.isBefore(startDate)) return '准备中';
    if (today.isAfter(endDate)) return '已完成';
    return '进行中';
  };

  const addBulkRow = () => {
    setBulkRows(prev => [...prev, createBulkRow()]);
  };

  const removeBulkRow = (id) => {
    setBulkRows(prev => prev.filter(row => row.id !== id));
  };

  const updateBulkRow = (id, updates) => {
    setBulkRows(prev => prev.map(row => (row.id === id ? { ...row, ...updates } : row)));
    setBulkErrors(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const resetBulkForm = () => {
    setBulkRows([createBulkRow()]);
    setBulkErrors({});
  };

  const validateBulkRows = () => {
    const errors = {};
    let firstInvalid = null;

    bulkRows.forEach((row, index) => {
      const rowErrors = {};
      if (!row.name || !row.name.trim()) rowErrors.name = true;
      if (!row.dateRange || row.dateRange.length !== 2) rowErrors.dateRange = true;
      if (!row.type) rowErrors.type = true;
      if (!row.itinerary_plan_id) rowErrors.itinerary_plan_id = true;
      const count = Number(row.participant_count);
      if (!Number.isFinite(count) || count <= 0) rowErrors.participant_count = true;

      if (Object.keys(rowErrors).length) {
        errors[row.id] = rowErrors;
        if (firstInvalid === null) {
          firstInvalid = index + 1;
        }
      }
    });

    return { errors, firstInvalid };
  };

  const handleBulkCreate = async () => {
    if (bulkRows.length === 0) {
      message.error('请先添加团组');
      return;
    }

    const { errors, firstInvalid } = validateBulkRows();
    if (firstInvalid) {
      setBulkErrors(errors);
      message.error(`请完善第 ${firstInvalid} 行信息`);
      return;
    }

    const groupsToCreate = bulkRows.map(row => ({
      name: row.name.trim(),
      type: row.type,
      student_count: Number(row.participant_count),
      teacher_count: 0,
      start_date: row.dateRange?.[0]?.format('YYYY-MM-DD'),
      end_date: row.dateRange?.[1]?.format('YYYY-MM-DD'),
      itinerary_plan_id: row.itinerary_plan_id ?? null
    }));

    setBulkSubmitting(true);
    try {
      const response = await api.post('/groups/batch', { groups: groupsToCreate });
      const createdCount = response.data?.count ?? groupsToCreate.length;
      message.success(`已创建 ${createdCount} 个团组`);
      setBulkOpen(false);
      resetBulkForm();
      fetchGroups();
    } catch (error) {
      const errorMessage = error?.response?.data?.message
        || error?.response?.data?.error
        || '批量创建失败';
      message.error(errorMessage);
    } finally {
      setBulkSubmitting(false);
    }
  };

  // 应用筛选
  useEffect(() => {
    let filtered = [...groups];

    // 状态筛选
    if (filters.status === 'active') {
      filtered = filtered.filter(g => g.status !== '已取消');
    } else if (filters.status !== 'all') {
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
        (g.name || '').toLowerCase().includes(searchLower) ||
        (g.contact_person || '').toLowerCase().includes(searchLower) ||
        (g.contact_phone || '').toLowerCase().includes(searchLower)
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

  const handlePlanChange = async (group, planId) => {
    const nextPlanId = planId ?? null;
    const prevPlanId = group.itinerary_plan_id ?? null;

    setGroups(prev =>
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
      message.error('保存行程方案失败');
    }
  };


  const handleCancelGroup = async (groupId) => {
    if (!groupId) return;
    try {
      await api.delete(`/groups/${groupId}`);
      message.success('团组已取消，相关数据已删除');
      fetchGroups();
    } catch (error) {
      const errorMessage = error?.response?.data?.error || '取消失败';
      message.error(errorMessage);
    }
  };

  const handleBatchCancel = async () => {
    if (!selectedRowKeys.length) {
      message.error('请先选择团组');
      return;
    }

    setBatchDeleting(true);
    try {
      const response = await api.post('/groups/batch-delete', {
        ids: selectedRowKeys
      });

      const deletedIds = response.data?.deletedIds || [];
      const missingIds = response.data?.missingIds || [];

      if (deletedIds.length) {
        message.success(`已取消 ${deletedIds.length} 个团组`);
      }
      if (missingIds.length) {
        message.error(`有 ${missingIds.length} 个团组未删除`);
      }

      setSelectedRowKeys([]);
      fetchGroups();
    } catch (error) {
      const errorMessage = error?.response?.data?.error || '取消失败';
      message.error(errorMessage);
    } finally {
      setBatchDeleting(false);
    }
  };

  const openGroupTab = (groupId, tab) => {
    if (!groupId) return;
    navigate(`/groups/v2/edit/${groupId}?tab=${tab}`);
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
      title: '住宿安排',
      dataIndex: 'accommodation',
      key: 'accommodation',
      render: (value) => value || '—'
    },
    {
      title: '备注标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (value) => {
        const tags = normalizeTags(value);
        if (!tags.length) return '—';
        const visibleTags = tags.slice(0, 2);
        const remaining = tags.length - visibleTags.length;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {visibleTags.map(tag => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            {remaining > 0 && <Tag>+{remaining}</Tag>}
          </div>
        );
      }
    },
    {
      title: '人数',
      key: 'participants',
      render: (_, record) => `${(record.student_count || 0) + (record.teacher_count || 0)}人`
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
          disabled={record.status === '已取消'}
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
      render: (_, record) => {
        const isCancelled = record.status === '已取消';
        return (
          <Space>
            <Button
              icon={<FileTextOutlined />}
              size="small"
              onClick={() => openGroupTab(record.id, 'info')}
            >
              团组详情
            </Button>
            <Button
              icon={<PlusOutlined />}
              size="small"
              disabled={isCancelled}
              onClick={() => openGroupTab(record.id, 'schedule')}
            >
              添加日程
            </Button>
            <Button
              size="small"
              disabled={isCancelled}
              onClick={() => openGroupTab(record.id, 'schedule-detail')}
            >
              日历详情
            </Button>
            <Popconfirm
              title="确定取消该团组吗？"
              description="取消后将永久删除该团组及相关日程与人员信息"
              okText="取消"
              cancelText="不取消"
              onConfirm={() => handleCancelGroup(record.id)}
            >
              <Button
                danger
                size="small"
                icon={<StopOutlined />}
              >
                取消
              </Button>
            </Popconfirm>
          </Space>
        );
      }
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
            <Option value="active">进行中/未取消</Option>
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
            placeholder="搜索团组名称或联系人"
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
              icon={<UnorderedListOutlined />}
              size="small"
              onClick={() => setBulkOpen(true)}
            >
              {'\u6279\u91cf\u521b\u5efa'}
            </Button>
            <Popconfirm
              title="确定取消所选团组吗？"
              description="取消后将永久删除所选团组及相关日程与人员信息"
              okText="取消所选"
              cancelText="不取消"
              onConfirm={handleBatchCancel}
              disabled={selectedRowKeys.length === 0}
            >
              <Button
                danger
                size="small"
                icon={<StopOutlined />}
                loading={batchDeleting}
                disabled={selectedRowKeys.length === 0}
              >
                {`取消所选${selectedRowKeys.length ? ` (${selectedRowKeys.length})` : ''}`}
              </Button>
            </Popconfirm>



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
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys)
        }}
        pagination={{ pageSize: 10, size: 'small' }}
      />


      <Modal
        title={'批量创建团组'}
        open={bulkOpen}
        onCancel={() => setBulkOpen(false)}
        onOk={handleBulkCreate}
        okText={'开始创建'}
        cancelText={'取消'}
        confirmLoading={bulkSubmitting}
        width={980}
        afterClose={resetBulkForm}
      >
        <div className="bulk-create-modal">
          <div className="bulk-row-header">
            <span className="bulk-col-index">#</span>
            <span className="bulk-col-name">{'团组名称'}</span>
            <span className="bulk-col-date">{'日期'}</span>
            <span className="bulk-col-type">{'类型'}</span>
            <span className="bulk-col-plan">{'方案'}</span>
            <span className="bulk-col-count">{'人数'}</span>
            <span className="bulk-col-actions">{'操作'}</span>
          </div>

          <div className="bulk-row-list">
            {bulkRows.map((row, index) => {
              const rowError = bulkErrors[row.id] || {};
              const rowHasError = Object.keys(rowError).length > 0;

              return (
                <div className={`bulk-row ${rowHasError ? 'has-error' : ''}`} key={row.id}>
                  <div className="bulk-row-index">{index + 1}</div>
                  <Input
                    size="small"
                    value={row.name}
                    status={rowError.name ? 'error' : ''}
                    placeholder={'输入团组名称'}
                    onChange={(e) => updateBulkRow(row.id, { name: e.target.value })}
                  />
                  <RangePicker
                    size="small"
                    value={row.dateRange}
                    status={rowError.dateRange ? 'error' : ''}
                    onChange={(value) => updateBulkRow(row.id, { dateRange: value })}
                  />
                  <Select
                    size="small"
                    value={row.type ?? undefined}
                    status={rowError.type ? 'error' : ''}
                    placeholder={'选择类型'}
                    onChange={(value) => updateBulkRow(row.id, { type: value })}
                  >
                    <Option value="primary">{'小学'}</Option>
                    <Option value="secondary">{'中学'}</Option>
                  </Select>
                  <Select
                    size="small"
                    value={row.itinerary_plan_id ?? undefined}
                    status={rowError.itinerary_plan_id ? 'error' : ''}
                    placeholder={'选择方案'}
                    onChange={(value) => updateBulkRow(row.id, { itinerary_plan_id: value })}
                  >
                    {(itineraryPlans || []).map(plan => (
                      <Option key={plan.id} value={plan.id}>
                        {plan.name}
                      </Option>
                    ))}
                  </Select>
                  <InputNumber
                    size="small"
                    min={1}
                    value={row.participant_count}
                    status={rowError.participant_count ? 'error' : ''}
                    onChange={(value) => updateBulkRow(row.id, { participant_count: value })}
                  />
                  <Button
                    size="small"
                    danger
                    disabled={bulkRows.length === 1}
                    onClick={() => removeBulkRow(row.id)}
                  >
                    {'取消'}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="bulk-row-actions">
            <Button size="small" onClick={addBulkRow}>
              {'新增一行'}
            </Button>
            <span className="bulk-count">{`共 ${bulkRows.length} 行`}</span>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default GroupManagementV2;
