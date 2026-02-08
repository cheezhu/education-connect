import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, message } from 'antd';
import api from '../../../../services/api';

const normalizeDesignerPayload = (payload) => {
  const list = Array.isArray(payload?.scheduleList) ? payload.scheduleList : [];
  const count = Number(payload?.count);
  const resolvedCount = Number.isFinite(count) ? count : list.length;
  return {
    available: Boolean(payload?.available) && resolvedCount > 0,
    count: resolvedCount,
    list
  };
};

const useCalendarDetailDesignerSync = ({
  groupId,
  canSyncDesigner,
  activities,
  setActivities,
  isLocationSchedule,
  onUpdate,
  onPushedToDesigner
}) => {
  const [designerSourceState, setDesignerSourceState] = useState({
    available: false,
    count: 0,
    loading: false,
    list: []
  });
  const [pullingFromDesigner, setPullingFromDesigner] = useState(false);
  const [pushingToDesigner, setPushingToDesigner] = useState(false);

  const activitiesRef = useRef(Array.isArray(activities) ? activities : []);
  const onUpdateRef = useRef(onUpdate);
  const onPushedRef = useRef(onPushedToDesigner);
  const isLocationRef = useRef(isLocationSchedule);

  useEffect(() => {
    activitiesRef.current = Array.isArray(activities) ? activities : [];
  }, [activities]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onPushedRef.current = onPushedToDesigner;
  }, [onPushedToDesigner]);

  useEffect(() => {
    isLocationRef.current = isLocationSchedule;
  }, [isLocationSchedule]);

  const refreshDesignerSource = useCallback(async () => {
    if (!groupId || !canSyncDesigner) {
      setDesignerSourceState({ available: false, count: 0, loading: false, list: [] });
      return;
    }

    setDesignerSourceState((prev) => ({ ...prev, loading: true }));
    try {
      const response = await api.get(`/groups/${groupId}/schedules/designer-source`);
      const payload = response?.data || {};
      const normalized = normalizeDesignerPayload(payload);
      setDesignerSourceState({
        ...normalized,
        loading: false
      });
    } catch {
      setDesignerSourceState({ available: false, count: 0, loading: false, list: [] });
    }
  }, [groupId, canSyncDesigner]);

  useEffect(() => {
    refreshDesignerSource();
  }, [refreshDesignerSource]);

  const pullFromDesigner = useCallback(async () => {
    if (!groupId) return;
    if (!canSyncDesigner) {
      message.warning('需要管理员权限才能拉取行程');
      return;
    }

    setPullingFromDesigner(true);
    try {
      const response = await api.get(`/groups/${groupId}/schedules/designer-source`);
      const payload = response?.data || {};
      const normalized = normalizeDesignerPayload(payload);

      setDesignerSourceState({
        ...normalized,
        loading: false
      });

      if (!normalized.available || normalized.list.length === 0) {
        message.warning('行程设计器暂无可拉取的行程点');
        return;
      }

      // Only replace location-based visit points; keep meals/transfers/custom without locationId.
      const retained = activitiesRef.current.filter((item) => !isLocationRef.current?.(item));
      const merged = [...retained, ...normalized.list];
      setActivities(merged);
      onUpdateRef.current?.(merged);
      message.success(`已拉取 ${normalized.list.length} 条行程点`);
    } catch (error) {
      message.error('拉取失败，请稍后重试');
    } finally {
      setPullingFromDesigner(false);
    }
  }, [groupId, canSyncDesigner, setActivities]);

  const pushToDesigner = useCallback(() => {
    if (!groupId) return;
    if (!canSyncDesigner) {
      message.warning('需要管理员权限才能推送行程');
      return;
    }

    const toPush = activitiesRef.current.filter((item) => isLocationRef.current?.(item));
    if (toPush.length === 0) {
      message.warning('当前日历暂无可推送的行程点');
      return;
    }

    Modal.confirm({
      title: '推送到行程设计器',
      content: `将覆盖行程设计器中该团组的行程点（共 ${toPush.length} 条）。确认推送？`,
      okText: '推送',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setPushingToDesigner(true);
        try {
          const response = await api.post(`/groups/${groupId}/schedules/push-to-designer`, {
            scheduleList: toPush
          });
          const inserted = Number(response?.data?.inserted);
          const insertedCount = Number.isFinite(inserted) ? inserted : toPush.length;
          message.success(`已推送 ${insertedCount} 条行程点到行程设计器`);
          onPushedRef.current?.({
            groupId,
            inserted: insertedCount
          });
        } catch (error) {
          if (error?.response?.status === 403) {
            message.error('无权限或编辑锁被占用，推送失败');
            return;
          }
          message.error('推送失败，请稍后重试');
        } finally {
          setPushingToDesigner(false);
        }
      }
    });
  }, [groupId, canSyncDesigner]);

  return {
    designerSourceState,
    pullingFromDesigner,
    pushingToDesigner,
    refreshDesignerSource,
    pullFromDesigner,
    pushToDesigner
  };
};

export default useCalendarDetailDesignerSync;
