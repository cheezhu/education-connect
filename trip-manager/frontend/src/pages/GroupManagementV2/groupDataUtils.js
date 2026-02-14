import dayjs from 'dayjs';
import {
  buildShixingResourceId,
  isCustomResourceId,
  isPlanResourceId,
  isShixingResourceId,
  getResourceId
} from '../../domain/resourceId';
import { toMinutes } from '../../domain/time';
import { hashString } from '../../domain/hash';

export const SHIXING_MEAL_DEFAULTS = {
  breakfast: { start: '07:30', end: '08:30' },
  lunch: { start: '12:00', end: '13:00' },
  dinner: { start: '18:00', end: '19:00' }
};

export const MEAL_LABELS = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐'
};

export const LEGACY_MEAL_TITLES = new Set([
  '早餐',
  '午餐',
  '晚餐',
  '早饭',
  '午饭',
  '晚饭'
]);

export const GROUP_UPDATE_FIELDS = [
  'name',
  'type',
  'student_count',
  'teacher_count',
  'start_date',
  'end_date',
  'duration',
  'color',
  'contact_person',
  'contact_phone',
  'emergency_contact',
  'emergency_phone',
  'accommodation',
  'tags',
  'notes',
  'notes_images',
  'itinerary_plan_id',
  'manual_must_visit_location_ids',
  'status'
];

export const pickGroupUpdateFields = (group = {}) => (
  GROUP_UPDATE_FIELDS.reduce((acc, key) => {
    acc[key] = group[key];
    return acc;
  }, {})
);

export const isSameGroupFieldValue = (left, right) => {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  }
  return left === right;
};

export const diffGroupUpdatePayload = (nextPayload, baselinePayload = {}) => (
  GROUP_UPDATE_FIELDS.reduce((acc, key) => {
    if (!isSameGroupFieldValue(nextPayload[key], baselinePayload[key])) {
      acc[key] = nextPayload[key];
    }
    return acc;
  }, {})
);

export const getRequestErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || fallback
);

export const calcDurationMinutes = (startTime, endTime) => {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const diff = end - start;
  return diff > 0 ? diff : null;
};

export const isMealFilled = (meals, key) => {
  if (!meals || meals[`${key}_disabled`]) return false;
  return Boolean(meals[key] || meals[`${key}_place`]);
};

export const hasPickupContent = (pickup) => {
  if (!pickup || pickup.disabled) return false;
  return Boolean(
    pickup.time
    || pickup.end_time
    || pickup.location
    || pickup.contact
    || pickup.flight_no
    || pickup.airline
    || pickup.terminal
  );
};

export const buildTransferFlightSummary = (pickup) => (
  [
    pickup.flight_no && `航班 ${pickup.flight_no}`,
    pickup.airline && pickup.airline,
    pickup.terminal && pickup.terminal
  ].filter(Boolean).join(' / ')
);

export const buildTransferScheduleDescription = (transfer = {}) => {
  const note = typeof transfer.note === 'string' ? transfer.note.trim() : '';
  if (note) return note;
  return buildTransferFlightSummary(transfer);
};

export const resolveTransferNoteFromSchedule = (description, transfer = {}) => {
  const text = typeof description === 'string' ? description.trim() : '';
  if (!text) return '';
  const fallback = buildTransferFlightSummary(transfer);
  return text === fallback ? '' : text;
};

export const resolveMealArrangementFromSchedule = (schedule, fallbackKey) => {
  const title = typeof schedule?.title === 'string' ? schedule.title.trim() : '';
  const description = typeof schedule?.description === 'string' ? schedule.description.trim() : '';
  if (title && !LEGACY_MEAL_TITLES.has(title)) {
    return title;
  }
  if (description) {
    return description;
  }
  return title || (MEAL_LABELS[fallbackKey] || '');
};

export const buildCustomResource = (schedule) => {
  const startTime = schedule?.startTime || schedule?.start_time || '';
  const endTime = schedule?.endTime || schedule?.end_time || '';
  const durationMinutes = calcDurationMinutes(startTime, endTime) || 60;
  const durationHours = Math.max(0.5, durationMinutes / 60);
  const title = schedule?.title || schedule?.location || '自定义活动';
  const type = schedule?.type || 'activity';
  const hash = hashString(`${type}|${title}|${durationMinutes}`);
  const resourceId = getResourceId(schedule);
  const id = (
    isCustomResourceId(resourceId)
      ? resourceId
      : `custom:${hash}`
  );

  return {
    id,
    type,
    title,
    duration: durationHours,
    description: schedule?.description || '',
    locationName: schedule?.location || title,
    color: schedule?.color || '',
    isUnique: false
  };
};

