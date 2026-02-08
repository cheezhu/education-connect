import React, { useEffect, useMemo, useState } from 'react';
import { Form, Input, Modal, Select, message } from 'antd';
import api from '../../../../services/api';
import MemberRow from './MemberRow';

const safeText = (value) => (value === undefined || value === null ? '' : String(value));

const ROLE_ORDER = {
  TEACHER: 0,
  STUDENT: 1,
  PARENT: 2,
  OTHER: 3
};

const normalizeRoleKey = (value) => {
  const raw = safeText(value).trim();
  if (!raw) return 'OTHER';
  if (raw.includes('老师') || raw.toLowerCase().includes('teacher')) return 'TEACHER';
  if (raw.includes('学生') || raw.toLowerCase().includes('student')) return 'STUDENT';
  if (raw.includes('家长') || raw.toLowerCase().includes('parent')) return 'PARENT';
  return 'OTHER';
};

const sortMembers = (list = []) => (
  [...list].sort((a, b) => {
    const roleA = normalizeRoleKey(a?.role);
    const roleB = normalizeRoleKey(b?.role);
    const orderA = ROLE_ORDER[roleA] ?? 99;
    const orderB = ROLE_ORDER[roleB] ?? 99;
    if (orderA !== orderB) return orderA - orderB;

    const nameA = safeText(a?.name).trim();
    const nameB = safeText(b?.name).trim();
    if (nameA !== nameB) return nameA.localeCompare(nameB, 'zh-Hans-CN');
    return Number(a?.id ?? 0) - Number(b?.id ?? 0);
  })
);

const MembersView = ({ groupId }) => {
  const [loading, setLoading] = useState(false);
  const [memberList, setMemberList] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form] = Form.useForm();

  const loadMembers = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const response = await api.get(`/groups/${groupId}/members`);
      setMemberList(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('加载成员失败');
      setMemberList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    setModalOpen(false);
    setEditingMember(null);
    form.resetFields();
  }, [groupId]);

  const sortedMembers = useMemo(() => sortMembers(memberList), [memberList]);

  const openCreate = () => {
    setEditingMember(null);
    setModalOpen(true);
    form.resetFields();
    form.setFieldsValue({ role: '学生', gender: '男' });
  };

  const openEdit = (member) => {
    if (!member) return;
    setEditingMember(member);
    setModalOpen(true);
    form.resetFields();
    form.setFieldsValue({
      name: member.name ?? '',
      role: member.role ?? '',
      gender: member.gender ?? '',
      phone: member.phone ?? '',
      age: member.age ?? null,
      id_number: member.id_number ?? '',
      parent_phone: member.parent_phone ?? '',
      room_number: member.room_number ?? '',
      special_needs: member.special_needs ?? '',
      emergency_contact: member.emergency_contact ?? ''
    });
  };

  const handleSave = async () => {
    if (!groupId) return;
    try {
      const values = await form.validateFields();
      if (editingMember?.id) {
        await api.put(`/groups/${groupId}/members/${editingMember.id}`, values);
        message.success('已更新成员', 1);
      } else {
        await api.post(`/groups/${groupId}/members`, values);
        message.success('已添加成员', 1);
      }

      setModalOpen(false);
      setEditingMember(null);
      form.resetFields();
      await loadMembers();
    } catch (error) {
      if (error?.errorFields) return;
      message.error('保存失败');
    }
  };

  const handleDelete = (member) => {
    if (!groupId || !member?.id) return;
    Modal.confirm({
      title: `删除成员：${safeText(member.name || member.id)}`,
      content: '删除后无法恢复。',
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.delete(`/groups/${groupId}/members/${member.id}`);
          message.success('已删除', 1);
          await loadMembers();
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  if (!groupId) {
    return <div className="empty-state">请选择团组</div>;
  }

  return (
    <div className="members-view">
      <div className="roster-header">
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          团组花名册 ({sortedMembers.length}人)
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="roster-btn"
            onClick={() => message.info('批量导入功能开发中')}
          >
            批量导入
          </button>
          <button
            type="button"
            className="roster-btn primary"
            onClick={openCreate}
          >
            + 添加人员
          </button>
        </div>
      </div>

      <div className="member-list" aria-busy={loading ? 'true' : 'false'}>
        <div className="list-head">
          <div className="col-id-index">#</div>
          <div>姓名</div>
          <div>身份</div>
          <div>性别</div>
          <div>联系电话</div>
          <div>备注/标签</div>
          <div style={{ textAlign: 'right' }}>操作</div>
        </div>

        {loading ? (
          <div style={{ padding: 16, color: '#9ca3af' }}>加载中...</div>
        ) : sortedMembers.length === 0 ? (
          <div style={{ padding: 16, color: '#9ca3af' }}>暂无成员</div>
        ) : (
          sortedMembers.map((member, index) => (
            <MemberRow
              key={member?.id ?? `${member?.name}-${index}`}
              index={index}
              member={member}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <Modal
        title={editingMember ? '编辑成员' : '添加成员'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => {
          setModalOpen(false);
          setEditingMember(null);
          form.resetFields();
        }}
        okText={editingMember ? '保存' : '添加'}
        cancelText="取消"
        width={640}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item
              label="姓名"
              name="name"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input placeholder="请输入姓名" />
            </Form.Item>

            <Form.Item label="身份" name="role">
              <Select
                options={[
                  { value: '老师', label: '老师' },
                  { value: '学生', label: '学生' },
                  { value: '家长', label: '家长' }
                ]}
              />
            </Form.Item>

            <Form.Item label="性别" name="gender">
              <Select
                options={[
                  { value: '男', label: '男' },
                  { value: '女', label: '女' }
                ]}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item label="联系电话" name="phone">
              <Input placeholder="手机号" />
            </Form.Item>
            <Form.Item label="年龄" name="age">
              <Input type="number" placeholder="可选" />
            </Form.Item>
            <Form.Item label="房间号" name="room_number">
              <Input placeholder="如：301" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="身份证号" name="id_number">
              <Input placeholder="可选" />
            </Form.Item>
            <Form.Item label="家长电话" name="parent_phone">
              <Input placeholder="可选" />
            </Form.Item>
          </div>

          <Form.Item label="紧急联系人" name="emergency_contact">
            <Input placeholder="可选" />
          </Form.Item>

          <Form.Item label="备注/特殊需求" name="special_needs">
            <Input.TextArea rows={3} placeholder="如：花生过敏 / 清真 / 需要随身药物等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MembersView;

