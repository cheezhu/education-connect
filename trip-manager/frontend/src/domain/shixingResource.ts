import { parseShixingResourceId } from './resourceId';

export const formatShixingResourceDetail = (resourceId: unknown): string => {
  const parsed = parseShixingResourceId(resourceId);
  if (!parsed) return '';

  const { category, key } = parsed;
  if (category === 'meal') {
    if (key === 'breakfast') return '早餐';
    if (key === 'lunch') return '午餐';
    if (key === 'dinner') return '晚餐';
    return '餐饮';
  }
  if (category === 'pickup') return '接站';
  if (category === 'dropoff') return '送站';
  return '食行卡片';
};