export const mergeCustomResources = (existing = [], schedules = []) => {
  const map = new Map();
  existing.forEach((item) => {
    if (item?.id) {
      map.set(item.id, item);
    }
  });

  schedules.forEach((schedule) => {
    const resourceId = getResourceId(schedule);
    if (resourceId && (isShixingResourceId(resourceId) || isPlanResourceId(resourceId))) return;

    const resource = buildCustomResource(schedule);
    const existingItem = map.get(resource.id);
    map.set(resource.id, existingItem ? { ...existingItem, ...resource } : resource);
  });

  return Array.from(map.values());
};

export const buildScheduleSignature = (schedules = []) => (
  schedules
    .map((schedule) => {
      const resourceId = getResourceId(schedule);
      return [
        resourceId,
        schedule.date || schedule.activity_date || '',
        schedule.startTime || schedule.start_time || '',
        schedule.endTime || schedule.end_time || '',
        schedule.type || '',
        schedule.title || '',
        schedule.location || '',
        schedule.description || ''
      ].join('|');
    })
    .sort()
    .join('||')
);

export const syncLogisticsFromSchedules = (logistics = [], schedules = []) => {
  if (!Array.isArray(logistics) || logistics.length === 0) return logistics;

  const scheduleMap = new Map();
  schedules.forEach((schedule) => {
    const resourceId = getResourceId(schedule);
    if (isShixingResourceId(resourceId)) {
      scheduleMap.set(resourceId, schedule);
    }
  });

  return logistics.map((row) => {
    const meals = { ...(row.meals || {}) };
    const pickup = { ...(row.pickup || {}) };
    const dropoff = { ...(row.dropoff || {}) };

    ['breakfast', 'lunch', 'dinner'].forEach((key) => {
      const resourceId = buildShixingResourceId(row.date, 'meal', key);
      const schedule = scheduleMap.get(resourceId);
      if (schedule) {
        meals[`${key}_time`] = schedule.startTime || schedule.start_time || '';
        meals[`${key}_end`] = schedule.endTime || schedule.end_time || '';
        meals[key] = resolveMealArrangementFromSchedule(schedule, key) || meals[key] || '';
        meals[`${key}_place`] = schedule.location || meals[`${key}_place`] || '';
        meals[`${key}_disabled`] = false;
        meals[`${key}_detached`] = false;
      } else if (meals[`${key}_disabled`]) {
        meals[`${key}_time`] = '';
        meals[`${key}_end`] = '';
        meals[`${key}_detached`] = false;
      } else if (isMealFilled(meals, key)) {
        // One-to-one mapping mode: deleting meal event on calendar clears meal card fields.
        meals[key] = '';
        meals[`${key}_place`] = '';
        meals[`${key}_time`] = '';
        meals[`${key}_end`] = '';
        meals[`${key}_detached`] = false;
      } else {
        meals[`${key}_detached`] = false;
      }
    });

    const pickupId = buildShixingResourceId(row.date, 'pickup');
    const pickupSchedule = scheduleMap.get(pickupId);
    if (pickupSchedule) {
      pickup.time = pickupSchedule.startTime || pickupSchedule.start_time || '';
      pickup.end_time = pickupSchedule.endTime || pickupSchedule.end_time || '';
      pickup.note = resolveTransferNoteFromSchedule(pickupSchedule.description || '', pickup);
      pickup.detached = false;
    } else if (hasPickupContent(pickup)) {
      pickup.detached = true;
    } else {
      pickup.detached = false;
    }

    const dropoffId = buildShixingResourceId(row.date, 'dropoff');
    const dropoffSchedule = scheduleMap.get(dropoffId);
    if (dropoffSchedule) {
      dropoff.time = dropoffSchedule.startTime || dropoffSchedule.start_time || '';
      dropoff.end_time = dropoffSchedule.endTime || dropoffSchedule.end_time || '';
      dropoff.note = resolveTransferNoteFromSchedule(dropoffSchedule.description || '', dropoff);
      dropoff.detached = false;
    } else if (hasPickupContent(dropoff)) {
      dropoff.detached = true;
    } else {
      dropoff.detached = false;
    }

    return {
      ...row,
      meals,
      pickup,
      dropoff
    };
  });
};

