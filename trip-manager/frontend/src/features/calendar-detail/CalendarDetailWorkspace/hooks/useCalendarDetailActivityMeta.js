import { useCallback, useMemo } from 'react';
import { CALENDAR_ACTIVITY_TYPES } from '../../constants';

const FALLBACK_COLOR = CALENDAR_ACTIVITY_TYPES.visit?.color || '#1890ff';

const useCalendarDetailActivityMeta = ({ locations }) => {
  const locationColorMap = useMemo(() => {
    const entries = Array.isArray(locations)
      ? locations
          .map((loc) => [Number(loc.id), loc.color])
          .filter(([id, color]) => Number.isFinite(id) && color)
      : [];
    return new Map(entries);
  }, [locations]);

  const resolveLocationColor = useCallback((locationId, fallbackColor) => {
    const id = Number(locationId);
    if (Number.isFinite(id)) {
      const color = locationColorMap.get(id);
      if (color) return color;
    }
    return fallbackColor || null;
  }, [locationColorMap]);

  const resolveActivityColor = useCallback(({ type, locationId, locationColor }) => {
    if (type === 'visit') {
      return resolveLocationColor(locationId, locationColor)
        || CALENDAR_ACTIVITY_TYPES.visit?.color
        || FALLBACK_COLOR;
    }
    return CALENDAR_ACTIVITY_TYPES[type]?.color || FALLBACK_COLOR;
  }, [resolveLocationColor]);

  const getActivityIdentity = useCallback((activity) => (
    activity
      ? (
        activity.id
          ?? activity.clientId
          ?? `${activity.date || 'date'}-${activity.startTime || 'time'}-${activity.title || activity.location || 'activity'}`
      )
      : null
  ), []);

  return {
    resolveActivityColor,
    getActivityIdentity
  };
};

export default useCalendarDetailActivityMeta;
