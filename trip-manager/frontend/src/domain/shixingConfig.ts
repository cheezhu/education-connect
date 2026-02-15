export const SHIXING_MEAL_KEYS = ['breakfast', 'lunch', 'dinner'] as const;

export type ShixingMealKey = (typeof SHIXING_MEAL_KEYS)[number];

export const SHIXING_MEAL_LABELS: Record<ShixingMealKey, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};

export const SHIXING_TRANSFER_LABELS = {
  pickup: '接站',
  dropoff: '送站',
} as const;

export const SHIXING_MEAL_DEFAULTS: Record<ShixingMealKey, { start: string; end: string }> = {
  breakfast: { start: '07:30', end: '08:30' },
  lunch: { start: '12:00', end: '13:00' },
  dinner: { start: '18:00', end: '19:00' },
};

export const LEGACY_MEAL_TITLES = new Set([
  '早餐',
  '午餐',
  '晚餐',
  '早饭',
  '午饭',
  '晚饭',
]);
