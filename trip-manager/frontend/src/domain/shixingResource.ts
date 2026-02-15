import { parseShixingResourceId } from './resourceId';
import { SHIXING_MEAL_LABELS, SHIXING_TRANSFER_LABELS } from './shixingConfig';

export const formatShixingResourceDetail = (resourceId: unknown): string => {
  const parsed = parseShixingResourceId(resourceId);
  if (!parsed) return '';

  const { category, key } = parsed;
  if (category === 'meal') {
    if (key === 'breakfast' || key === 'lunch' || key === 'dinner') {
      return SHIXING_MEAL_LABELS[key];
    }
    return '餐饮';
  }
  if (category === 'pickup') return SHIXING_TRANSFER_LABELS.pickup;
  if (category === 'dropoff') return SHIXING_TRANSFER_LABELS.dropoff;
  return '食行卡片';
};
