import { useEffect, useRef } from 'react';
import { subscribeRealtimeChanges } from '../../../services/realtime';
import { DEBOUNCE_MS } from '../constants';

export const useRealtimeSync = ({
  fetchGroups,
  fetchPlans,
  fetchLocations,
  fetchLogistics,
  fetchSchedules,
  fetchMemberCount,
  getActiveGroupId
}) => {
  const pendingPathsRef = useRef(new Set());
  const flushTimerRef = useRef(null);

  useEffect(() => {
    const flushRealtimeRefresh = async () => {
      flushTimerRef.current = null;
      const paths = Array.from(pendingPathsRef.current);
      pendingPathsRef.current.clear();
      if (paths.length === 0) return;

      const hasGroupChange = paths.some((path) => path.startsWith('/api/groups'));
      const hasPlanChange = paths.some((path) => path.startsWith('/api/itinerary-plans'));
      const hasLocationChange = paths.some((path) => path.startsWith('/api/locations'));
      const hasScheduleOrLogisticsChange = paths.some((path) => (
        path.includes('/schedules')
        || path.includes('/logistics')
        || path.includes('/activities')
        || path.startsWith('/api/groups')
      ));
      const hasMemberChange = paths.some((path) => path.includes('/members'));

      if (hasGroupChange) {
        await fetchGroups?.();
      }
      if (hasPlanChange) {
        await fetchPlans?.();
      }
      if (hasLocationChange) {
        await fetchLocations?.();
      }

      const currentGroupId = getActiveGroupId?.();
      if (!currentGroupId) return;

      if (hasScheduleOrLogisticsChange) {
        await fetchLogistics?.(currentGroupId);
        await fetchSchedules?.(currentGroupId);
      }
      if (hasMemberChange || hasGroupChange) {
        await fetchMemberCount?.(currentGroupId);
      }
    };

    const queueRealtimeRefresh = (path) => {
      if (!path) return;
      pendingPathsRef.current.add(path);
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(() => {
        void flushRealtimeRefresh();
      }, DEBOUNCE_MS.realtimeRefresh);
    };

    const unsubscribe = subscribeRealtimeChanges({
      onChange: (change) => {
        queueRealtimeRefresh(change?.path || '');
      }
    });

    return () => {
      unsubscribe();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingPathsRef.current.clear();
    };
  }, [
    fetchGroups,
    fetchPlans,
    fetchLocations,
    fetchLogistics,
    fetchSchedules,
    fetchMemberCount,
    getActiveGroupId
  ]);
};

