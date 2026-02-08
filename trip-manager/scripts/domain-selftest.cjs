// Minimal self-test for shared domain invariants.
//
// Run:
//   node scripts/domain-selftest.cjs

const assert = require('node:assert/strict');

const time = require('../shared/domain/time.cjs');
const resourceId = require('../shared/domain/resourceId.cjs');

const run = () => {
  // Time windows must stay in sync across backend/frontend.
  assert.deepEqual(time.timeSlotKeys, ['MORNING', 'AFTERNOON', 'EVENING']);
  assert.equal(time.timeSlotWindows.MORNING.start, '06:00');
  assert.equal(time.timeSlotWindows.MORNING.end, '12:00');
  assert.equal(time.timeSlotWindows.AFTERNOON.start, '12:00');
  assert.equal(time.timeSlotWindows.AFTERNOON.end, '18:00');
  assert.equal(time.timeSlotWindows.EVENING.start, '18:00');
  assert.equal(time.timeSlotWindows.EVENING.end, '20:45');

  assert.equal(time.getTimeSlotFromStart('07:00'), 'MORNING');
  assert.equal(time.getTimeSlotFromStart('12:00'), 'AFTERNOON');
  assert.equal(time.getTimeSlotFromStart('18:00'), 'EVENING');

  assert.equal(time.normalizeImportedTimeSlot('上午'), 'MORNING');
  assert.equal(time.normalizeImportedTimeSlot('下午'), 'AFTERNOON');
  assert.equal(time.normalizeImportedTimeSlot('晚上'), 'EVENING');
  assert.equal(time.normalizeImportedTimeSlot(''), '');

  // Resource id classification must match UI expectations.
  assert.equal(resourceId.resolveResourceKind('plan-1-loc-2'), 'plan');
  assert.equal(resourceId.resolveResourceKind('plan-sync-2'), 'plan');
  assert.equal(resourceId.resolveResourceKind('daily:2026-01-01:meal:breakfast'), 'shixing');
  assert.equal(resourceId.resolveResourceKind('custom:abc'), 'custom');
  assert.equal(resourceId.resolveResourceKind(''), 'unknown');

  const built = resourceId.buildShixingResourceId('2026-02-07', 'meal', 'breakfast');
  assert.equal(built, 'daily:2026-02-07:meal:breakfast');
  assert.deepEqual(resourceId.parseShixingResourceId(built), {
    date: '2026-02-07',
    category: 'meal',
    key: 'breakfast'
  });

  console.log('[domain-selftest] OK');
};

run();
