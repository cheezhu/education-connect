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
  const autoSaveTimeoutRef = useRef(null);

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
        contact_person: group.contact_person || '',
        contact_phone: group.contact_phone || '',
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

  // 自动保存
  const handleAutoSave = async () => {
    // 清除之前的定时器
    clearTimeout(autoSaveTimeoutRef.current);

    // 延迟800ms后执行保存
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (!groupData.name || isNew) return;

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
          emergencyContact: groupData.emergencyContact,
          emergencyPhone: groupData.emergencyPhone,
          tags: groupData.tags,
          notes: groupData.notes
        };

        await api.put(`/groups/${id}`, dataToSave);
        setHasChanges(false);
      } catch (error) {
        console.error('自动保存失败:', error);
      }
    }, 800);
  };

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
        emergencyContact: groupData.emergencyContact,
        emergencyPhone: groupData.emergencyPhone,
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

  // 清理定时器
  useEffect(() => {
    return () => {
      clearTimeout(autoSaveTimeoutRef.current);
    };
  }, []);

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
              title="团组信息与成员"
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
              <span className="tab-text">日程安排</span>
            </div>
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="main-content">
          {activeTab === 'info' && (
            <div className="minimal-info-view">
              <GroupInfoSimple
                groupData={groupData}
                onUpdate={updateGroupData}
                handleAutoSave={handleAutoSave}
                isNew={isNew}
              />
            </div>
          )}>
                  <span className="card-title">团组信息</span>
                  {groupData.status && (
                    <span className={`status-badge status-${groupData.status}`}>
                      {groupData.status}
                    </span>
                  )}
                </div>

                <div className="card-body">
                  {/* 第一行：名称、类型、颜色 */}
                  <div className="info-row">
                    <div className="info-item flex-2">
                      <label>团组名称</label>
                      <input
                        type="text"
                        value={groupData.name || ''}
                        onChange={(e) => {
                          updateGroupData('name', e.target.value);
                          handleAutoSave();
                        }}
                        placeholder="输入团组名称"
                      />
                    </div>
                    <div className="info-item">
                      <label>类型</label>
                      <select
                        value={groupData.type || 'primary'}
                        onChange={(e) => {
                          updateGroupData('type', e.target.value);
                          handleAutoSave();
                        }}
                      >
                        <option value="primary">小学</option>
                        <option value="secondary">中学</option>
                      </select>
                    </div>
                    <div className="info-item color-picker">
                      <label>颜色</label>
                      <input
                        type="color"
                        value={groupData.color || '#1890ff'}
                        onChange={(e) => {
                          updateGroupData('color', e.target.value);
                          handleAutoSave();
                        }}
                      />
                    </div>
                  </div>

                  {/* 第二行：日期范围 */}
                  <div className="info-row">
                    <div className="info-item">
                      <label>开始日期</label>
                      <input
                        type="date"
                        value={groupData.start_date || ''}
                        onChange={(e) => {
                          updateGroupData('start_date', e.target.value);
                          const duration = dayjs(groupData.end_date).diff(dayjs(e.target.value), 'day') + 1;
                          updateGroupData('duration', duration);
                          handleAutoSave();
                        }}
                      />
                    </div>
                    <div className="info-item">
                      <label>结束日期</label>
                      <input
                        type="date"
                        value={groupData.end_date || ''}
                        onChange={(e) => {
                          updateGroupData('end_date', e.target.value);
                          const duration = dayjs(e.target.value).diff(dayjs(groupData.start_date), 'day') + 1;
                          updateGroupData('duration', duration);
                          handleAutoSave();
                        }}
                      />
                    </div>
                    <div className="info-item">
                      <label>行程天数</label>
                      <div className="duration-display">
                        <span className="duration-number">{groupData.duration || 0}</span> 天
                      </div>
                    </div>
                  </div>

                  {/* 第三行：备注 */}
                  <div className="info-row">
                    <div className="info-item full-width">
                      <label>备注</label>
                      <textarea
                        value={groupData.notes || ''}
                        onChange={(e) => {
                          updateGroupData('notes', e.target.value);
                          handleAutoSave();
                        }}
                        placeholder="特殊要求、注意事项等"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 团员信息卡片 - 只在非新建模式下显示 */}
              {!isNew && (
                <div className="info-card">
                  <div className="card-header">
                    <span className="card-title">团员管理</span>
                    <div className="member-stats">
                      <span className="stat-item">
                        <TeamOutlined /> 学生 {groupData.student_count || 0}
                      </span>
                      <span className="stat-divider">|</span>
                      <span className="stat-item">老师 {groupData.teacher_count || 0}</span>
                      <span className="stat-divider">|</span>
                      <span className="stat-item total">总计 {(groupData.student_count || 0) + (groupData.teacher_count || 0)}</span>
                    </div>
                  </div>

                  <div className="card-body">
                    <MemberManagement
                      groupId={id}
                      groupData={groupData}
                      members={groupData.members}
                      onUpdate={(members) => {
                        updateGroupData('members', members);
                        // 更新人数统计
                        const students = members.filter(m => m.role === 'student').length;
                        const teachers = members.filter(m => m.role === 'teacher').length;
                        updateMultipleFields({
                          student_count: students,
                          teacher_count: teachers
                        });
                        handleAutoSave();
                      }}
                      compact={true}
                    />
                  </div>
                </div>
              )}
            </div>
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