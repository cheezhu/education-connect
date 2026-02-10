const { getAiRules } = require('./aiConfig');

class PlanningInputBuildError extends Error {
  constructor(status, body) {
    super(body?.error || 'Build planning input failed');
    this.name = 'PlanningInputBuildError';
    this.status = status;
    this.body = body;
  }
}

const isValidDate = (value) => {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
};

const parseJsonSafe = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const parseObjectSafe = (value) => {
  const parsed = parseJsonSafe(value, null);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return null;
  }
  return parsed;
};

const parseArraySafe = (value) => {
  const parsed = parseJsonSafe(value, null);
  return Array.isArray(parsed) ? parsed : [];
};

const buildSnapshotId = () => {
  const timestamp = new Date().toISOString();
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}_${random}`;
};

const buildPlanningInputFilename = (snapshotId) => {
  const safe = snapshotId.replace(/[:.]/g, '-');
  return `planning_input_${safe}.json`;
};

const normalizeLocationIdList = (value) => {
  if (Array.isArray(value)) {
    return Array.from(new Set(
      value
        .map(item => Number(item))
        .filter(id => Number.isFinite(id) && id > 0)
    ));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    const parsed = parseJsonSafe(trimmed, null);
    if (Array.isArray(parsed)) {
      return normalizeLocationIdList(parsed);
    }
    return Array.from(new Set(
      trimmed
        .split(/[,\uFF0C\u3001;|]/)
        .map(item => Number(item.trim()))
        .filter(id => Number.isFinite(id) && id > 0)
    ));
  }
  return [];
};

const buildPlanningInputPayload = (db, params) => {
  const {
    groupIds,
    startDate,
    endDate,
    includeExistingActivities = true,
    includeExistingSchedules = true,
    includePlanItemsByGroup = true
  } = params || {};

  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    throw new PlanningInputBuildError(400, { error: '缺少团组ID' });
  }

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    throw new PlanningInputBuildError(400, { error: '日期范围无效' });
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new PlanningInputBuildError(400, { error: '日期范围无效' });
  }

  const uniqueGroupIds = Array.from(new Set(groupIds.map(id => Number(id)).filter(Number.isFinite)));
  if (uniqueGroupIds.length === 0) {
    throw new PlanningInputBuildError(400, { error: '团组ID无效' });
  }

  const placeholders = uniqueGroupIds.map(() => '?').join(', ');
  const groups = db.prepare(`
    SELECT id, name, type, student_count, teacher_count, start_date, end_date,
      itinerary_plan_id, must_visit_mode, manual_must_visit_location_ids
    FROM groups
    WHERE id IN (${placeholders})
  `).all(...uniqueGroupIds);

  if (!groups || groups.length === 0) {
    throw new PlanningInputBuildError(400, { error: '团组不存在' });
  }

  const filteredGroups = groups.filter(group => (
    group.start_date <= endDate && group.end_date >= startDate
  ));

  if (filteredGroups.length === 0) {
    throw new PlanningInputBuildError(400, { error: '日期范围内无团组' });
  }

  const filteredGroupIds = filteredGroups.map(group => group.id);
  const filteredPlaceholders = filteredGroupIds.map(() => '?').join(', ');

  const allLocations = db.prepare(`
    SELECT id, name, address, capacity, cluster_prefer_same_day, blocked_weekdays, open_hours, closed_dates, target_groups, is_active
    FROM locations
  `).all();
  const activeLocations = allLocations.filter(location => Boolean(location.is_active));
  const locationMap = new Map(
    allLocations.map(location => [Number(location.id), location])
  );

  const mustVisitByGroup = {};
  const exportValidationErrors = [];

  filteredGroups.forEach(group => {
    const groupId = Number(group.id);
    const groupKey = String(groupId);
    const groupName = group.name || `#${groupId}`;
    const manualIds = normalizeLocationIdList(group.manual_must_visit_location_ids);
    if (manualIds.length === 0) {
      exportValidationErrors.push(`${groupName} 未勾选必去行程点`);
    }

    const rawItems = manualIds.map((locationId, index) => ({
      location_id: locationId,
      sort_order: index
    }));

    const normalizedMustVisit = [];
    rawItems.forEach((item, index) => {
      const locationId = Number(item.location_id);
      const sortOrder = Number.isFinite(Number(item.sort_order))
        ? Number(item.sort_order)
        : index;
      if (!Number.isFinite(locationId) || locationId <= 0) {
        exportValidationErrors.push(`${groupName} 存在无效必去地点ID：${item.location_id}`);
        return;
      }
      const location = locationMap.get(locationId);
      if (!location) {
        exportValidationErrors.push(`${groupName} 的必去地点不存在：#${locationId}`);
        return;
      }
      if (!location.is_active) {
        exportValidationErrors.push(`${groupName} 的必去地点已停用：${location.name || `#${locationId}`}`);
        return;
      }
      normalizedMustVisit.push({
        location_id: locationId,
        location_name: location.name || '',
        sort_order: sortOrder,
        source: 'manual'
      });
    });

    mustVisitByGroup[groupKey] = normalizedMustVisit;
  });

  if (exportValidationErrors.length > 0) {
    throw new PlanningInputBuildError(409, {
      error: '导出前校验失败，请先修复必去行程点配置',
      code: 'EXPORT_VALIDATION_FAILED',
      details: exportValidationErrors.slice(0, 50)
    });
  }

  const activities = includeExistingActivities
    ? db.prepare(`
        SELECT group_id, location_id, activity_date, time_slot, participant_count
        FROM activities
        WHERE activity_date BETWEEN ? AND ?
      `).all(startDate, endDate)
    : [];

  const schedules = includeExistingSchedules
    ? db.prepare(`
        SELECT group_id, activity_date, start_time, end_time, is_from_resource, location_id
        FROM schedules
        WHERE group_id IN (${filteredPlaceholders})
          AND activity_date BETWEEN ? AND ?
      `).all(...filteredGroupIds, startDate, endDate)
    : [];

  const snapshotId = buildSnapshotId();
  const exportedAt = new Date().toISOString();
  const rules = getAiRules(db);

  const groupExportRows = filteredGroups.map((group) => ({
    id: group.id,
    name: group.name,
    type: group.type,
    studentCount: group.student_count,
    teacherCount: group.teacher_count,
    participantCount: (group.student_count || 0) + (group.teacher_count || 0),
    startDate: group.start_date,
    endDate: group.end_date,
    itineraryPlanId: group.itinerary_plan_id || null
  }));

  const locationExportRows = activeLocations.map((location) => ({
    id: location.id,
    name: location.name,
    address: location.address,
    capacity: location.capacity,
    clusterPreferSameDay: Boolean(location.cluster_prefer_same_day),
    blockedWeekdays: location.blocked_weekdays ?? '',
    closedDates: parseArraySafe(location.closed_dates),
    openHours: parseObjectSafe(location.open_hours),
    targetGroups: location.target_groups,
    isActive: Boolean(location.is_active)
  }));

  const requiredLocationsByGroup = includePlanItemsByGroup
    ? filteredGroups.reduce((result, group) => {
      const groupId = Number(group.id);
      const groupKey = String(groupId);
      const rows = Array.isArray(mustVisitByGroup[groupKey]) ? mustVisitByGroup[groupKey] : [];
      result[groupKey] = {
        locationIds: rows
          .map(item => Number(item.location_id))
          .filter(id => Number.isFinite(id) && id > 0)
      };
      return result;
    }, {})
    : {};

  const existingAssignments = activities.map((row) => ({
    groupId: row.group_id,
    locationId: row.location_id,
    date: row.activity_date,
    timeSlot: row.time_slot,
    participantCount: row.participant_count
  }));

  const existingSchedules = schedules.map((row) => ({
    groupId: row.group_id,
    date: row.activity_date,
    startTime: row.start_time,
    endTime: row.end_time,
    isFromResource: Boolean(row.is_from_resource),
    locationId: row.location_id ?? null
  }));

  const payload = {
    schema: 'ec-planning-input@2',
    meta: {
      snapshotId,
      exportedAt
    },
    scope: {
      startDate,
      endDate,
      groupIds: filteredGroupIds
    },
    rules,
    data: {
      groups: groupExportRows,
      locations: locationExportRows,
      requiredLocationsByGroup,
      existingAssignments,
      existingSchedules
    }
  };

  return {
    payload,
    snapshotId,
    exportedAt,
    filename: buildPlanningInputFilename(snapshotId)
  };
};

module.exports = {
  PlanningInputBuildError,
  buildPlanningInputFilename,
  buildPlanningInputPayload
};

