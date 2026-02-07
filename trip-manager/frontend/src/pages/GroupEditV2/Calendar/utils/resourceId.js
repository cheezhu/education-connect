export const getResourceId = (obj) => (
  obj?.resourceId ?? obj?.resource_id ?? ''
);

export const isDailyResourceId = (resourceId) => (
  typeof resourceId === 'string' && resourceId.startsWith('daily:')
);

export const isPlanResourceId = (resourceId) => (
  typeof resourceId === 'string'
  && (resourceId.startsWith('plan-') || resourceId.startsWith('plan-sync-'))
);

export const isCustomResourceId = (resourceId) => (
  typeof resourceId === 'string' && resourceId.startsWith('custom:')
);

export const isDailyActivity = (activity) => isDailyResourceId(getResourceId(activity));

export const parseDailyDate = (resourceId) => {
  if (typeof resourceId !== 'string') return '';
  if (!resourceId.startsWith('daily:')) return '';
  const parts = resourceId.split(':');
  return parts[1] || '';
};

