import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tag,
  Popconfirm,
  Upload,
  Card,
  Row,
  Col,
  Statistic
} from 'antd';
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

const { Option } = Select;
const { Search } = Input;

const MemberManagement = ({ groupId, groupData, members, onUpdate }) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [form] = Form.useForm();

  // 模拟数据（实际应从API获取）
  const [memberList, setMemberList] = useState([
    {
      id: 1,
      name: '张小明',
      gender: '男',
      age: 12,
      id_number: '440106201X****1234',
      phone: '138****8001',
      parent_phone: '138****8002',
      role: '学生',
      room_number: '301',
      special_needs: '花生过敏',
      emergencyContact: '张妈妈'
    },
    {
      id: 2,
      name: '李老师',
      gender: '女',
      age: 35,
      id_number: '440106198X****5678',
      phone: '139****9001',
      parent_phone: '',
      role: '老师',
      room_number: '501',
      special_needs: '',
      emergencyContact: '李先生'
    }
  ]);

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
      dataIndex: 'emergencyContact',
      key: 'emergencyContact',
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
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(searchLower) ||
        m.phone.includes(searchText) ||
        m.id_number.includes(searchText)
      );
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
        // 编辑现有成员
        const updatedList = memberList.map(m =>
          m.id === editingMember.id ? { ...m, ...values } : m
        );
        setMemberList(updatedList);
        message.success('成员信息更新成功');
      } else {
        // 添加新成员
        const newMember = {
          ...values,
          id: Date.now()
        };
        setMemberList([...memberList, newMember]);
        message.success('成员添加成功');
      }

      setModalVisible(false);
      form.resetFields();
      onUpdate(memberList); // 通知父组件更新
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 删除成员
  const handleDelete = (id) => {
    const updatedList = memberList.filter(m => m.id !== id);
    setMemberList(updatedList);
    message.success('删除成功');
    onUpdate(updatedList);
  };

  // 批量删除
  const handleBatchDelete = () => {
    const updatedList = memberList.filter(m => !selectedRowKeys.includes(m.id));
    setMemberList(updatedList);
    setSelectedRowKeys([]);
    message.success(`删除了 ${selectedRowKeys.length} 个成员`);
    onUpdate(updatedList);
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
              >
                添加成员
              </Button>
              <Upload
                accept=".xlsx,.xls"
                showUploadList={false}
                beforeUpload={handleImport}
              >
                <Button icon={<UploadOutlined />}>批量导入</Button>
              </Upload>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
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
                name="emergencyContact"
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