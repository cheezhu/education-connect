import { useMemo } from 'react';
import { calcDurationHours } from '../utils/time';
import { buildShixingResourceId } from '../../../../domain/resourceId';
import {
  SHIXING_MEAL_DEFAULTS,
  SHIXING_MEAL_KEYS,
  SHIXING_MEAL_LABELS,
  SHIXING_TRANSFER_LABELS
} from '../../../../domain/shixingConfig';

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
  const resources = [];

  logistics.forEach((row) => {
    const date = row?.date;
    if (!date) return;

    const isStartDay = Boolean(startDate && date === startDate);
    const isEndDay = Boolean(endDate && date === endDate);
    const meals = row.meals || {};

    SHIXING_MEAL_KEYS.forEach((key) => {
      if (!isMealFilled(meals, key)) return;
      const resourceId = buildShixingResourceId(date, 'meal', key);
      if (scheduledResources.has(resourceId)) return;

      const defaults = SHIXING_MEAL_DEFAULTS[key] || {};
      const duration = calcDurationHours(
        meals[`${key}_time`] || defaults.start,
        meals[`${key}_end`] || defaults.end,
        60
      );
      const fallbackLabel = SHIXING_MEAL_LABELS[key] || key;

      resources.push({
        id: resourceId,
        type: 'meal',
        title: meals[key] || fallbackLabel,
        duration,
        description: '',
        locationName: meals[`${key}_place`] || fallbackLabel,
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
          title: SHIXING_TRANSFER_LABELS.pickup,
          duration: calcDurationHours(pickup.time, pickup.end_time, 60),
          description: buildTransferDescription(pickup),
          locationName: pickup.location || SHIXING_TRANSFER_LABELS.pickup,
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
          title: SHIXING_TRANSFER_LABELS.dropoff,
          duration: calcDurationHours(dropoff.time, dropoff.end_time, 60),
          description: buildTransferDescription(dropoff),
          locationName: dropoff.location || SHIXING_TRANSFER_LABELS.dropoff,
          fixedDate: date
        });
      }
    }
  });

  return resources;
}, [groupData?.logistics, groupData?.start_date, groupData?.end_date, activities]);

export default useCalendarDetailShixingResources;
