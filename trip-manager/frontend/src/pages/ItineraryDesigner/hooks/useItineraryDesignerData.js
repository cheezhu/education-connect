import message from 'antd/es/message';
import { useCallback, useEffect, useMemo, useState } from 'react';

import useDataSync from '../../../hooks/useDataSync';

export default function useItineraryDesignerData({ api }) {
  const [groups, setGroups] = useState([]);
  const [activities, setActivities] = useState([]);
  const [locations, setLocations] = useState([]);
  const [itineraryPlans, setItineraryPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);

  const itineraryPlanById = useMemo(() => (
    new Map(
      (itineraryPlans || [])
        .map((plan) => [Number(plan.id), plan])
        .filter(([planId]) => Number.isFinite(planId))
    )
  ), [itineraryPlans]);

  const loadData = useCallback(async (preserveSelection = false) => {
    setLoading(true);
    try {
      const [groupsRes, activitiesRes, locationsRes, plansRes] = await Promise.all([
        api.get('/groups'),
        api.get('/activities/raw'),
        api.get('/locations'),
        api.get('/itinerary-plans').catch(() => ({ data: [] }))
      ]);
      const nextGroups = Array.isArray(groupsRes.data) ? groupsRes.data : [];
      const nextActivities = Array.isArray(activitiesRes.data) ? activitiesRes.data : [];
      const nextLocations = Array.isArray(locationsRes.data) ? locationsRes.data : [];
      const nextPlans = Array.isArray(plansRes.data) ? plansRes.data : [];

      setGroups(nextGroups);
      setActivities(nextActivities);
      setLocations(nextLocations);
      setItineraryPlans(nextPlans);

      // Only auto-select all groups on first load. Refresh keeps user selection.
      if (!preserveSelection) {
        setSelectedGroups((prev) => (
          prev.length === 0 ? nextGroups.map((g) => g.id) : prev
        ));
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const refreshData = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  const refreshActivitiesOnly = useCallback(async () => {
    try {
      const response = await api.get('/activities/raw');
      if (Array.isArray(response.data)) {
        setActivities(response.data);
      }
    } catch (error) {
      message.warning('同步活动失败');
    }
  }, [api]);

  const { registerRefreshCallback } = useDataSync();
  useEffect(() => {
    loadData(false);
    const unregister = registerRefreshCallback(refreshData);
    return unregister;
  }, [loadData, refreshData, registerRefreshCallback]);

  return {
    groups,
    setGroups,
    activities,
    setActivities,
    locations,
    itineraryPlanById,
    loading,
    selectedGroups,
    setSelectedGroups,
    refreshData,
    refreshActivitiesOnly
  };
}
