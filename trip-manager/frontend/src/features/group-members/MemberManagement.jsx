import React, { useState, useEffect } from 'react';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import message from 'antd/es/message';
import Modal from 'antd/es/modal';
import Popconfirm from 'antd/es/popconfirm';
import Row from 'antd/es/row';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Statistic from 'antd/es/statistic';
import Table from 'antd/es/table';
import Tag from 'antd/es/tag';
import Upload from 'antd/es/upload';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  UploadOutlined,
  DownloadOutlined,
  UserOutlined,
  TeamOutlined,
  ManOutlined,
  WomanOutlined
} from '@ant-design/icons';
import api from '../../services/api';

const { Option } = Select;
const { Search } = Input;
const getRequestErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || fallback
);

const MemberManagement = ({ groupId }) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const [memberList, setMemberList] = useState([]);
  const canManage = Boolean(groupId);

  const loadMembers = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const response = await api.get(`/groups/${groupId}/members`);
      setMemberList(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('加载成员数据失败');
      setMemberList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    setSelectedRowKeys([]);
    setSearchText('');
    setFilterRole('all');
  }, [groupId]);

  // 表格列配置
  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      fixed: 'left',
      render: (text, record) => (
        <Space>
          {record.gender === '男' ?
            <ManOutlined style={{ color: '#1890ff' }} /> :
            <WomanOutlined style={{ color: '#f5222d' }} />
          }
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 80,
      render: (role) => {
        const colors = {
          '学生': 'blue',
          '老师': 'green',
          '家长': 'orange'
        };
        return <Tag color={colors[role]}>{role}</Tag>;
      }
    },
    {
      title: '年龄',
      dataIndex: 'age',
      key: 'age',
      width: 60
    },
    {
      title: '身份证号',
      dataIndex: 'id_number',
      key: 'id_number',
      width: 150
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120
    },
    {
      title: '家长电话',
      dataIndex: 'parent_phone',
      key: 'parent_phone',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '房间号',
      dataIndex: 'room_number',
      key: 'room_number',
      width: 80
    },
    {
      title: '特殊需求',
      dataIndex: 'special_needs',
      key: 'special_needs',
      width: 150,
      render: (text) => text ? <Tag color="warning">{text}</Tag> : '-'
    },
    {
      title: '紧急联系人',
      dataIndex: 'emergency_contact',
      key: 'emergency_contact',
      width: 100
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该成员吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 处理搜索和筛选
  const getFilteredMembers = () => {
    let filtered = [...memberList];

    // 角色筛选
    if (filterRole !== 'all') {
      filtered = filtered.filter(m => m.role === filterRole);
    }

    // 搜索筛选
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(m => {
        const name = (m.name || '').toLowerCase();
        const phone = m.phone || '';
        const idNumber = m.id_number || '';
        return name.includes(searchLower) || phone.includes(searchText) || idNumber.includes(searchText);
      });
    }

    return filtered;
  };

  // 显示编辑弹窗
  const handleEdit = (member = null) => {
    setEditingMember(member);
    setModalVisible(true);
    if (member) {
      form.setFieldsValue(member);
    } else {
      form.resetFields();
      form.setFieldsValue({ role: '学生', gender: '男' });
    }
  };

  // 保存成员
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingMember) {
        await api.put(`/groups/${groupId}/members/${editingMember.id}`, values);
        message.success('成员信息更新成功');
      } else {
        await api.post(`/groups/${groupId}/members`, values);
        message.success('成员添加成功');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingMember(null);
      await loadMembers();
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(getRequestErrorMessage(error, '保存失败'));
    }
  };

  // 删除成员
  const handleDelete = async (id) => {
    try {
      await api.delete(`/groups/${groupId}/members/${id}`);
      message.success('删除成功');
      await loadMembers();
    } catch (error) {
      message.error(getRequestErrorMessage(error, '删除失败'));
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (!groupId) return;
    const ids = [...selectedRowKeys];
    try {
      await Promise.all(
        ids.map(id => api.delete(`/groups/${groupId}/members/${id}`))
      );
      setSelectedRowKeys([]);
      message.success(`删除了 ${ids.length} 个成员`);
      await loadMembers();
    } catch (error) {
      message.error(getRequestErrorMessage(error, '批量删除失败'));
    }
  };

  // 导入Excel
  const handleImport = (file) => {
    message.info('Excel导入功能开发中');
    return false;
  };

  // 导出Excel
  const handleExport = () => {
    message.info('Excel导出功能开发中');
  };

  // 统计数据
  const statistics = {
    total: memberList.length,
    students: memberList.filter(m => m.role === '学生').length,
    teachers: memberList.filter(m => m.role === '老师').length,
    parents: memberList.filter(m => m.role === '家长').length
  };

  if (!canManage) {
    return (
      <div style={{ padding: '24px', color: '#8c8c8c' }}>
        请先保存团组后再维护成员信息。
      </div>
    );
  }

  return (
    <div className="member-management">
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总人数"
              value={statistics.total}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="学生"
              value={statistics.students}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="老师"
              value={statistics.teachers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="家长"
              value={statistics.parents}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Row>
          <Col span={12}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleEdit()}
                disabled={!canManage}
              >
                添加成员
              </Button>
              <Upload
                accept=".xlsx,.xls"
                showUploadList={false}
                beforeUpload={handleImport}
              >
                <Button icon={<UploadOutlined />} disabled={!canManage}>批量导入</Button>
              </Upload>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={!canManage}
              >
                导出Excel
              </Button>
              {selectedRowKeys.length > 0 && (
                <Popconfirm
                  title={`确定删除选中的 ${selectedRowKeys.length} 个成员吗？`}
                  onConfirm={handleBatchDelete}
                >
                  <Button danger>批量删除</Button>
                </Popconfirm>
              )}
            </Space>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Space>
              <Select
                style={{ width: 120 }}
                value={filterRole}
                onChange={setFilterRole}
                placeholder="筛选角色"
              >
                <Option value="all">全部角色</Option>
                <Option value="学生">学生</Option>
                <Option value="老师">老师</Option>
                <Option value="家长">家长</Option>
              </Select>
              <Search
                placeholder="搜索姓名、电话、身份证"
                style={{ width: 250 }}
                onSearch={setSearchText}
                onChange={e => !e.target.value && setSearchText('')}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 成员表格 */}
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys
        }}
        columns={columns}
        dataSource={getFilteredMembers()}
        rowKey="id"
        scroll={{ x: 1300 }}
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
      />

      {/* 编辑弹窗 */}
      <Modal
        title={editingMember ? '编辑成员' : '添加成员'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="姓名"
                name="name"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="性别"
                name="gender"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="男">男</Option>
                  <Option value="女">女</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="年龄"
                name="age"
                rules={[{ required: true, message: '请输入年龄' }]}
              >
                <Input type="number" placeholder="请输入年龄" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="身份证号"
                name="id_number"
                rules={[{ required: true, message: '请输入身份证号' }]}
              >
                <Input placeholder="请输入身份证号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="角色"
                name="role"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="学生">学生</Option>
                  <Option value="老师">老师</Option>
                  <Option value="家长">家长</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="联系电话"
                name="phone"
                rules={[{ required: true, message: '请输入联系电话' }]}
              >
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="家长电话"
                name="parent_phone"
              >
                <Input placeholder="学生填写家长电话" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="房间号"
                name="room_number"
              >
                <Input placeholder="如：301" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                label="紧急联系人"
                name="emergency_contact"
                rules={[{ required: true, message: '请输入紧急联系人' }]}
              >
                <Input placeholder="请输入紧急联系人姓名" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="特殊需求"
            name="special_needs"
          >
            <Input.TextArea
              rows={2}
              placeholder="如：食物过敏、特殊饮食要求等"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MemberManagement;
