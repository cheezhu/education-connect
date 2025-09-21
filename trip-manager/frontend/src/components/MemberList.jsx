import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, DatePicker, message, Space, Popconfirm, Tag, Badge, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, TeamOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

function MemberList({ groupId, groupName, editMode = true }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form] = Form.useForm();

  // 加载团员列表
  const loadMembers = async () => {
    if (!groupId) return;

    setLoading(true);
    try {
      const response = await api.get(`/groups/${groupId}/members`);
      setMembers(response.data);
    } catch (error) {
      message.error('加载团员列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [groupId]);

  // 显示编辑对话框
  const showModal = (member = null) => {
    setEditingMember(member);
    setModalVisible(true);

    if (member) {
      form.setFieldsValue({
        ...member,
        permitExpiry: member.permitExpiry ? dayjs(member.permitExpiry) : null
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        role: 'student'
      });
    }
  };

  // 保存团员
  const handleSave = async (values) => {
    try {
      const data = {
        ...values,
        permitExpiry: values.permitExpiry ? values.permitExpiry.format('YYYY-MM-DD') : null
      };

      if (editingMember) {
        await api.put(`/members/${editingMember.id}`, data);
        message.success('团员更新成功');
      } else {
        await api.post(`/groups/${groupId}/members`, data);
        message.success('团员添加成功');
      }

      setModalVisible(false);
      form.resetFields();
      loadMembers();
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 删除团员
  const handleDelete = async (member) => {
    try {
      await api.delete(`/members/${member.id}`);
      message.success('团员删除成功');
      loadMembers();
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 批量添加测试数据
  const handleBatchAdd = async () => {
    Modal.confirm({
      title: '批量添加测试团员',
      content: '确定要添加40名学生和4名老师的测试数据吗？',
      onOk: async () => {
        setLoading(true);
        try {
          const testMembers = [];

          // 添加老师
          for (let i = 1; i <= 4; i++) {
            testMembers.push({
              name: `李老师${i}`,
              school: groupName || '深圳实验学校',
              role: 'teacher',
              idCard: `44030119800101000${i}`,
              permitNumber: `H1234567${i}`,
              permitExpiry: dayjs().add(1, 'year').format('YYYY-MM-DD'),
              englishName: `Teacher Li ${i}`,
              roomNumber: `T10${i}`,
              notes: '带队老师'
            });
          }

          // 添加学生
          for (let i = 1; i <= 40; i++) {
            const num = i.toString().padStart(2, '0');
            testMembers.push({
              name: `学生${num}`,
              school: groupName || '深圳实验学校',
              role: 'student',
              idCard: `4403012010010100${num}`,
              permitNumber: `S1234567${num}`,
              permitExpiry: dayjs().add(6, 'months').format('YYYY-MM-DD'),
              englishName: `Student ${num}`,
              roomNumber: `${Math.floor((i - 1) / 2 + 201)}`,
              notes: i % 10 === 1 ? '组长' : ''
            });
          }

          await api.post(`/groups/${groupId}/members/batch`, { members: testMembers });
          message.success('成功添加44名团员测试数据');
          loadMembers();
        } catch (error) {
          message.error('批量添加失败');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 导出团员名单
  const handleExport = () => {
    const csvContent = [
      ['姓名', '学校', '身份', '身份证号', '港澳通行证', '签注有效期', '英文姓名', '房间号', '备注'].join(','),
      ...members.map(m => [
        m.name,
        m.school || '',
        m.role === 'teacher' ? '老师' : '学生',
        m.idCard || '',
        m.permitNumber || '',
        m.permitExpiry || '',
        m.englishName || '',
        m.roomNumber || '',
        m.notes || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${groupName}_团员名单_${dayjs().format('YYYYMMDD')}.csv`;
    link.click();
  };

  const columns = [
    {
      title: '序号',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 100,
      render: (text, record) => (
        <Space>
          {record.role === 'teacher' ? <UserOutlined style={{ color: '#1890ff' }} /> : <TeamOutlined />}
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: '学校',
      dataIndex: 'school',
      width: 150,
      ellipsis: true
    },
    {
      title: '身份',
      dataIndex: 'role',
      width: 80,
      render: role => (
        <Tag color={role === 'teacher' ? 'blue' : 'green'}>
          {role === 'teacher' ? '老师' : '学生'}
        </Tag>
      )
    },
    {
      title: '身份证号',
      dataIndex: 'idCard',
      width: 180,
      ellipsis: true
    },
    {
      title: '港澳通行证',
      dataIndex: 'permitNumber',
      width: 120
    },
    {
      title: '签注有效期',
      dataIndex: 'permitExpiry',
      width: 110,
      render: date => {
        if (!date) return '-';
        const expiry = dayjs(date);
        const today = dayjs();
        const daysLeft = expiry.diff(today, 'day');

        if (daysLeft < 0) {
          return <Badge status="error" text={date} />;
        } else if (daysLeft < 30) {
          return <Badge status="warning" text={date} />;
        } else {
          return <Badge status="success" text={date} />;
        }
      }
    },
    {
      title: '英文姓名',
      dataIndex: 'englishName',
      width: 120,
      ellipsis: true
    },
    {
      title: '房间号',
      dataIndex: 'roomNumber',
      width: 80
    },
    {
      title: '备注',
      dataIndex: 'notes',
      width: 100,
      ellipsis: true,
      render: text => text ? <Tooltip title={text}>{text}</Tooltip> : '-'
    },
    {
      title: '操作',
      fixed: 'right',
      width: 100,
      render: (_, record) => editMode && (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          />
          <Popconfirm
            title="确定删除此团员？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 统计信息
  const teacherCount = members.filter(m => m.role === 'teacher').length;
  const studentCount = members.filter(m => m.role === 'student').length;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <h3 style={{ margin: 0 }}>团员名单</h3>
          <Tag color="blue">老师: {teacherCount}人</Tag>
          <Tag color="green">学生: {studentCount}人</Tag>
          <Tag>总计: {members.length}人</Tag>
        </Space>

        {editMode && (
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出名单
            </Button>
            <Button icon={<UploadOutlined />} onClick={handleBatchAdd}>
              批量添加测试数据
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
              添加团员
            </Button>
          </Space>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={members}
        loading={loading}
        rowKey="id"
        size="small"
        scroll={{ x: 1400 }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: total => `共 ${total} 条`
        }}
      />

      <Modal
        title={editingMember ? '编辑团员' : '添加团员'}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item
            name="school"
            label="学校"
          >
            <Input placeholder="请输入学校名称" />
          </Form.Item>

          <Form.Item
            name="role"
            label="身份"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="student">学生</Option>
              <Option value="teacher">老师</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="idCard"
            label="身份证号码"
          >
            <Input placeholder="请输入身份证号码" />
          </Form.Item>

          <Form.Item
            name="permitNumber"
            label="港澳通行证号码"
          >
            <Input placeholder="请输入港澳通行证号码" />
          </Form.Item>

          <Form.Item
            name="permitExpiry"
            label="港澳签注有效期"
          >
            <DatePicker style={{ width: '100%' }} placeholder="选择有效期" />
          </Form.Item>

          <Form.Item
            name="englishName"
            label="英文姓名"
          >
            <Input placeholder="请输入英文姓名" />
          </Form.Item>

          <Form.Item
            name="roomNumber"
            label="房间号码"
          >
            <Input placeholder="请输入房间号码" />
          </Form.Item>

          <Form.Item
            name="notes"
            label="备注"
          >
            <Input.TextArea rows={2} placeholder="请输入备注信息" />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default MemberList;