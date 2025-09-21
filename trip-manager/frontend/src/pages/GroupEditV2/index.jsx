import React, { useState, useEffect, useRef } from 'react';
import { Button, Spin, message } from 'antd';
import {
  ArrowLeftOutlined,
  TeamOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import GroupInfoSimple from './GroupInfoSimple';
import ScheduleManagement from './ScheduleManagement';
import api from '../../services/api';
import dayjs from 'dayjs';
import './GroupEditV2.css';

const GroupEditV2 = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('info');
  const [groupData, setGroupData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  // Removed auto-save logic

  // 是否为新建模式
  const isNew = id === 'new';

  // 加载团组数据
  const fetchGroupData = async () => {
    if (isNew) {
      // 新建团组时的默认数据
      setGroupData({
        name: '',
        type: 'primary',
        studentCount: 40,
        teacherCount: 4,
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().add(4, 'day').format('YYYY-MM-DD'),
        duration: 5,
        color: '#1890ff',
        status: '准备中',
        contactPerson: '',
        contactPhone: '',
        emergencyContact: '',
        emergencyPhone: '',
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
        contactPerson: group.contactPerson || '',
        contactPhone: group.contactPhone || '',
        emergencyContact: group.emergencyContact || '',
        emergencyPhone: group.emergencyPhone || '',
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

  // Removed auto-save function - now using manual save only

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
        studentCount: groupData.studentCount,
        teacherCount: groupData.teacherCount,
        startDate: groupData.startDate,
        endDate: groupData.endDate,
        duration: groupData.duration,
        color: groupData.color,
        status: groupData.status,
        contactPerson: groupData.contactPerson,
        contactPhone: groupData.contactPhone,
        emergencyContact: groupData.emergencyContact,
        emergencyPhone: groupData.emergencyPhone,
        tags: groupData.tags,
        notes: groupData.notes,
        themePackageId: groupData.themePackageId  // 添加主题包ID
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
    setGroupData(prev => {
      const updated = {
        ...prev,
        [field]: value
      };

      // 自动计算天数
      if (field === 'startDate' || field === 'endDate') {
        if (updated.startDate && updated.endDate) {
          updated.duration = dayjs(updated.endDate).diff(dayjs(updated.startDate), 'day') + 1;
        }
      }

      return updated;
    });
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

  // Removed auto-save cleanup

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
      {/* 左右布局容器 - 无顶部导航 */}
      <div className="edit-content-layout-full">
        {/* 左侧导航栏 */}
        <div className="sidebar-nav">
          {/* 顶部返回和标题区域 */}
          <div className="sidebar-header">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/groups/v2')}
              type="text"
              size="small"
              block
            >
              返回列表
            </Button>
            <div className="group-name">
              {isNew ? '创建团组' : groupData.name || '编辑团组'}
            </div>
          </div>

          {/* 导航标签 */}
          <div className="nav-tabs">
            <div
              className={`tab-item ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
              title="团组信息"
            >
              <TeamOutlined className="tab-icon" />
              <span className="tab-text">团组信息</span>
            </div>
            <div
              className={`tab-item ${activeTab === 'schedule' ? 'active' : ''} ${isNew ? 'disabled' : ''}`}
              onClick={() => !isNew && setActiveTab('schedule')}
              title={isNew ? '保存团组后可编辑' : '日程安排'}
            >
              <CalendarOutlined className="tab-icon" />
              <span className="tab-text">日历详情</span>
            </div>
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="main-content">
          {activeTab === 'info' && (
            <GroupInfoSimple
              groupData={groupData}
              onUpdate={updateGroupData}
              handleSave={handleSave}
              isNew={isNew}
              saving={saving}
            />
          )}

          {activeTab === 'schedule' && !isNew && (
            <ScheduleManagement
              groupId={id}
              groupData={groupData}
              schedules={groupData.schedules}
              onUpdate={(schedules) => {
                updateGroupData('schedules', schedules);
                // 日程已经在组件内部处理自动保存
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupEditV2;