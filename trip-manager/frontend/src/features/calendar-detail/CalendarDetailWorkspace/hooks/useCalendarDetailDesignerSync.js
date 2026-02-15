import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from 'antd/es/modal';
import message from 'antd/es/message';
import api from '../../../../services/api';
import { CALENDAR_DETAIL_DESIGNER_SYNC_TEXT } from '../../messages';

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
      message.warning(CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.pullNoPermission);
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
        message.warning(CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.pullNoData);
        return;
      }

      // Only replace location-based visit points; keep meals/transfers/custom without locationId.
      const retained = activitiesRef.current.filter((item) => !isLocationRef.current?.(item));
      const merged = [...retained, ...normalized.list];
      setActivities(merged);
      onUpdateRef.current?.(merged);
      message.success(CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.pullSuccess(normalized.list.length));
    } catch (error) {
      message.error(CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.pullFailed);
    } finally {
      setPullingFromDesigner(false);
    }
  }, [groupId, canSyncDesigner, setActivities]);

  const pushToDesigner = useCallback(() => {
    if (!groupId) return;
    if (!canSyncDesigner) {
      message.warning(CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.pushNoPermission);
      return;
    }

    const toPush = activitiesRef.current.filter((item) => isLocationRef.current?.(item));
    if (toPush.length === 0) {
      message.warning(CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.pushNoData);
      return;
    }

    Modal.confirm({
      title: CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.confirmTitle,
      content: CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.confirmContent(toPush.length),
      okText: CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.confirmOkText,
      cancelText: CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.confirmCancelText,
      okButtonProps: { danger: true },
      onOk: async () => {
        setPushingToDesigner(true);
        try {
          const response = await api.post(`/groups/${groupId}/schedules/push-to-designer`, {
            scheduleList: toPush
          });
          const inserted = Number(response?.data?.inserted);
          const insertedCount = Number.isFinite(inserted) ? inserted : toPush.length;
          message.success(CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.pushSuccess(insertedCount));
          onPushedRef.current?.({
            groupId,
            inserted: insertedCount
          });
        } catch (error) {
          if (error?.response?.status === 403) {
            message.error(CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.pushForbidden);
            return;
          }
          message.error(CALENDAR_DETAIL_DESIGNER_SYNC_TEXT.pushFailed);
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
