import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Checkbox, message, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

function LocationManagement({ editMode }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [form] = Form.useForm();

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

  useEffect(() => {
    loadLocations();
  }, []);

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
        ...location,
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
      const data = {
        ...values,
        blockedWeekdays: values.blockedWeekdays ? values.blockedWeekdays.join(',') : ''
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

  return (
    <Card 
      title="地点管理" 
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => showModal()}
          disabled={!editMode}
        >
          添加地点
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={locations}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

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
    </Card>
  );
}

export default LocationManagement;