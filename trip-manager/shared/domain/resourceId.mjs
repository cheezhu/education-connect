// Shared domain (ESM): resource id helpers and classification used by the frontend.

/**
 * @typedef {'plan'|'shixing'|'custom'|'unknown'} ResourceKind
 */

/**
 * @param {unknown} obj
 * @returns {string}
 */
export function getResourceId(obj) {
  if (!obj || typeof obj !== 'object') return '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyObj = /** @type {any} */ (obj);
  return String(anyObj.resourceId ?? anyObj.resource_id ?? '');
}

/**
 * plan-* / plan-sync-*
 * @param {unknown} resourceId
 * @returns {boolean}
 */
export function isPlanResourceId(resourceId) {
  return (
    typeof resourceId === 'string'
    && (resourceId.startsWith('plan-') || resourceId.startsWith('plan-sync-'))
  );
}

// "食行卡片" is stored with the legacy prefix daily:* for backward-compat.
/**
 * @param {unknown} resourceId
 * @returns {boolean}
 */
export function isShixingResourceId(resourceId) {
  return typeof resourceId === 'string' && resourceId.startsWith('daily:');
}

/**
 * @param {unknown} resourceId
 * @returns {boolean}
 */
export function isCustomResourceId(resourceId) {
  return typeof resourceId === 'string' && resourceId.startsWith('custom:');
}

/**
 * @param {unknown} resourceId
 * @returns {ResourceKind}
 */
export function resolveResourceKind(resourceId) {
  if (isPlanResourceId(resourceId)) return 'plan';
  if (isShixingResourceId(resourceId)) return 'shixing';
  if (isCustomResourceId(resourceId)) return 'custom';
  return 'unknown';
}

/**
 * @typedef {'meal'|'pickup'|'dropoff'|string} ShixingCategory
 */

/**
 * @param {string} date
 * @param {ShixingCategory} category
 * @param {string=} key
 * @returns {string}
 */
export function buildShixingResourceId(date, category, key) {
  if (!date) return '';
  if (category === 'meal') {
    const mealKey = key || '';
    return `daily:${date}:meal:${mealKey}`;
  }
  return `daily:${date}:${category}`;
}

/**
 * @typedef {{date: string, category: ShixingCategory, key?: string}} ParsedShixingResourceId
 */

/**
 * @param {unknown} resourceId
 * @returns {ParsedShixingResourceId|null}
 */
export function parseShixingResourceId(resourceId) {
  if (typeof resourceId !== 'string') return null;
  if (!resourceId.startsWith('daily:')) return null;
  const parts = resourceId.split(':');
  const date = parts[1] || '';
  const category = parts[2] || '';
  const key = parts[3] || '';
  if (!date || !category) return null;
  return key ? { date, category, key } : { date, category };
}

