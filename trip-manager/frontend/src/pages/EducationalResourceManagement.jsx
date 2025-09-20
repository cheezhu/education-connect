import React, { useState, useEffect } from 'react';
import { Card, Tabs, Button, Table, Modal, Form, Input, Select, InputNumber, message, Space, Tag } from 'antd';
import { PlusOutlined, EditOutlined, CopyOutlined, DeleteOutlined, BookOutlined, AppstoreOutlined } from '@ant-design/icons';
import api from '../services/api';

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

const EducationalResourceManagement = () => {
  const [activeTab, setActiveTab] = useState('resources');

  return (
    <div className="educational-resource-management">
      <Card
        title={
          <span>
            <BookOutlined /> 教育资源管理
          </span>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="📚 教育资源库" key="resources">
            <ResourceLibrary />
          </TabPane>
          <TabPane tab="📦 主题包管理" key="packages">
            <ThemePackageManagement />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

// 资源库组件
const ResourceLibrary = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [form] = Form.useForm();

  // 资源类型配置
  const resourceTypes = {
    museum: { label: '博物馆', icon: '🏛️', color: '#1890ff' },
    park: { label: '主题公园', icon: '🎢', color: '#52c41a' },
    university: { label: '大学', icon: '🏫', color: '#722ed1' },
    cultural: { label: '文化场所', icon: '🎭', color: '#fa8c16' },
    nature: { label: '自然景点', icon: '🏞️', color: '#13c2c2' },
    enterprise: { label: '企业参观', icon: '🏢', color: '#595959' }
  };

  // 模拟数据
  useEffect(() => {
    const mockData = [
      { id: '001', name: '香港科学馆', type: 'museum', duration: 3, location: '尖沙咀东部', description: '常设展览参观，科学体验' },
      { id: '002', name: '香港太空馆', type: 'museum', duration: 2, location: '尖沙咀', description: '天文知识学习' },
      { id: '003', name: '海洋公园', type: 'park', duration: 6, location: '南区黄竹坑', description: '海洋生物观察' },
      { id: '004', name: '香港大学', type: 'university', duration: 2.5, location: '薄扶林', description: '校园参观交流' },
      { id: '005', name: '数码港', type: 'enterprise', duration: 2, location: '薄扶林', description: '创新科技体验' },
      { id: '006', name: '文化中心', type: 'cultural', duration: 2, location: '尖沙咀', description: '艺术文化欣赏' },
      { id: '007', name: '湿地公园', type: 'nature', duration: 3, location: '天水围', description: '生态环境学习' },
      { id: '008', name: '历史博物馆', type: 'museum', duration: 2, location: '尖沙咀', description: '历史文化了解' }
    ];
    setResources(mockData);
  }, []);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80
    },
    {
      title: '资源名称',
      dataIndex: 'name',
      render: (text, record) => {
        const type = resourceTypes[record.type];
        return (
          <span>
            <span style={{ fontSize: '16px', marginRight: 4 }}>{type?.icon}</span>
            {text}
          </span>
        );
      }
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (type) => {
        const typeConfig = resourceTypes[type];
        return (
          <Tag color={typeConfig?.color}>
            {typeConfig?.label}
          </Tag>
        );
      }
    },
    {
      title: '时长',
      dataIndex: 'duration',
      width: 80,
      render: (val) => `${val}小时`
    },
    {
      title: '地点',
      dataIndex: 'location',
      width: 120
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true
    },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          >
            编辑
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const showModal = (resource = null) => {
    setEditingResource(resource);
    if (resource) {
      form.setFieldsValue(resource);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const newResource = {
        ...values,
        id: editingResource?.id || `R${Date.now()}`
      };

      if (editingResource) {
        setResources(resources.map(r => r.id === editingResource.id ? newResource : r));
        message.success('资源更新成功');
      } else {
        setResources([...resources, newResource]);
        message.success('资源创建成功');
      }

      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个教育资源吗？',
      onOk: () => {
        setResources(resources.filter(r => r.id !== id));
        message.success('删除成功');
      }
    });
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showModal()}
        >
          新增资源
        </Button>
        <span style={{ marginLeft: 16, color: '#888' }}>
          共 {resources.length} 个教育资源
        </span>
      </div>

      <Table
        columns={columns}
        dataSource={resources}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingResource ? '编辑教育资源' : '新增教育资源'}
        visible={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="资源名称"
            rules={[{ required: true, message: '请输入资源名称' }]}
          >
            <Input placeholder="例如：香港科学馆" />
          </Form.Item>

          <Form.Item
            name="type"
            label="资源类型"
            rules={[{ required: true, message: '请选择资源类型' }]}
          >
            <Select placeholder="请选择类型">
              {Object.entries(resourceTypes).map(([key, config]) => (
                <Option key={key} value={key}>
                  {config.icon} {config.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="duration"
            label="建议时长（小时）"
            rules={[{ required: true, message: '请输入建议时长' }]}
          >
            <InputNumber min={0.5} max={12} step={0.5} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="location"
            label="地点"
            rules={[{ required: true, message: '请输入地点' }]}
          >
            <Input placeholder="例如：尖沙咀东部" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="简要描述资源特点" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// 主题包管理组件
const ThemePackageManagement = () => {
  const [packages, setPackages] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [viewingPackage, setViewingPackage] = useState(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [form] = Form.useForm();

  // 模拟资源数据
  const allResources = [
    { id: '001', name: '香港科学馆', type: 'museum', duration: 3, location: '尖沙咀东部', icon: '🏛️' },
    { id: '002', name: '香港太空馆', type: 'museum', duration: 2, location: '尖沙咀', icon: '🌌' },
    { id: '003', name: '海洋公园', type: 'park', duration: 6, location: '南区黄竹坑', icon: '🐬' },
    { id: '004', name: '香港大学', type: 'university', duration: 2.5, location: '薄扶林', icon: '🎓' },
    { id: '005', name: '数码港', type: 'enterprise', duration: 2, location: '薄扶林', icon: '💻' },
    { id: '006', name: '文化中心', type: 'cultural', duration: 2, location: '尖沙咀', icon: '🎭' },
    { id: '007', name: '湿地公园', type: 'nature', duration: 3, location: '天水围', icon: '🦜' },
    { id: '008', name: '历史博物馆', type: 'museum', duration: 2, location: '尖沙咀', icon: '🏺' }
  ];

  // 模拟数据
  useEffect(() => {
    const mockData = [
      {
        id: 'theme_001',
        name: '科技探索之旅',
        description: '专注科技创新教育',
        resources: ['001', '002', '005'],
        resourceCount: 3,
        totalDuration: 7,
        usageCount: 5,
        createdAt: '2024-01-15',
        tags: ['科技', 'STEM', '互动体验']
      },
      {
        id: 'theme_002',
        name: '文化深度游',
        description: '传统与现代文化体验',
        resources: ['006', '008'],
        resourceCount: 2,
        totalDuration: 4,
        usageCount: 3,
        createdAt: '2024-01-20',
        tags: ['文化', '艺术', '历史']
      },
      {
        id: 'theme_003',
        name: '自然生态探索',
        description: '环保与生态教育',
        resources: ['003', '007'],
        resourceCount: 2,
        totalDuration: 9,
        usageCount: 2,
        createdAt: '2024-02-01',
        tags: ['自然', '生态', '环保']
      },
      {
        id: 'theme_004',
        name: '学术交流体验',
        description: '高校参观与学术体验',
        resources: ['004'],
        resourceCount: 1,
        totalDuration: 2.5,
        usageCount: 1,
        createdAt: '2024-02-10',
        tags: ['学术', '高校', '交流']
      }
    ];
    setPackages(mockData);
    setResources(allResources);
  }, []);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 100
    },
    {
      title: '包名称',
      dataIndex: 'name',
      render: (text) => (
        <span>
          <AppstoreOutlined style={{ marginRight: 4, color: '#1890ff' }} />
          <strong>{text}</strong>
        </span>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 200,
      render: (tags) => (
        <span>
          {tags?.map(tag => (
            <Tag key={tag} color="blue" style={{ marginBottom: 4 }}>
              {tag}
            </Tag>
          ))}
        </span>
      )
    },
    {
      title: '包含资源',
      dataIndex: 'resourceCount',
      width: 100,
      render: (val) => (
        <Tag color="blue">{val} 个</Tag>
      )
    },
    {
      title: '总时长',
      dataIndex: 'totalDuration',
      width: 100,
      render: (val) => (
        <Tag color="green">{val} 小时</Tag>
      )
    },
    {
      title: '使用次数',
      dataIndex: 'usageCount',
      width: 100,
      render: (val) => (
        <span style={{ color: val > 3 ? '#52c41a' : '#888' }}>
          {val} 次
        </span>
      )
    },
    {
      title: '操作',
      width: 250,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type="link"
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={() => handleCopy(record)}
          >
            复制
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const handleViewDetail = (packageItem) => {
    setViewingPackage(packageItem);
    setDetailModalVisible(true);
  };

  const handleEdit = (packageItem) => {
    setEditingPackage(packageItem);
    form.setFieldsValue({
      ...packageItem,
      resources: packageItem.resources || []
    });
    setSelectedResourceIds(packageItem.resources || []);
    setModalVisible(true);
  };

  const handleCopy = (packageItem) => {
    const newPackage = {
      ...packageItem,
      id: `theme_${Date.now()}`,
      name: `${packageItem.name} (副本)`,
      usageCount: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setPackages([...packages, newPackage]);
    message.success('复制成功');
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个主题包吗？',
      onOk: () => {
        setPackages(packages.filter(p => p.id !== id));
        message.success('删除成功');
      }
    });
  };

  const showCreateModal = () => {
    setEditingPackage(null);
    form.resetFields();
    setSelectedResourceIds([]);
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const selectedResources = resources.filter(r => selectedResourceIds.includes(r.id));
      const totalDuration = selectedResources.reduce((sum, r) => sum + r.duration, 0);

      const newPackage = {
        ...values,
        id: editingPackage?.id || `theme_${Date.now()}`,
        resources: selectedResourceIds,
        resourceCount: selectedResourceIds.length,
        totalDuration,
        usageCount: editingPackage?.usageCount || 0,
        createdAt: editingPackage?.createdAt || new Date().toISOString().split('T')[0]
      };

      if (editingPackage) {
        setPackages(packages.map(p => p.id === editingPackage.id ? newPackage : p));
        message.success('主题包更新成功');
      } else {
        setPackages([...packages, newPackage]);
        message.success('主题包创建成功');
      }

      setModalVisible(false);
      form.resetFields();
      setSelectedResourceIds([]);
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const handleResourceSelect = (resourceId) => {
    setSelectedResourceIds(prev => {
      if (prev.includes(resourceId)) {
        return prev.filter(id => id !== resourceId);
      }
      return [...prev, resourceId];
    });
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={showCreateModal}
        >
          创建新包
        </Button>
        <span style={{ marginLeft: 16, color: '#888' }}>
          共 {packages.length} 个主题包
        </span>
      </div>

      <Table
        columns={columns}
        dataSource={packages}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 详情弹窗 */}
      <Modal
        title={
          <span>
            <AppstoreOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            主题包详情
          </span>
        }
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              setDetailModalVisible(false);
              handleEdit(viewingPackage);
            }}
          >
            编辑
          </Button>
        ]}
        width={800}
      >
        {viewingPackage && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h3>{viewingPackage.name}</h3>
              <p style={{ color: '#666' }}>{viewingPackage.description}</p>
              <div style={{ marginTop: 10 }}>
                {viewingPackage.tags?.map(tag => (
                  <Tag key={tag} color="blue" style={{ marginBottom: 8 }}>
                    {tag}
                  </Tag>
                ))}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginBottom: 20
            }}>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                    {viewingPackage.resourceCount}
                  </div>
                  <div style={{ color: '#666', marginTop: 4 }}>包含资源</div>
                </div>
              </Card>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                    {viewingPackage.totalDuration}h
                  </div>
                  <div style={{ color: '#666', marginTop: 4 }}>总时长</div>
                </div>
              </Card>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fa8c16' }}>
                    {viewingPackage.usageCount}
                  </div>
                  <div style={{ color: '#666', marginTop: 4 }}>使用次数</div>
                </div>
              </Card>
            </div>

            <div>
              <h4>包含的教育资源</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {viewingPackage.resources?.map(resourceId => {
                  const resource = resources.find(r => r.id === resourceId);
                  if (!resource) return null;
                  return (
                    <Card
                      key={resource.id}
                      size="small"
                      style={{ borderLeft: '3px solid #1890ff' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: 20, marginRight: 8 }}>
                          {resource.icon}
                        </span>
                        <div style={{ flex: 1 }}>
                          <strong>{resource.name}</strong>
                          <div style={{ fontSize: 12, color: '#666' }}>
                            {resource.location} · {resource.duration}小时
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 编辑/创建弹窗 */}
      <Modal
        title={editingPackage ? '编辑主题包' : '创建主题包'}
        visible={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setSelectedResourceIds([]);
        }}
        width={900}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="主题包名称"
            rules={[{ required: true, message: '请输入主题包名称' }]}
          >
            <Input placeholder="例如：科技探���之旅" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <TextArea rows={2} placeholder="简要描述主题包的特点和目标" />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
          >
            <Select
              mode="tags"
              placeholder="添加标签（按回车确认）"
              style={{ width: '100%' }}
            >
              <Option value="科技">科技</Option>
              <Option value="文化">文化</Option>
              <Option value="自然">自然</Option>
              <Option value="历史">历史</Option>
              <Option value="艺术">艺术</Option>
              <Option value="STEM">STEM</Option>
            </Select>
          </Form.Item>

          <Form.Item label="选择教育资源">
            <div style={{
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              padding: 12,
              maxHeight: 300,
              overflowY: 'auto'
            }}>
              <div style={{ marginBottom: 8, color: '#666' }}>
                已选择 {selectedResourceIds.length} 个资源，
                总时长 {resources
                  .filter(r => selectedResourceIds.includes(r.id))
                  .reduce((sum, r) => sum + r.duration, 0)} 小时
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {allResources.map(resource => (
                  <Card
                    key={resource.id}
                    size="small"
                    style={{
                      cursor: 'pointer',
                      border: selectedResourceIds.includes(resource.id)
                        ? '2px solid #1890ff'
                        : '1px solid #d9d9d9',
                      background: selectedResourceIds.includes(resource.id)
                        ? '#e6f7ff'
                        : '#fff'
                    }}
                    onClick={() => handleResourceSelect(resource.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 18, marginRight: 8 }}>
                        {resource.icon}
                      </span>
                      <div style={{ flex: 1 }}>
                        <strong>{resource.name}</strong>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          {resource.location} · {resource.duration}小时
                        </div>
                      </div>
                      {selectedResourceIds.includes(resource.id) && (
                        <span style={{ color: '#1890ff', fontSize: 16 }}>✓</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default EducationalResourceManagement;