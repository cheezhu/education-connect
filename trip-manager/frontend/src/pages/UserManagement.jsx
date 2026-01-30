import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Table, message } from 'antd';
import api from '../services/api';

const { Option } = Select;

const ROLE_OPTIONS = [
  { label: '管理员', value: 'admin' },
  { label: '编辑者', value: 'editor' },
  { label: '查看者', value: 'viewer' }
];

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

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
      render: (role) => ROLE_OPTIONS.find(item => item.value === role)?.label || role
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
