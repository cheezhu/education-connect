import message from 'antd/es/message';
import { useCallback } from 'react';

import checkConflicts from '../conflicts/checkConflicts';

export default function useActivityCrud({
  api,
  groups,
  activities,
  locations,
  selectedTimeSlot,
  setSelectedTimeSlot,
  setActivities,
  refreshData
}) {
  const handleAddActivity = useCallback(async (groupId, locationId, participantCount) => {
    if (!selectedTimeSlot?.date || !selectedTimeSlot?.timeSlot) return;
    const group = (groups || []).find((item) => item.id === groupId);
    const finalParticipantCount = participantCount || group?.student_count || 0;

    const conflicts = checkConflicts({
      activityId: null,
      groupId,
      locationId,
      date: selectedTimeSlot.date,
      timeSlot: selectedTimeSlot.timeSlot,
      participantCount: finalParticipantCount,
      activities,
      groups,
      locations
    });

    const addActivity = async () => {
      try {
        const newActivity = {
          groupId,
          locationId,
          date: selectedTimeSlot.date,
          timeSlot: selectedTimeSlot.timeSlot,
          participantCount: finalParticipantCount
        };

        const response = await api.post('/activities', newActivity);
        setActivities((prev) => [...prev, response.data]);
        setSelectedTimeSlot((prev) => {
          if (!prev) return prev;
          const nextActivities = [...(prev.activities || []), response.data];
          return { ...prev, activities: nextActivities };
        });

        message.success('活动添加成功');
        refreshData();
      } catch (error) {
        message.error('添加活动失败');
      }
    };

    if (conflicts.length > 0) {
      await addActivity();
      return;
    }

    await addActivity();
  }, [
    activities,
    api,
    groups,
    locations,
    refreshData,
    selectedTimeSlot,
    setActivities,
    setSelectedTimeSlot
  ]);

  const handleDeleteActivity = useCallback(async (activityId) => {
    if (!activityId) return;
    try {
      await api.delete(`/activities/${activityId}`);

      setActivities((prev) => prev.filter((item) => item.id !== activityId));
      setSelectedTimeSlot((prev) => {
        if (!prev) return prev;
        const prevActivities = prev.activities || [];
        const nextActivities = prevActivities.filter((item) => item.id !== activityId);
        if (nextActivities.length === prevActivities.length) return prev;
        return { ...prev, activities: nextActivities };
      });

      message.success('活动删除成功');
      refreshData();
    } catch (error) {
      message.error('删除活动失败');
    }
  }, [api, refreshData, setActivities, setSelectedTimeSlot]);

  const handleUpdateActivity = useCallback(async (activityId, updates) => {
    if (!activityId) return;
    try {
      const response = await api.put(`/activities/${activityId}`, updates);
      const nextActivity = response.data;

      setActivities((prev) => prev.map((item) => (
        item.id === activityId ? nextActivity : item
      )));
      setSelectedTimeSlot((prev) => {
        if (!prev) return prev;
        const prevActivities = prev.activities || [];
        const nextActivities = prevActivities.map((item) => (
          item.id === activityId ? nextActivity : item
        ));
        return { ...prev, activities: nextActivities };
      });

      message.success('活动更新成功');
      refreshData();
    } catch (error) {
      message.error('更新活动失败');
    }
  }, [api, refreshData, setActivities, setSelectedTimeSlot]);

  return {
    handleAddActivity,
    handleDeleteActivity,
    handleUpdateActivity
  };
}
