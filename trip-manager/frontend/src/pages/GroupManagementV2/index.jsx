import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';
import GroupList from './components/Sidebar/GroupList';
import TabBar from './components/Detail/TabBar';
import ProfileView from './components/Detail/ProfileView';
import FullCalendarWrapper from './components/Detail/FullCalendarWrapper';
import BulkCreateModal from './components/Modals/BulkCreateModal';
import MemberManagement from '../GroupEditV2/MemberManagement';
import GroupCommandCenterSkeleton from './components/GroupCommandCenterSkeleton';
import './GroupCommandCenter.css';

const GroupManagementV2 = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [groupSchedules, setGroupSchedules] = useState([]);
  const [hasMembers, setHasMembers] = useState(false);
  const [itineraryPlans, setItineraryPlans] = useState([]);

  const [filters, setFilters] = useState({
    searchText: '',
    statusFilters: ['准备中', '进行中', '已完成']
  });

  const createBulkRow = () => ({
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    type: '',
    start_date: '',
    end_date: '',
    participant_count: 44
  });

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkRows, setBulkRows] = useState(() => [createBulkRow()]);
  const [bulkErrors, setBulkErrors] = useState({});

  const saveRef = useRef(null);

  const calculateStatus = (group) => {
    if (group.status === '已取消') return '已取消';
    const today = dayjs();
    const startDate = dayjs(group.start_date);
    const endDate = dayjs(group.end_date);

    if (today.isBefore(startDate)) return '准备中';
    if (today.isAfter(endDate)) return '已完成';
    return '进行中';
  };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await api.get('/groups');
      const enhancedGroups = (response.data || []).map(group => ({
        ...group,
        status: group.status ?? calculateStatus(group)
      }));
      setGroups(enhancedGroups);
    } catch (error) {
      message.error('加载团组数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async (groupId) => {
    if (!groupId) {
      setGroupSchedules([]);
      return;
    }
    try {
      const response = await api.get(`/groups/${groupId}/schedules`);
      setGroupSchedules(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('加载日程失败');
      setGroupSchedules([]);
    }
  };

  const fetchItineraryPlans = async () => {
    try {
      const response = await api.get('/itinerary-plans');
      setItineraryPlans(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setItineraryPlans([]);
    }
  };

  const fetchMemberCount = async (groupId) => {
    if (!groupId) {
      setHasMembers(false);
      return;
    }
    try {
      const response = await api.get(`/groups/${groupId}/members`);
      const count = Array.isArray(response.data) ? response.data.length : 0;
      setHasMembers(count > 0);
    } catch (error) {
      setHasMembers(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchItineraryPlans();
  }, []);

  useEffect(() => {
    let filtered = [...groups];

    if (filters.statusFilters.length > 0) {
      filtered = filtered.filter(group => filters.statusFilters.includes(group.status));
    }

    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(group =>
        (group.name || '').toLowerCase().includes(searchLower) ||
        (group.contact_person || '').toLowerCase().includes(searchLower) ||
        (group.contact_phone || '').toLowerCase().includes(searchLower)
      );
    }

    setFilteredGroups(filtered);
  }, [filters, groups]);

  useEffect(() => {
    if (filteredGroups.length === 0) {
      setActiveGroupId(null);
      return;
    }
    if (!activeGroupId || !filteredGroups.some(group => group.id === activeGroupId)) {
      setActiveGroupId(filteredGroups[0].id);
    }
  }, [filteredGroups, activeGroupId]);

  useEffect(() => {
    fetchSchedules(activeGroupId);
    fetchMemberCount(activeGroupId);
  }, [activeGroupId]);

  const activeGroup = useMemo(() => (
    groups.find(group => group.id === activeGroupId) || null
  ), [groups, activeGroupId]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'schedule') {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }
  };

  const handleExpandSidebar = () => {
    setIsSidebarCollapsed(false);
  };

  const buildUpdatePayload = (group) => ({
    name: group.name,
    type: group.type,
    student_count: group.student_count,
    teacher_count: group.teacher_count,
    start_date: group.start_date,
    end_date: group.end_date,
    duration: group.duration,
    color: group.color,
    contact_person: group.contact_person,
    contact_phone: group.contact_phone,
    emergency_contact: group.emergency_contact,
    emergency_phone: group.emergency_phone,
    accommodation: group.accommodation,
    tags: group.tags,
    notes: group.notes,
    itinerary_plan_id: group.itinerary_plan_id,
    status: group.status
  });

  const handleGroupUpdate = useCallback((updatedGroup) => {
    if (!updatedGroup?.id) return;

    setGroups(prev => prev.map(group => (
      group.id === updatedGroup.id ? { ...group, ...updatedGroup } : group
    )));

    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      try {
        const payload = buildUpdatePayload(updatedGroup);
        const response = await api.put(`/groups/${updatedGroup.id}`, payload);
        if (response.data?.group) {
          setGroups(prev => prev.map(group => (
            group.id === updatedGroup.id ? { ...group, ...response.data.group } : group
          )));
        }
      } catch (error) {
        message.error('保存失败');
      }
    }, 0);
  }, []);

  const handleDeleteGroup = async () => {
    if (!activeGroup) return;
    try {
      await api.delete(`/groups/${activeGroup.id}`);
      message.success('团组已删除');
      fetchGroups();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleScheduleUpdate = (updatedSchedules) => {
    setGroupSchedules(updatedSchedules);
  };

  const updateSearch = (value) => {
    setFilters(prev => ({ ...prev, searchText: value }));
  };

  const toggleStatusFilter = (status) => {
    setFilters(prev => {
      const exists = prev.statusFilters.includes(status);
      const next = exists
        ? prev.statusFilters.filter(item => item !== status)
        : [...prev.statusFilters, status];
      return { ...prev, statusFilters: next };
    });
  };

  const addBulkRow = () => {
    setBulkRows(prev => [...prev, createBulkRow()]);
  };

  const removeBulkRow = (id) => {
    setBulkRows(prev => prev.filter(row => row.id !== id));
  };

  const updateBulkRow = (id, updates) => {
    setBulkRows(prev => prev.map(row => (row.id === id ? { ...row, ...updates } : row)));
    setBulkErrors(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const resetBulkForm = () => {
    setBulkRows([createBulkRow()]);
    setBulkErrors({});
  };

  const validateBulkRows = () => {
    const errors = {};
    let firstInvalid = null;

    bulkRows.forEach((row, index) => {
      const rowErrors = {};
      if (!row.name || !row.name.trim()) rowErrors.name = true;
      if (!row.type) rowErrors.type = true;
      if (!row.start_date) rowErrors.start_date = true;
      if (!row.end_date) rowErrors.end_date = true;
      const count = Number(row.participant_count);
      if (!Number.isFinite(count) || count <= 0) rowErrors.participant_count = true;

      if (Object.keys(rowErrors).length) {
        errors[row.id] = rowErrors;
        if (firstInvalid === null) firstInvalid = index + 1;
      }
    });

    return { errors, firstInvalid };
  };

  const handleBulkCreate = async () => {
    if (bulkRows.length === 0) {
      message.error('请先添加团组');
      return;
    }

    const { errors, firstInvalid } = validateBulkRows();
    if (firstInvalid) {
      setBulkErrors(errors);
      message.error(`请完善第 ${firstInvalid} 行信息`);
      return;
    }

    const groupsToCreate = bulkRows.map(row => ({
      name: row.name.trim(),
      type: row.type,
      student_count: Number(row.participant_count),
      teacher_count: 0,
      start_date: row.start_date,
      end_date: row.end_date
    }));

    setBulkSubmitting(true);
    try {
      const response = await api.post('/groups/batch', { groups: groupsToCreate });
      const createdCount = response.data?.count ?? groupsToCreate.length;
      message.success(`已创建 ${createdCount} 个团组`);
      setBulkOpen(false);
      resetBulkForm();
      fetchGroups();
    } catch (error) {
      const errorMessage = error?.response?.data?.message
        || error?.response?.data?.error
        || '批量创建失败';
      message.error(errorMessage);
    } finally {
      setBulkSubmitting(false);
    }
  };

  if (loading && groups.length === 0) {
    return <GroupCommandCenterSkeleton />;
  }

  return (
    <div className="group-command-center">
      <div className="layout">
        <div className="content-split">
          <GroupList
            groups={filteredGroups}
            totalCount={groups.length}
            activeGroupId={activeGroupId}
            onSelectGroup={setActiveGroupId}
            onCreateGroup={() => navigate('/groups/v2/new')}
            onBulkCreate={() => setBulkOpen(true)}
            filters={filters}
            onSearchChange={updateSearch}
            onToggleStatus={toggleStatusFilter}
            isCollapsed={isSidebarCollapsed}
          />

          <div className="detail-view">
            <TabBar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              isSidebarCollapsed={isSidebarCollapsed}
              onExpandSidebar={handleExpandSidebar}
            />

            <div className="tab-content">
              <div className={`content-pane ${activeTab === 'profile' ? 'active' : ''}`}>
                <ProfileView
                  group={activeGroup}
                  schedules={groupSchedules}
                  hasMembers={hasMembers}
                  itineraryPlans={itineraryPlans}
                  onUpdate={handleGroupUpdate}
                  onDelete={handleDeleteGroup}
                />
              </div>

              <div className={`content-pane ${activeTab === 'schedule' ? 'active' : ''}`}>
                <FullCalendarWrapper
                  group={activeGroup}
                  schedules={groupSchedules}
                  onSchedulesUpdate={handleScheduleUpdate}
                />
              </div>

              <div className={`content-pane ${activeTab === 'members' ? 'active' : ''}`}>
                <div className="members-pane">
                  {activeGroup ? (
                    <MemberManagement groupId={activeGroup.id} />
                  ) : (
                    <div className="empty-state">请选择团组</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BulkCreateModal
        open={bulkOpen}
        rows={bulkRows}
        errors={bulkErrors}
        onChangeRow={updateBulkRow}
        onAddRow={addBulkRow}
        onRemoveRow={removeBulkRow}
        onClose={() => {
          setBulkOpen(false);
          resetBulkForm();
        }}
        onSubmit={handleBulkCreate}
        submitting={bulkSubmitting}
      />

      {loading && groups.length > 0 && (
        <div className="modal-overlay visible">
          <div className="modal-box" style={{ width: 240, height: 120, alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#666' }}>加载中...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManagementV2;