export const mergeSchedulesWithLogistics = (schedules = [], logistics = [], groupId) => {
  if (!groupId || !Array.isArray(logistics)) return schedules || [];
  const nextSchedules = (schedules || []).map((item) => ({ ...item }));
  const scheduleByResource = new Map();
  nextSchedules.forEach((schedule) => {
    const resourceId = getResourceId(schedule);
    if (resourceId) {
      scheduleByResource.set(resourceId, schedule);
    }
  });

  const toRemove = new Set();

  const removeByResource = (resourceId) => {
    const existing = scheduleByResource.get(resourceId);
    if (existing) {
      toRemove.add(existing);
    }
  };

  const upsertSchedule = (resourceId, payload, allowCreate = false) => {
    const existing = scheduleByResource.get(resourceId);
    if (existing) {
      Object.assign(existing, payload);
      return;
    }
    if (!allowCreate) return;
    const newSchedule = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      ...payload,
      resourceId,
      isFromResource: true
    };
    nextSchedules.push(newSchedule);
    scheduleByResource.set(resourceId, newSchedule);
  };

  logistics.forEach((row) => {
    const date = row.date;
    const meals = row.meals || {};
    const pickup = row.pickup || {};
    const dropoff = row.dropoff || {};

    ['breakfast', 'lunch', 'dinner'].forEach((key) => {
      const resourceId = buildShixingResourceId(date, 'meal', key);
      if (!isMealFilled(meals, key)) {
        removeByResource(resourceId);
        return;
      }

      const existing = scheduleByResource.get(resourceId);
      const location = meals[`${key}_place`] || '';
      const arrangement = meals[key] || '';
      const basePayload = {
        groupId,
        date,
        type: 'meal',
        title: arrangement || MEAL_LABELS[key],
        location,
        description: '',
        resourceId,
        isFromResource: true
      };

      if (existing) {
        upsertSchedule(resourceId, basePayload);
        return;
      }

      const defaultTime = SHIXING_MEAL_DEFAULTS[key] || {};
      const startTime = meals[`${key}_time`] || defaultTime.start;
      const endTime = meals[`${key}_end`] || defaultTime.end;
      if (!startTime || !endTime) return;

      upsertSchedule(resourceId, {
        ...basePayload,
        startTime,
        endTime
      }, true);
    });

    const handleTransfer = (key, label, data) => {
      const resourceId = buildShixingResourceId(date, key);
      if (!hasPickupContent(data)) {
        removeByResource(resourceId);
        return;
      }

      const startTime = data.time || '';
      const endTime = data.end_time
        || (startTime
          ? dayjs(`2000-01-01 ${startTime}`, 'YYYY-MM-DD HH:mm').add(1, 'hour').format('HH:mm')
          : '');
      const hasTimeRange = Boolean(startTime && endTime);
      const basePayload = {
        groupId,
        date,
        type: 'transport',
        title: label,
        location: data.location || '',
        description: buildTransferScheduleDescription(data),
        resourceId,
        isFromResource: true
      };

      const existing = scheduleByResource.get(resourceId);
      if (existing) {
        if (!hasTimeRange) {
          removeByResource(resourceId);
          return;
        }
        upsertSchedule(resourceId, {
          ...basePayload,
          startTime,
          endTime
        });
        return;
      }

      if (!hasTimeRange || data.detached) return;

      upsertSchedule(resourceId, {
        ...basePayload,
        startTime,
        endTime
      }, true);
    };

    handleTransfer('pickup', '接站', pickup);
    handleTransfer('dropoff', '送站', dropoff);
  });

  return nextSchedules.filter((item) => !toRemove.has(item));
};

export const createEmptyLogisticsRow = (date) => ({
  date,
  city: '',
  departure_city: '',
  arrival_city: '',
  hotel: '',
  hotel_address: '',
  hotel_disabled: false,
  vehicle: { driver: '', plate: '', phone: '' },
  vehicle_disabled: false,
  guide: { name: '', phone: '' },
  guide_disabled: false,
  security: { name: '', phone: '' },
  security_disabled: false,
  meals: {
    breakfast: '',
    breakfast_place: '',
    breakfast_disabled: false,
    breakfast_time: '',
    breakfast_end: '',
    breakfast_detached: false,
    lunch: '',
    lunch_place: '',
    lunch_disabled: false,
    lunch_time: '',
    lunch_end: '',
    lunch_detached: false,
    dinner: '',
    dinner_place: '',
    dinner_disabled: false,
    dinner_time: '',
    dinner_end: '',
    dinner_detached: false
  },
  pickup: {
    time: '',
    end_time: '',
    location: '',
    contact: '',
    flight_no: '',
    airline: '',
    terminal: '',
    note: '',
    disabled: false,
    detached: false
  },
  dropoff: {
    time: '',
    end_time: '',
    location: '',
    contact: '',
    flight_no: '',
    airline: '',
    terminal: '',
    note: '',
    disabled: false,
    detached: false
  },
  note: ''
});
