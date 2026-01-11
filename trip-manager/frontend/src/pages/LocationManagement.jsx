import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Checkbox, message, Space, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';
import './LocationManagement.css';

const { Option } = Select;
const { TextArea, Search } = Input;

function LocationManagement({ editMode }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('locations');
  const [searchText, setSearchText] = useState('');
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [filteredPlans, setFilteredPlans] = useState([]);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [form] = Form.useForm();
  const [planForm] = Form.useForm();

  // 星期选项
  const weekdayOptions = [
    { label: '周日', value: '0' },
    { label: '周一', value: '1' },
    { label: '周二', value: '2' },
    { label: '周三', value: '3' },
    { label: '周四', value: '4' },
    { label: '周五', value: '5' },
    { label: '周六', value: '6' }
  ];

  // 加载地点数据
  const loadLocations = async () => {
    setLoading(true);
    try {
      const response = await api.get('/locations');
      setLocations(response.data);
    } catch (error) {
      message.error('加载地点数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    setPlanLoading(true);
    try {
      const response = await api.get('/itinerary-plans');
      setPlans(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('加载行程方案失败');
    } finally {
      setPlanLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
    loadPlans();
  }, []);

  useEffect(() => {
    setFilteredLocations(locations);
  }, [locations]);

  useEffect(() => {
    setFilteredPlans(plans);
  }, [plans]);

  useEffect(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) {
      setFilteredLocations(locations);
      setFilteredPlans(plans);
      return;
    }

    setFilteredLocations(
      locations.filter((location) => {
        const haystack = [
          location.name,
          location.address,
          location.notes,
          location.contact_person,
          location.contact_phone
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(keyword);
      })
    );

    setFilteredPlans(
      plans.filter((plan) => {
        const itemNames = Array.isArray(plan.items)
          ? plan.items.map(item => item.location_name).filter(Boolean).join(' ')
          : '';
        const haystack = [plan.name, plan.description, itemNames]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(keyword);
      })
    );
  }, [searchText, locations, plans]);

  // 显示创建/编辑对话框
  const showModal = (location = null) => {
    if (!editMode && !location) {
      message.warning('请先进入编辑模式');
      return;
    }
    
    setEditingLocation(location);
    setModalVisible(true);
    
    if (location) {
      form.setFieldsValue({
        name: location.name,
        address: location.address,
        capacity: location.capacity,
        notes: location.notes,
        targetGroups: location.target_groups || 'all',
        contactPerson: location.contact_person || '',
        contactPhone: location.contact_phone || '',
        blockedWeekdays: location.blocked_weekdays ? location.blocked_weekdays.split(',') : []
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        capacity: 100,
        targetGroups: 'all',
        blockedWeekdays: []
      });
    }
  };

  // 保存地点
  const handleSave = async (values) => {
    try {
      const blockedValue = values.blockedWeekdays ? values.blockedWeekdays.join(',') : '';
      const data = {
        ...values,
        blockedWeekdays: blockedValue,
        blocked_weekdays: blockedValue,
        target_groups: values.targetGroups,
        contact_person: values.contactPerson,
        contact_phone: values.contactPhone
      };

      if (editingLocation) {
        await api.put(`/locations/${editingLocation.id}`, data);
        message.success('地点更新成功');
      } else {
        await api.post('/locations', data);
        message.success('地点创建成功');
      }

      setModalVisible(false);
      form.resetFields();
      loadLocations();
      loadPlans();
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 删除地点
  const handleDelete = (location) => {
    if (!editMode) {
      message.warning('请先进入编辑模式');
      return;
    }

    Modal.confirm({
      title: '确认删除地点？',
      content: `确定要删除地点"${location.name}"吗？此操作会将地点设为不可用。`,
      onOk: async () => {
        try {
          await api.delete(`/locations/${location.id}`);
          message.success('地点已禁用');
          loadLocations();
          loadPlans();
        } catch (error) {
          message.error(error.response?.data?.error || '删除失败');
        }
      }
    });
  };

  // 显示创建/编辑行程方案
  const showPlanModal = (plan = null) => {
    if (!editMode && !plan) {
      message.warning('请先进入编辑模式');
      return;
    }

    setEditingPlan(plan);
    setPlanModalVisible(true);

    if (plan) {
      planForm.setFieldsValue({
        name: plan.name,
        description: plan.description || '',
        locationIds: (plan.items || []).map(item => item.location_id)
      });
    } else {
      planForm.resetFields();
      planForm.setFieldsValue({ locationIds: [] });
    }
  };

  // 保存行程方案
  const handlePlanSave = async (values) => {
    try {
      const payload = {
        name: values.name,
        description: values.description || '',
        locationIds: values.locationIds || []
      };

      if (editingPlan) {
        await api.put(`/itinerary-plans/${editingPlan.id}`, payload);
        message.success('行程方案更新成功');
      } else {
        await api.post('/itinerary-plans', payload);
        message.success('行程方案创建成功');
      }

      setPlanModalVisible(false);
      planForm.resetFields();
      loadPlans();
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 删除行程方案
  const handlePlanDelete = (plan) => {
    if (!editMode) {
      message.warning('请先进入编辑模式');
      return;
    }

    Modal.confirm({
      title: '确认删除行程方案？',
      content: `确定要删除方案"${plan.name}"吗？`,
      onOk: async () => {
        try {
          await api.delete(`/itinerary-plans/${plan.id}`);
          message.success('行程方案已删除');
          loadPlans();
        } catch (error) {
          message.error(error.response?.data?.error || '删除失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '地点名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true
    },
    {
      title: '容量',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (capacity) => `${capacity}人`
    },
    {
      title: '适用团组',
      dataIndex: 'target_groups',
      key: 'target_groups',
      render: (target) => {
        if (target === 'all') return '全部';
        if (target === 'primary') return '小学';
        if (target === 'secondary') return '中学';
        return target;
      }
    },
    {
      title: '受限日期',
      dataIndex: 'blocked_weekdays',
      key: 'blocked_weekdays',
      render: (blocked) => {
        if (!blocked) return '无';
        const days = blocked.split(',').map(day => {
          const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
          return dayNames[parseInt(day)];
        });
        return days.join(', ');
      }
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
            禁用
          </Button>
        </Space>
      )
    }
  ];

  const planColumns = [
    {
      title: '方案名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '—'
    },
    {
      title: '包含地点',
      key: 'items',
      render: (_, record) => {
        const items = record.items || [];
        if (items.length === 0) {
          return '未选择';
        }
        return (
          <Space wrap>
            {items.map(item => (
              <Tag key={`${record.id}-${item.location_id}`}>{item.location_name}</Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: '地点数',
      key: 'count',
      width: 90,
      render: (_, record) => `${(record.items || []).length}个`
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => showPlanModal(record)}
            disabled={!editMode}
          >
            编辑
          </Button>
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => handlePlanDelete(record)}
            disabled={!editMode}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const extraAction = activeTab === 'plans' ? (
    <Button
      type="primary"
      icon={<PlusOutlined />}
      onClick={() => showPlanModal()}
      disabled={!editMode}
    >
      创建方案
    </Button>
  ) : (
    <Button
      type="primary"
      icon={<PlusOutlined />}
      onClick={() => showModal()}
      disabled={!editMode}
    >
      添加地点
    </Button>
  );

  return (
    <div className="location-management">
      <Card className="filter-card">
        <Space size="small" wrap>
          <div className="resource-page-title">行程资源</div>
          <div className="resource-tabs">
            <Button
              size="small"
              type={activeTab === 'locations' ? 'primary' : 'default'}
              onClick={() => setActiveTab('locations')}
            >
              地点
            </Button>
            <Button
              size="small"
              type={activeTab === 'plans' ? 'primary' : 'default'}
              onClick={() => setActiveTab('plans')}
            >
              行程方案
            </Button>
          </div>
          <Search
            size="small"
            placeholder={activeTab === 'locations' ? '搜索地点/地址/联系人' : '搜索方案/地点'}
            allowClear
            style={{ width: 220 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <div className="resource-meta">
            <span>
              共{activeTab === 'locations' ? filteredLocations.length : filteredPlans.length}个
            </span>
            {extraAction}
          </div>
        </Space>
      </Card>

      {activeTab === 'locations' ? (
        <Table
          columns={columns}
          dataSource={filteredLocations}
          loading={loading}
          rowKey="id"
          size="small"
          className="resource-table"
          pagination={{ pageSize: 10, size: 'small' }}
        />
      ) : (
        <Table
          columns={planColumns}
          dataSource={filteredPlans}
          loading={planLoading}
          rowKey="id"
          size="small"
          className="resource-table"
          pagination={{ pageSize: 10, size: 'small' }}
        />
      )}

      <Modal
        title={editingLocation ? '编辑地点' : '添加地点'}
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
            label="地点名称"
            rules={[{ required: true, message: '请输入地点名称' }]}
          >
            <Input placeholder="请输入地点名称" />
          </Form.Item>

          <Form.Item
            name="address"
            label="地址"
          >
            <TextArea rows={2} placeholder="请输入地址" />
          </Form.Item>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="capacity"
              label="最大容量"
              rules={[{ required: true, type: 'number', min: 1 }]}
            >
              <InputNumber
                min={1}
                max={1000}
                addonAfter="人"
                style={{ width: '100%' }}
                placeholder="最大容量"
              />
            </Form.Item>

            <Form.Item
              name="targetGroups"
              label="适用团组"
              rules={[{ required: true, message: '请选择适用团组' }]}
            >
              <Select placeholder="请选择适用团组">
                <Option value="all">全部团组</Option>
                <Option value="primary">仅小学团组</Option>
                <Option value="secondary">仅中学团组</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="blockedWeekdays"
            label="不可用日期"
          >
            <Checkbox.Group options={weekdayOptions} />
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
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingPlan ? '编辑行程方案' : '创建行程方案'}
        open={planModalVisible}
        onCancel={() => {
          setPlanModalVisible(false);
          planForm.resetFields();
        }}
        onOk={() => planForm.submit()}
        width={600}
      >
        <Form
          form={planForm}
          layout="vertical"
          onFinish={handlePlanSave}
        >
          <Form.Item
            name="name"
            label="方案名称"
            rules={[{ required: true, message: '请输入方案名称' }]}
          >
            <Input placeholder="请输入方案名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="说明"
          >
            <TextArea rows={2} placeholder="可选，补充方案说明" />
          </Form.Item>

          <Form.Item
            name="locationIds"
            label="包含地点"
          >
            <Select
              mode="multiple"
              placeholder="选择地点组成方案"
              optionFilterProp="children"
            >
              {locations.map(location => (
                <Option key={location.id} value={location.id}>
                  {location.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default LocationManagement;
