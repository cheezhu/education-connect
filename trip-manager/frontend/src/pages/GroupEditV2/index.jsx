import React, { useState, useEffect } from 'react';
import { Card, Tabs, Button, Space, Spin, message, Breadcrumb } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, ExportOutlined } from '@ant-design/icons';
import { useParams, useNavigate, Link } from 'react-router-dom';
import GroupOverview from './GroupOverview';
import MemberManagement from './MemberManagement';
import ScheduleManagement from './ScheduleManagement';
import api from '../../services/api';
import dayjs from 'dayjs';
import './GroupEditV2.css';

const { TabPane } = Tabs;

const GroupEditV2 = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [groupData, setGroupData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 是否为新建模式
  const isNew = id === 'new';

  // 加载团组数据
  const fetchGroupData = async () => {
    if (isNew) {
      // 新建团组时的默认数据
      setGroupData({
        name: '',
        type: 'primary',
        student_count: 40,
        teacher_count: 4,
        start_date: dayjs().format('YYYY-MM-DD'),
        end_date: dayjs().add(4, 'day').format('YYYY-MM-DD'),
        duration: 5,
        color: '#1890ff',
        status: '准备中',
        contact_person: '',
        contact_phone: '',
        emergency_contact: '',
        emergency_phone: '',
        tags: [],
        notes: '',
        members: [],
        schedules: []
      });
      return;
    }

    setLoading(true);
    try {
      // 使用独立的获取单个团组接口
      const response = await api.get(`/groups/${id}`);
      const group = response.data;

      // 扩展V1数据为V2格式
      const enhancedData = {
        ...group,
        status: group.status || '准备中',
        contact_person: group.contact_person || '',
        contact_phone: group.contact_phone || '',
        emergency_contact: group.emergency_contact || '',
        emergency_phone: group.emergency_phone || '',
        tags: group.tags || [],
        notes: group.notes || '',
        members: [], // TODO: 加载团员数据
        schedules: [] // TODO: 加载日程数据
      };

      setGroupData(enhancedData);
    } catch (error) {
      message.error('加载团组数据失败');
      console.error('Error fetching group:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupData();
  }, [id]);

  // 保存团组数据
  const handleSave = async () => {
    if (!groupData.name) {
      message.error('请填写团组名称');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        name: groupData.name,
        type: groupData.type,
        student_count: groupData.student_count,
        teacher_count: groupData.teacher_count,
        start_date: groupData.start_date,
        end_date: groupData.end_date,
        duration: groupData.duration,
        color: groupData.color,
        status: groupData.status,
        contact_person: groupData.contact_person,
        contact_phone: groupData.contact_phone,
        emergency_contact: groupData.emergency_contact,
        emergency_phone: groupData.emergency_phone,
        tags: groupData.tags,
        notes: groupData.notes
      };

      if (isNew) {
        const response = await api.post('/groups', dataToSave);
        message.success('团组创建成功');
        navigate(`/groups/v2/edit/${response.data.id}`);
      } else {
        await api.put(`/groups/${id}`, dataToSave);
        message.success('保存成功');
      }

      setHasChanges(false);
    } catch (error) {
      message.error('保存失败');
      console.error('Error saving group:', error);
    } finally {
      setSaving(false);
    }
  };

  // 更新团组数据
  const updateGroupData = (field, value) => {
    setGroupData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  // 批量更新团组数据
  const updateMultipleFields = (updates) => {
    setGroupData(prev => ({
      ...prev,
      ...updates
    }));
    setHasChanges(true);
  };

  // 监听页面离开事件
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '您有未保存的更改，确定要离开吗？';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  if (loading) {
    return (
      <div className="group-edit-v2-loading">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!groupData) {
    return null;
  }

  return (
    <div className="group-edit-v2">
      {/* 顶部导航栏 */}
      <div className="edit-header">
        <div className="header-left">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              if (hasChanges) {
                if (window.confirm('您有未保存的更改，确定要离开吗？')) {
                  navigate('/groups/v2');
                }
              } else {
                navigate('/groups/v2');
              }
            }}
          >
            返回团组列表
          </Button>

          <Breadcrumb separator=">" style={{ marginLeft: 16 }}>
            <Breadcrumb.Item>
              <Link to="/groups/v2">团组管理 V2</Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item>
              {isNew ? '创建团组' : groupData.name || '编辑团组'}
            </Breadcrumb.Item>
          </Breadcrumb>
        </div>

        <div className="header-right">
          <Space>
            {hasChanges && (
              <span style={{ color: '#ff4d4f', fontSize: '12px' }}>
                有未保存的更改
              </span>
            )}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              保存
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => message.info('导出功能开发中')}
            >
              导出
            </Button>
          </Space>
        </div>
      </div>

      {/* 主内容区 */}
      <Card className="edit-content">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          tabBarStyle={{ marginBottom: 24 }}
        >
          <TabPane tab="团组概览" key="overview">
            <GroupOverview
              data={groupData}
              onUpdate={updateGroupData}
              onMultipleUpdate={updateMultipleFields}
              isNew={isNew}
            />
          </TabPane>

          <TabPane tab="团员管理" key="members" disabled={isNew}>
            <MemberManagement
              groupId={id}
              groupData={groupData}
              members={groupData.members}
              onUpdate={(members) => updateGroupData('members', members)}
            />
          </TabPane>

          <TabPane tab="日程安排" key="schedule" disabled={isNew}>
            <ScheduleManagement
              groupId={id}
              groupData={groupData}
              schedules={groupData.schedules}
              onUpdate={(schedules) => updateGroupData('schedules', schedules)}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default GroupEditV2;