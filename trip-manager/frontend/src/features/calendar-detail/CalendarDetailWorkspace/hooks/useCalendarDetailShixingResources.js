import { useMemo } from 'react';
import { calcDurationHours } from '../utils/time';
import { buildShixingResourceId } from '../../../../domain/resourceId';

const isMealFilled = (meals, key) => {
  if (!meals || meals[`${key}_disabled`]) return false;
  return Boolean(meals[key] || meals[`${key}_place`]);
};

const buildTransferDescription = (transfer = {}) => {
  const note = typeof transfer.note === 'string' ? transfer.note.trim() : '';
  if (note) return note;
  return [
    transfer.flight_no && `航班 ${transfer.flight_no}`,
    transfer.airline,
    transfer.terminal
  ].filter(Boolean).join(' / ');
};

const useCalendarDetailShixingResources = ({ groupData, activities }) => useMemo(() => {
  const logistics = Array.isArray(groupData?.logistics) ? groupData.logistics : [];
  if (!logistics.length) return [];

  const startDate = groupData?.start_date || '';
  const endDate = groupData?.end_date || '';
  const scheduledResources = new Set(
    (activities || [])
      .map((activity) => activity?.resourceId ?? activity?.resource_id)
      .filter((id) => typeof id === 'string')
  );
  const mealDefaults = {
    breakfast: { start: '07:30', end: '08:30', label: '早餐' },
    lunch: { start: '12:00', end: '13:00', label: '午餐' },
    dinner: { start: '18:00', end: '19:00', label: '晚餐' }
  };
  const resources = [];

  logistics.forEach((row) => {
    const date = row?.date;
    if (!date) return;

    const isStartDay = Boolean(startDate && date === startDate);
    const isEndDay = Boolean(endDate && date === endDate);
    const meals = row.meals || {};

    ['breakfast', 'lunch', 'dinner'].forEach((key) => {
      if (!isMealFilled(meals, key)) return;
      const resourceId = buildShixingResourceId(date, 'meal', key);
      if (scheduledResources.has(resourceId)) return;

      const defaults = mealDefaults[key] || {};
      const duration = calcDurationHours(
        meals[`${key}_time`] || defaults.start,
        meals[`${key}_end`] || defaults.end,
        60
      );

      resources.push({
        id: resourceId,
        type: 'meal',
        title: meals[key] || defaults.label || key,
        duration,
        description: '',
        locationName: meals[`${key}_place`] || defaults.label || '',
        fixedDate: date
      });
    });

    const pickup = row.pickup || {};
    if (isStartDay && !pickup.disabled) {
      const resourceId = buildShixingResourceId(date, 'pickup');
      if (!scheduledResources.has(resourceId)) {
        resources.push({
          id: resourceId,
          type: 'transport',
          title: '接站',
          duration: calcDurationHours(pickup.time, pickup.end_time, 60),
          description: buildTransferDescription(pickup),
          locationName: pickup.location || '接站',
          fixedDate: date
        });
      }
    }

    const dropoff = row.dropoff || {};
    if (isEndDay && !dropoff.disabled) {
      const resourceId = buildShixingResourceId(date, 'dropoff');
      if (!scheduledResources.has(resourceId)) {
        resources.push({
          id: resourceId,
          type: 'transport',
          title: '送站',
          duration: calcDurationHours(dropoff.time, dropoff.end_time, 60),
          description: buildTransferDescription(dropoff),
          locationName: dropoff.location || '送站',
          fixedDate: date
        });
      }
    }
  });

  return resources;
}, [groupData?.logistics, groupData?.start_date, groupData?.end_date, activities]);

export default useCalendarDetailShixingResources;
