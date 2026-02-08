import { message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useGroupCalendarDetail({ api, onBeforeOpen }) {
  const [visible, setVisible] = useState(false);
  const [groupId, setGroupId] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resourcesVisible, setResourcesVisible] = useState(true);
  const [revision, setRevision] = useState(0);

  const saveTimeoutRef = useRef(null);
  const saveTokenRef = useRef(0);

  const loadSchedules = useCallback(async (targetGroupId) => {
    if (!targetGroupId) return;
    setLoading(true);
    try {
      const response = await api.get(`/groups/${targetGroupId}/schedules`);
      const loaded = Array.isArray(response.data) ? response.data : [];
      const revisionHeader = response.headers?.['x-schedule-revision'];
      const nextRevision = Number(revisionHeader);
      setRevision(Number.isFinite(nextRevision) ? nextRevision : 0);
      setSchedules(loaded);
    } catch (error) {
      message.error('加载日程失败');
      setSchedules([]);
      setRevision(0);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!visible || !groupId) return;
    loadSchedules(groupId);
  }, [visible, groupId, loadSchedules]);

  useEffect(() => (
    () => {
      clearTimeout(saveTimeoutRef.current);
    }
  ), []);

  const open = (nextGroupId) => {
    if (!nextGroupId) return;
    onBeforeOpen?.();

    const isSameGroup = nextGroupId === groupId;
    const alreadyOpen = visible && isSameGroup;
    if (!isSameGroup) {
      setSchedules([]);
      setGroupId(nextGroupId);
      setResourcesVisible(true);
      setRevision(0);
    }
    setVisible(true);
    if (alreadyOpen) {
      loadSchedules(nextGroupId);
    }
  };

  const close = () => {
    setVisible(false);
  };

  const handleUpdate = (updatedSchedules) => {
    setSchedules(updatedSchedules);
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      if (!groupId) return;
      saveTokenRef.current += 1;
      const token = saveTokenRef.current;
      try {
        const response = await api.post(`/groups/${groupId}/schedules/batch`, {
          scheduleList: updatedSchedules,
          revision
        });
        if (token !== saveTokenRef.current) return;
        const saved = Array.isArray(response.data) ? response.data : updatedSchedules;
        const revisionHeader = response.headers?.['x-schedule-revision'];
        const nextRevision = Number(revisionHeader);
        if (Number.isFinite(nextRevision)) {
          setRevision(nextRevision);
        }
        setSchedules(saved);
      } catch (error) {
        if (error?.response?.status === 409) {
          const revisionHeader = error.response?.headers?.['x-schedule-revision'];
          const nextRevision = Number(revisionHeader);
          if (Number.isFinite(nextRevision)) {
            setRevision(nextRevision);
          }
          message.warning('日程已被其他人修改，请刷新后再试');
          loadSchedules(groupId);
          return;
        }
        message.error('保存日程失败');
      }
    }, 500);
  };

  return {
    visible,
    groupId,
    schedules,
    loading,
    resourcesVisible,
    setResourcesVisible,
    open,
    close,
    reload: () => loadSchedules(groupId),
    onUpdate: handleUpdate
  };
}

