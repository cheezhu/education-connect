import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Table, Tag, Typography, message } from 'antd';
import api from '../services/api';

const { Text } = Typography;

const ROLE_OPTIONS = [
  {
    label: '管理员',
    value: 'admin',
    color: 'red',
    description: '可管理用户与系统配置，并可新增、编辑、删除全部业务数据。'
  },
  {
    label: '编辑者',
    value: 'editor',
    color: 'blue',
    description: '可新增和编辑团组、日历、资源等业务数据；不可使用行程设计器、系统配置与用户管理。'
  },
  {
    label: '查看者',
    value: 'viewer',
    color: 'default',
    description: '仅可查看数据，不可新增、编辑或删除。'
  }
];

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
const BEIJING_TIMEZONE = 'Asia/Shanghai';
const BEIJING_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: BEIJING_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

const toUtcDate = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // SQLite CURRENT_TIMESTAMP format is "YYYY-MM-DD HH:mm:ss" in UTC.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw;

  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
};

const parseDateMs = (value) => {
  const date = toUtcDate(value);
  if (!date) return NaN;
  return date.getTime();
};

const formatDateTime = (value) => {
  const date = toUtcDate(value);
  if (!date) return value ? String(value) : '从未登录';
  return `${BEIJING_FORMATTER.format(date)} GMT+8`;
};

const isOnlineRecently = (value) => {
  const parsed = parseDateMs(value);
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed <= ONLINE_THRESHOLD_MS;
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  const selectedRole = Form.useWatch('role', form);

  const getRoleMeta = (role) => ROLE_OPTIONS.find((item) => item.value === role);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users');
      setUsers(response.data || []);
    } catch (error) {
      message.error('加载用户失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreate = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ role: 'viewer' });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditingUser(record);
    form.resetFields();
    form.setFieldsValue({
      username: record.username,
      displayName: record.displayName,
      role: record.role
    });
    setModalOpen(true);
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: '确认删除用户',
      content: `确定删除用户 ${record.username} 吗？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await api.delete(`/users/${record.id}`);
          message.success('用户已删除');
          loadUsers();
        } catch (error) {
          message.error('删除用户失败');
        }
      }
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        username: values.username,
        displayName: values.displayName,
        role: values.role
      };

      if (values.password) {
        payload.password = values.password;
      }

      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
        message.success('用户已更新');
      } else {
        if (!payload.password) {
          message.error('请填写密码');
          return;
        }
        await api.post('/users', payload);
        message.success('用户已创建');
      }

      setModalOpen(false);
      loadUsers();
    } catch (error) {
      if (error?.errorFields) return;
      message.error('保存用户失败');
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username'
    },
    {
      title: '显示名',
      dataIndex: 'displayName',
      key: 'displayName'
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        const roleMeta = getRoleMeta(role);
        if (!roleMeta) return role;
        return <Tag color={roleMeta.color}>{roleMeta.label}</Tag>;
      }
    },
    {
      title: '登录状态',
      key: 'loginStatus',
      width: 180,
      render: (_, record) => {
        const online = isOnlineRecently(record.lastLogin);
        return (
          <div style={{ display: 'grid', gap: 2 }}>
            <Tag color={online ? 'green' : 'default'} style={{ width: 'fit-content', marginRight: 0 }}>
              {online ? '在线' : '离线'}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              最近登录：{formatDateTime(record.lastLogin)}
            </Text>
          </div>
        );
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button size="small" danger onClick={() => handleDelete(record)}>
            删除
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>用户管理</h3>
        <Button type="primary" onClick={openCreate}>
          新建用户
        </Button>
      </div>

      <Card
        size="small"
        title="权限说明"
        style={{ marginBottom: 12 }}
        bodyStyle={{ paddingTop: 8, paddingBottom: 8 }}
      >
        <div style={{ display: 'grid', gap: 8 }}>
          {ROLE_OPTIONS.map((role) => (
            <div
              key={role.value}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
            >
              <Tag color={role.color} style={{ marginTop: 2 }}>
                {role.label}
              </Tag>
              <Text type="secondary">{role.description}</Text>
            </div>
          ))}
        </div>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="显示名" name="displayName">
            <Input />
          </Form.Item>
          <Form.Item
            label="角色"
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
            extra={getRoleMeta(selectedRole)?.description || '请选择角色以查看权限范围'}
          >
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            extra={editingUser ? '留空则不修改密码' : null}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
