import { Modal, message } from 'antd';
import { useCallback, useState } from 'react';

import { isDateWithinGroupRange } from '../shared/groupRules';
import { getLocationUnavailableReason } from '../shared/locationAvailability';
import { getRequestErrorMessage } from '../shared/messages';

const GROUP_CONSOLE_DRAG_TYPE = 'application/x-ec-group-console';

export default function useGroupConsoleDnD({
  api,
  group,
  groupActivities,
  mustVisitActivityMap,
  locations,
  formatDateString,
  getTimeSlotLabel,
  setActivities,
  refreshData,
  onUpdateActivity
}) {
  const [dragPayload, setDragPayload] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const readDragPayload = useCallback((event) => {
    if (event?.dataTransfer) {
      const encoded = event.dataTransfer.getData(GROUP_CONSOLE_DRAG_TYPE);
      if (encoded) {
        try {
          const parsed = JSON.parse(encoded);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        } catch (error) {
          // ignore parse error and fallback to in-memory payload
        }
      }
    }
    return dragPayload;
  }, [dragPayload]);

  const onCardDragStart = useCallback((event, payload) => {
    if (!payload || typeof payload !== 'object') return;
    setDragPayload(payload);
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(payload.locationName || payload.locationId || ''));
      event.dataTransfer.setData(GROUP_CONSOLE_DRAG_TYPE, JSON.stringify(payload));
    }
  }, []);

  const onCardDragEnd = useCallback(() => {
    setDragPayload(null);
    setDropTarget(null);
  }, []);

  const onCellDragOver = useCallback((event, inactive) => {
    if (inactive) return;
    event.preventDefault();
    if (event?.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }, []);

  const onCellDragEnter = useCallback((event, dateString, slotKey, inactive) => {
    if (inactive) return;
    event.preventDefault();
    setDropTarget({ date: dateString, slotKey });
  }, []);

  const onCellDragLeave = useCallback((event, dateString, slotKey) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
      return;
    }
    setDropTarget((prev) => (
      prev && prev.date === dateString && prev.slotKey === slotKey ? null : prev
    ));
  }, []);

  const onRemoveActivity = useCallback(async (activityId) => {
    if (!activityId) return;
    try {
      await api.delete(`/activities/${activityId}`);
      setActivities((prev) => prev.filter((item) => item.id !== activityId));
      message.success('安排已移除');
      refreshData();
    } catch (error) {
      message.error(getRequestErrorMessage(error, '移除安排失败'));
    }
  }, [api, refreshData, setActivities]);

  const onClearSlot = useCallback((slotKey) => {
    if (!group) return;
    const slotActivities = (groupActivities || []).filter((activity) => activity.timeSlot === slotKey);
    if (!slotActivities.length) {
      message.info(`${getTimeSlotLabel(slotKey)}暂无可清空安排`);
      return;
    }
    Modal.confirm({
      title: `清空${getTimeSlotLabel(slotKey)}安排？`,
      content: `将删除 ${slotActivities.length} 条活动，其他时段保持不变。`,
      okText: '确认清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await Promise.all(slotActivities.map((activity) => api.delete(`/activities/${activity.id}`)));
          const deleteIds = new Set(slotActivities.map((activity) => activity.id));
          setActivities((prev) => prev.filter((activity) => !deleteIds.has(activity.id)));
          message.success(`${getTimeSlotLabel(slotKey)}已清空`);
          refreshData();
        } catch (error) {
          message.error(getRequestErrorMessage(error, '清空失败'));
        }
      }
    });
  }, [api, getTimeSlotLabel, group, groupActivities, refreshData, setActivities]);

  const onDrop = useCallback(async (event, targetDate, slotKey, inactive) => {
    event.preventDefault();
    setDropTarget(null);
    if (inactive || !group) return;
    const payload = readDragPayload(event);
    setDragPayload(null);
    if (!payload) return;

    const targetDateString = formatDateString(targetDate);
    if (!targetDateString) return;
    if (!isDateWithinGroupRange(group, targetDateString)) {
      message.warning('不能拖入团组行程区间外的日期');
      return;
    }

    const locationId = Number(payload.locationId);
    if (!Number.isFinite(locationId) || locationId <= 0) {
      message.warning('该卡片缺少地点，无法安排');
      return;
    }

    const targetLocation = (locations || []).find((location) => Number(location.id) === locationId);
    const locationUnavailableReason = getLocationUnavailableReason(targetLocation, targetDateString);
    if (locationUnavailableReason) {
      message.warning(locationUnavailableReason);
      return;
    }

    const fallbackAssignments = mustVisitActivityMap?.get(locationId) || [];
    let movingActivity = null;
    const payloadActivityId = Number(payload.activityId);
    if (Number.isFinite(payloadActivityId)) {
      movingActivity = (groupActivities || []).find((activity) => Number(activity.id) === payloadActivityId) || null;
    }
    if (!movingActivity && fallbackAssignments.length > 0) {
      movingActivity = fallbackAssignments[0];
    }

    try {
      if (movingActivity) {
        const samePosition = (
          movingActivity.date === targetDateString
          && movingActivity.timeSlot === slotKey
          && Number(movingActivity.locationId) === locationId
        );
        if (samePosition) {
          return;
        }
        await onUpdateActivity(movingActivity.id, {
          date: targetDateString,
          timeSlot: slotKey,
          locationId,
          ignoreConflicts: true
        });
        if (fallbackAssignments.length > 1) {
          message.warning(
            `${targetLocation?.name || `#${locationId}`} 存在重复安排，请手动清理其余 ${fallbackAssignments.length - 1} 条`
          );
        }
        return;
      }

      const participantCount = (
        Number(group.student_count || 0)
        + Number(group.teacher_count || 0)
      ) || 1;
      const response = await api.post('/activities', {
        groupId: group.id,
        locationId,
        date: targetDateString,
        timeSlot: slotKey,
        participantCount
      });
      setActivities((prev) => [...prev, response.data]);
      message.success('必去行程点已安排');
      refreshData();
    } catch (error) {
      message.error(getRequestErrorMessage(error, '安排失败'));
    }
  }, [
    api,
    formatDateString,
    group,
    groupActivities,
    locations,
    mustVisitActivityMap,
    onUpdateActivity,
    readDragPayload,
    refreshData,
    setActivities
  ]);

  return {
    dropTarget,
    onCardDragStart,
    onCardDragEnd,
    onCellDragOver,
    onCellDragEnter,
    onCellDragLeave,
    onDrop,
    onRemoveActivity,
    onClearSlot
  };
}

