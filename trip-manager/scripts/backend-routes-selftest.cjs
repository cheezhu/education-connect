/* eslint-disable no-console */
// Minimal smoke test: ensure backend route modules can be required without throwing.
//
// Run:
//   node scripts/backend-routes-selftest.cjs

const path = require('path');

const root = path.resolve(__dirname, '..');

const routes = [
  'backend/src/routes/activities.js',
  'backend/src/routes/groups.js',
  'backend/src/routes/itineraryPlans.js',
  'backend/src/routes/locations.js',
  'backend/src/routes/lock.js',
  'backend/src/routes/logistics.js',
  'backend/src/routes/members.js',
  'backend/src/routes/planning.js',
  'backend/src/routes/resources.js',
  'backend/src/routes/schedules.js',
  'backend/src/routes/statistics.js',
  'backend/src/routes/systemConfig.js',
  'backend/src/routes/users.js'
];

for (const rel of routes) {
  const abs = path.join(root, rel);
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const mod = require(abs);
  if (typeof mod !== 'function') {
    throw new Error(`[backend-routes-selftest] Expected router function from ${rel}, got ${typeof mod}`);
  }
}

console.log('[backend-routes-selftest] OK');

