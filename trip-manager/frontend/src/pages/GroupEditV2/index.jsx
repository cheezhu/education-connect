import React, { useState, useEffect, useRef } from 'react';
import { Button, Spin, message } from 'antd';
import {
  ArrowLeftOutlined,
  TeamOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import GroupInfoSimple from './GroupInfoSimple';
import ScheduleManagement from './ScheduleManagement';
import ScheduleDetail from './ScheduleDetail';
import MemberManagement from './MemberManagement';
import api from '../../services/api';
import dayjs from 'dayjs';
import './GroupEditV2.css';

const GROUP_COLOR_PALETTE = [
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#eb2f96',
  '#13c2c2',
  '#722ed1',
  '#f5222d',
  '#fa541c',
  '#2f54eb',
  '#a0d911'
];

const getRandomGroupColor = () => (
  GROUP_COLOR_PALETTE[Math.floor(Math.random() * GROUP_COLOR_PALETTE.length)] || '#1890ff'
);

const GroupEditV2 = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const getInitialTab = () => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab === 'schedule' || tab === 'schedule-detail' || tab === 'info' || tab === 'members') {
      return tab;
    }
    return 'info';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [groupData, setGroupData] = useState(null);
  const [groupSchedules, setGroupSchedules] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [itineraryPlans, setItineraryPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const autoSaveTimeoutRef = useRef(null);
  const groupDataRef = useRef(null);
  const creatingRef = useRef(false);

  // 是否为新建模式
  const isNew = id === 'new' || !id;

  useEffect(() => {
    const content = document.querySelector('.ant-layout-content');
    if (!content) return undefined;

    const prev = {
      overflow: content.style.overflow,
      height: content.style.height,
      boxSizing: content.style.boxSizing,
      padding: content.style.padding,
      display: content.style.display,
      flexDirection: content.style.flexDirection
    };
    const prevBody = {
      overflow: document.body.style.overflow,
      overflowHtml: document.documentElement.style.overflow
    };

    content.style.overflow = 'hidden';
    content.style.height = 'calc(100vh - 42px)';
    content.style.boxSizing = 'border-box';
    content.style.padding = '0';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      content.style.overflow = prev.overflow;
      content.style.height = prev.height;
      content.style.boxSizing = prev.boxSizing;
      content.style.padding = prev.padding;
      content.style.display = prev.display;
      content.style.flexDirection = prev.flexDirection;
      document.body.style.overflow = prevBody.overflow;
      document.documentElement.style.overflow = prevBody.overflowHtml;
    };
  }, []);

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
        color: getRandomGroupColor(),
        itinerary_plan_id: null,
        status: '准备中',
        contact_person: '',
        contact_phone: '',
        emergency_contact: '',
        emergency_phone: '',
        accommodation: '',
        tags: [],
        notes: '',
        members: [],
        schedules: []
      });
      setGroupSchedules([]);
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
        accommodation: group.accommodation || '',
        tags: Array.isArray(group.tags) ? group.tags : [],
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

  useEffect(() => {
    groupDataRef.current = groupData;
  }, [groupData]);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (isNew) {
      return;
    }
    if (tab === 'schedule' || tab === 'schedule-detail' || tab === 'info' || tab === 'members') {
      setActiveTab(tab);
    }
  }, [id, isNew, location.search]);

  const fetchItineraryPlans = async () => {
    try {
      const response = await api.get('/itinerary-plans');
      setItineraryPlans(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setItineraryPlans([]);
    }
  };

  useEffect(() => {
    fetchItineraryPlans();
  }, []);

  const fetchSchedules = async () => {
    if (isNew) {
      setGroupSchedules([]);
      setSchedulesLoading(false);
      return;
    }
    setSchedulesLoading(true);
    try {
      const response = await api.get(`/groups/${id}/schedules`);
      const loaded = Array.isArray(response.data) ? response.data : [];
      setGroupSchedules(loaded);
    } catch (error) {
      message.error('加载日程失败');
      setGroupSchedules([]);
    } finally {
      setSchedulesLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [id, isNew]);

  // 自动保存
  const buildSavePayload = (data) => ({
    name: data.name,
    type: data.type,
    student_count: data.student_count,
    teacher_count: data.teacher_count,
    start_date: data.start_date,
    end_date: data.end_date,
    duration: data.duration,
    color: data.color,
    itinerary_plan_id: data.itinerary_plan_id,
    status: data.status,
    contact_person: data.contact_person,
    contact_phone: data.contact_phone,
    emergency_contact: data.emergency_contact,
    emergency_phone: data.emergency_phone,
    accommodation: data.accommodation,
    tags: data.tags,
    notes: data.notes
  });

  const handleAutoSave = async (overrides = {}) => {
    // Clear previous timer
    clearTimeout(autoSaveTimeoutRef.current);

    // Save after 800ms
    autoSaveTimeoutRef.current = setTimeout(async () => {
      const baseData = groupDataRef.current;
      if (!baseData?.name) return;
      const nextData = { ...baseData, ...overrides };
      const dataToSave = buildSavePayload(nextData);

      if (isNew) {
        if (creatingRef.current) return;
        creatingRef.current = true;
        setSaving(true);
        try {
          const response = await api.post('/groups', dataToSave);
          setHasChanges(false);
          message.success('\u56e2\u7ec4\u521b\u5efa\u6210\u529f');
          const createdId = response.data?.group?.id ?? response.data?.id;
          if (createdId) {
            navigate(`/groups/v2/edit/${createdId}`);
          } else {
            navigate('/groups/v2');
          }
        } catch (error) {
          message.error('\u521b\u5efa\u56e2\u7ec4\u5931\u8d25');
          console.error('\u521b\u5efa\u56e2\u7ec4\u5931\u8d25:', error);
        } finally {
          setSaving(false);
          creatingRef.current = false;
        }
        return;
      }

      setSaving(true);
      try {
        await api.put(`/groups/${id}`, dataToSave);
        setHasChanges(false);
      } catch (error) {
        console.error('\u81ea\u52a8\u4fdd\u5b58\u5931\u8d25:', error);
      } finally {
        setSaving(false);
      }
    }, 800);
  };

  const updateGroupData = (field, value) => {
    setGroupData(prev => {
      const updated = {
        ...prev,
        [field]: value
      };

      // 自动计算天数
      if (field === 'start_date' || field === 'end_date') {
        if (updated.start_date && updated.end_date) {
          updated.duration = dayjs(updated.end_date).diff(dayjs(updated.start_date), 'day') + 1;
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

  const saveStatusClass = saving
    ? 'saving'
    : (hasChanges ? 'dirty' : 'saved');
  const saveStatusText = saving
    ? '保存中...'
    : (hasChanges ? '未保存' : '已保存');

  return (
    <div className="group-edit-v2">
      <div className="group-edit-header">
        <div className="group-edit-header-top">
          <div className="group-edit-header-left">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/groups/v2')}
              type="text"
              size="small"
            >
              返回列表
            </Button>
            <div className="group-edit-header-title">
              <div className="group-edit-title-row">
                {groupData.status ? (
                  <span className={`status-badge status-${groupData.status}`}>
                    {groupData.status}
                  </span>
                ) : null}
                <span className="group-edit-title">
                  {isNew ? '创建团组' : groupData.name || '未命名团组'}
                </span>
              </div>
            </div>
          </div>
          <div className="group-edit-actions">
            <span className={`save-indicator ${saveStatusClass}`}>{saveStatusText}</span>
          </div>
        </div>

        <div className="group-edit-tabs">
          <button
            className={`group-edit-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
            type="button"
          >
            <TeamOutlined /> 团组信息
          </button>
          <button
            className={`group-edit-tab ${activeTab === 'schedule' ? 'active' : ''} ${isNew ? 'disabled' : ''}`}
            onClick={() => !isNew && setActiveTab('schedule')}
            type="button"
          >
            <CalendarOutlined /> 日历详情
          </button>
          <button
            className={`group-edit-tab ${activeTab === 'schedule-detail' ? 'active' : ''} ${isNew ? 'disabled' : ''}`}
            onClick={() => !isNew && setActiveTab('schedule-detail')}
            type="button"
          >
            <UnorderedListOutlined /> 详细日程
          </button>
          <button
            className={`group-edit-tab ${activeTab === 'members' ? 'active' : ''} ${isNew ? 'disabled' : ''}`}
            onClick={() => !isNew && setActiveTab('members')}
            type="button"
          >
            <UserOutlined /> 人员信息
          </button>
        </div>
      </div>

      <div className="group-edit-body">
        {activeTab === 'info' && (
          <GroupInfoSimple
            groupData={groupData}
            schedules={groupSchedules}
            loading={schedulesLoading}
            itineraryPlans={itineraryPlans}
            onUpdate={updateGroupData}
            handleAutoSave={handleAutoSave}
            isNew={isNew}
          />
        )}

        {activeTab === 'schedule' && !isNew && (
          <ScheduleManagement
            groupId={id}
            groupData={groupData}
            schedules={groupSchedules}
            loading={schedulesLoading}
            onUpdate={(schedules) => {
              setGroupSchedules(schedules);
            }}
            onPlanChange={(planId) => {
              updateGroupData('itinerary_plan_id', planId);
              handleAutoSave({ itinerary_plan_id: planId });
            }}
          />
        )}

        {activeTab === 'schedule-detail' && !isNew && (
          <ScheduleDetail
            groupData={groupData}
            schedules={groupSchedules}
            loading={schedulesLoading}
          />
        )}

        {activeTab === 'members' && !isNew && (
          <MemberManagement groupId={id} />
        )}
      </div>
    </div>
  );
};

export default GroupEditV2;
