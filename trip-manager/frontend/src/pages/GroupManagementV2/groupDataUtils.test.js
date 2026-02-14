import { describe, expect, it } from 'vitest';
import { buildShixingResourceId } from '../../domain/resourceId';
import {
  mergeSchedulesWithLogistics,
  syncLogisticsFromSchedules
} from './groupDataUtils';

describe('groupDataUtils mapping', () => {
  it('creates meal schedule from logistics with default meal time', () => {
    const logistics = [
      {
        date: '2025-07-01',
        meals: {
          breakfast: 'Hotel Buffet',
          breakfast_place: 'Main Hall',
          breakfast_disabled: false
        },
        pickup: {},
        dropoff: {}
      }
    ];

    const next = mergeSchedulesWithLogistics([], logistics, 7);
    const mealId = buildShixingResourceId('2025-07-01', 'meal', 'breakfast');
    const meal = next.find((item) => item.resourceId === mealId);

    expect(meal).toBeTruthy();
    expect(meal.startTime).toBe('07:30');
    expect(meal.endTime).toBe('08:30');
    expect(meal.title).toBe('Hotel Buffet');
    expect(meal.location).toBe('Main Hall');
  });

  it('creates transfer schedule with auto end time (+1h) when end is empty', () => {
    const logistics = [
      {
        date: '2025-07-01',
        meals: {},
        pickup: {
          time: '12:00',
          end_time: '',
          location: 'Airport T1',
          contact: 'Leo',
          flight_no: 'MU1234',
          airline: 'China Eastern',
          terminal: 'T1',
          note: '',
          disabled: false,
          detached: false
        },
        dropoff: {}
      }
    ];

    const next = mergeSchedulesWithLogistics([], logistics, 7);
    const pickupId = buildShixingResourceId('2025-07-01', 'pickup');
    const pickup = next.find((item) => item.resourceId === pickupId);

    expect(pickup).toBeTruthy();
    expect(pickup.startTime).toBe('12:00');
    expect(pickup.endTime).toBe('13:00');
    expect(pickup.title).toBe('接站');
  });

  it('does not create detached transfer schedule from logistics', () => {
    const logistics = [
      {
        date: '2025-07-01',
        meals: {},
        pickup: {
          time: '10:00',
          end_time: '11:00',
          location: 'Airport',
          contact: 'A',
          disabled: false,
          detached: true
        },
        dropoff: {}
      }
    ];

    const next = mergeSchedulesWithLogistics([], logistics, 7);
    const pickupId = buildShixingResourceId('2025-07-01', 'pickup');
    const pickup = next.find((item) => item.resourceId === pickupId);
    expect(pickup).toBeFalsy();
  });

  it('syncs logistics from schedules and clears deleted meal mapping', () => {
    const breakfastId = buildShixingResourceId('2025-07-01', 'meal', 'breakfast');
    const pickupId = buildShixingResourceId('2025-07-01', 'pickup');

    const logistics = [
      {
        date: '2025-07-01',
        meals: {
          breakfast: 'Old Meal',
          breakfast_place: 'Old Place',
          breakfast_disabled: false,
          breakfast_time: '07:30',
          breakfast_end: '08:30',
          breakfast_detached: false
        },
        pickup: {
          time: '09:00',
          end_time: '10:00',
          location: 'Airport',
          contact: 'Tom',
          flight_no: 'MU1234',
          airline: 'MU',
          terminal: 'T1',
          note: '',
          disabled: false,
          detached: false
        },
        dropoff: {}
      }
    ];

    const schedules = [
      {
        resourceId: pickupId,
        startTime: '11:00',
        endTime: '12:30',
        type: 'transport',
        title: '接站',
        description: 'Manual note'
      }
    ];

    const next = syncLogisticsFromSchedules(logistics, schedules);
    const row = next[0];

    expect(row.meals.breakfast).toBe('');
    expect(row.meals.breakfast_place).toBe('');
    expect(row.meals.breakfast_time).toBe('');
    expect(row.meals.breakfast_end).toBe('');
    expect(row.pickup.time).toBe('11:00');
    expect(row.pickup.end_time).toBe('12:30');
    expect(row.pickup.note).toBe('Manual note');
    expect(row.pickup.detached).toBe(false);
    expect(row.dropoff.detached).toBe(false);

    // Ensure the test actually targets one-to-one mapping via meal resource id.
    expect(breakfastId).toContain('meal');
  });
});
