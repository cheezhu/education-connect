import {
  getResourceId,
  isPlanResourceId,
  isCustomResourceId,
  isShixingResourceId,
  resolveResourceKind,
  parseShixingResourceId
} from '../../../../domain/resourceId';

export {
  getResourceId,
  isPlanResourceId,
  isCustomResourceId,
  isShixingResourceId,
  resolveResourceKind,
  parseShixingResourceId
};

export const isShixingActivity = (activity) => isShixingResourceId(getResourceId(activity));

export const parseShixingDate = (resourceId) => {
  const parsed = parseShixingResourceId(resourceId);
  return parsed?.date || '';
};

// Backward-compat exports (older imports in the codebase).
export const isDailyResourceId = isShixingResourceId;
export const isDailyActivity = isShixingActivity;
export const parseDailyDate = parseShixingDate;
