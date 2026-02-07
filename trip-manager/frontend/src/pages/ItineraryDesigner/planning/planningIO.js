import dayjs from 'dayjs';
import { iterateDateStrings, maxDate, minDate } from '../shared/dates';
import { parseDelimitedIdList, parseDelimitedList } from '../shared/parse';
import { normalizeImportedTimeSlot } from '../shared/timeSlots';

export const triggerDownload = (blob, filename) => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const escapeCsvValue = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const parseCsvRows = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      row.push(cell);
      if (row.some(item => String(item || '').trim() !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }

    if (char !== '\r') {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some(item => String(item || '').trim() !== '')) {
    rows.push(row);
  }
  return rows;
};

export const normalizeCsvHeader = (value) => (
  String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[_-]/g, '')
    .toLowerCase()
);

export const buildPlanningTemplateCsv = (payload, selectedGroupIds = []) => {
  const selectedSet = new Set(
    (selectedGroupIds || [])
      .map(id => Number(id))
      .filter(Number.isFinite)
  );
  const groups = Array.isArray(payload?.data?.groups)
    ? payload.data.groups
    : (Array.isArray(payload?.groups) ? payload.groups : []);
  const locations = Array.isArray(payload?.data?.locations)
    ? payload.data.locations
    : (Array.isArray(payload?.locations) ? payload.locations : []);
  const locationsById = new Map(locations.map(location => [Number(location.id), location]));
  const requiredLocationsByGroup = payload?.data?.requiredLocationsByGroup
    && typeof payload.data.requiredLocationsByGroup === 'object'
    ? payload.data.requiredLocationsByGroup
    : {};
  const targetGroups = groups
    .filter(group => selectedSet.size === 0 || selectedSet.has(Number(group.id)));

  const slotKeys = Array.isArray(payload?.rules?.timeSlots) && payload.rules.timeSlots.length
    ? payload.rules.timeSlots.map(slot => String(slot || '').toUpperCase()).filter(Boolean)
    : ['MORNING', 'AFTERNOON', 'EVENING'];
  const slotLabels = {
    MORNING: '上午',
    AFTERNOON: '下午',
    EVENING: '晚上'
  };

  const existingByKey = new Map();
  const existingAssignments = Array.isArray(payload?.data?.existingAssignments)
    ? payload.data.existingAssignments
    : (Array.isArray(payload?.existing?.activities) ? payload.existing.activities : []);
  existingAssignments.forEach((activity) => {
    const groupId = Number(activity.groupId ?? activity.group_id);
    if (!Number.isFinite(groupId)) return;
    const activityDate = activity.date || activity.activity_date;
    const timeSlot = String(activity.timeSlot || activity.time_slot || '').toUpperCase();
    if (!activityDate || !timeSlot) return;
    const key = `${groupId}|${activityDate}|${timeSlot}`;
    if (!existingByKey.has(key)) {
      existingByKey.set(key, activity);
    }
  });

  const header = [
    '团组ID',
    '团组名称',
    '日期',
    '时段',
    '地点ID',
    '地点名称',
    '预计人数',
    '必去行程点ID列表',
    '必去行程点名称列表',
    '本行是否必去',
    '备注'
  ];
  const lines = [header.map(escapeCsvValue).join(',')];

  targetGroups.forEach((group) => {
    const groupId = Number(group.id);
    const rangeStart = payload?.scope?.startDate || payload?.range?.startDate;
    const rangeEnd = payload?.scope?.endDate || payload?.range?.endDate;
    const groupStartDate = group.startDate || group.start_date;
    const groupEndDate = group.endDate || group.end_date;
    const groupStart = maxDate(rangeStart, groupStartDate);
    const groupEnd = minDate(rangeEnd, groupEndDate);
    const groupDates = iterateDateStrings(groupStart, groupEnd);
    const fallbackParticipants = Number(group.participantCount)
      || ((group.studentCount || group.student_count || 0) + (group.teacherCount || group.teacher_count || 0));
    const requiredGroup = requiredLocationsByGroup[String(groupId)];
    const requiredLocationIds = Array.from(new Set(
      (Array.isArray(requiredGroup?.locationIds) ? requiredGroup.locationIds : [])
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && id > 0)
    ));
    const requiredLocationNames = requiredLocationIds
      .map(locationId => (
        locationsById.get(locationId)?.name
        || `#${locationId}`
      ));
    const requiredLocationSet = new Set(requiredLocationIds);
    const requiredIdsText = requiredLocationIds.join('|');
    const requiredNamesText = requiredLocationNames.join(' | ');

    groupDates.forEach((date) => {
      slotKeys.forEach((slotKey) => {
        const existing = existingByKey.get(`${groupId}|${date}|${slotKey}`);
        const locationId = Number(existing?.location_id ?? existing?.locationId);
        const location = Number.isFinite(locationId) ? locationsById.get(locationId) : null;
        const participants = Number(existing?.participant_count ?? existing?.participantCount);
        const isRequired = Number.isFinite(locationId) && requiredLocationSet.has(locationId) ? '是' : '';
        const row = [
          groupId,
          group.name || '',
          date,
          slotLabels[slotKey] || slotKey,
          Number.isFinite(locationId) ? locationId : '',
          location?.name || '',
          Number.isFinite(participants) && participants > 0 ? participants : fallbackParticipants,
          requiredIdsText,
          requiredNamesText,
          isRequired,
          ''
        ];
        lines.push(row.map(escapeCsvValue).join(','));
      });
    });
  });

  return `\uFEFF${lines.join('\r\n')}`;
};

export const buildPlanningResultPayloadFromCsv = (
  text,
  fileName,
  { groups = [], locations = [] } = {}
) => {
  const rows = parseCsvRows(text || '');
  if (rows.length < 2) {
    throw new Error('CSV 内容为空');
  }

  const headers = rows[0].map(item => String(item || '').trim());
  const normalizedHeaders = headers.map(normalizeCsvHeader);
  const findColumn = (aliases) => normalizedHeaders.findIndex((column) => aliases.includes(column));
  const readCell = (row, aliases) => {
    const index = findColumn(aliases);
    if (index < 0) return '';
    return String(row[index] ?? '').trim();
  };

  const groupNameToId = new Map(
    groups
      .map(group => [String(group.name || '').trim(), Number(group.id)])
      .filter(([name, id]) => name && Number.isFinite(id))
  );
  const groupIdToName = new Map(
    groups.map(group => [Number(group.id), String(group.name || '').trim() || `#${group.id}`])
  );
  const locationNameToId = new Map(
    locations
      .map(location => [String(location.name || '').trim(), Number(location.id)])
      .filter(([name, id]) => name && Number.isFinite(id))
  );
  const locationIdToName = new Map(
    locations
      .map(location => [Number(location.id), String(location.name || '').trim() || `#${location.id}`])
      .filter(([id]) => Number.isFinite(id))
  );
  const groupSizeById = new Map(
    groups.map(group => [Number(group.id), (group.student_count || 0) + (group.teacher_count || 0)])
  );

  const assignments = [];
  const errors = [];
  const requiredByGroup = new Map();
  const requiredNameByGroup = new Map();

  rows.slice(1).forEach((row, index) => {
    const rowNo = index + 2;
    const groupIdText = readCell(row, ['groupid', 'group_id', '团组id', '团组编号']);
    const groupNameText = readCell(row, ['groupname', 'group_name', '团组名称']);
    const dateText = readCell(row, ['date', 'activitydate', '日期']);
    const slotText = readCell(row, ['timeslot', 'time_slot', '时段']);
    const locationIdText = readCell(row, ['locationid', 'location_id', '地点id']);
    const locationNameText = readCell(row, ['locationname', 'location_name', '地点名称', '行程点名称']);
    const participantText = readCell(row, ['participantcount', 'participant_count', '预计人数', '人数']);
    const requiredLocationIdsText = readCell(row, [
      'requiredlocationids',
      'required_location_ids',
      'mustlocationids',
      'must_location_ids',
      '必去行程点id列表',
      '必去地点id列表',
      '必去行程点id',
      '必去地点id'
    ]);
    const requiredLocationNamesText = readCell(row, [
      'requiredlocationnames',
      'required_location_names',
      'mustlocationnames',
      'must_location_names',
      '必去行程点名称列表',
      '必去地点名称列表',
      '必去行程点名称',
      '必去地点名称'
    ]);
    const notes = readCell(row, ['notes', 'note', '备注']);

    if (!groupIdText && !groupNameText && !dateText && !slotText && !locationIdText && !locationNameText) {
      return;
    }

    let groupId = Number(groupIdText);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      groupId = groupNameToId.get(groupNameText) || NaN;
    }
    let locationId = Number(locationIdText);
    if (!Number.isFinite(locationId) || locationId <= 0) {
      locationId = locationNameToId.get(locationNameText) || NaN;
    }
    const timeSlot = normalizeImportedTimeSlot(slotText);
    const participantCount = Number(participantText);

    if (!Number.isFinite(groupId) || groupId <= 0) {
      errors.push(`第${rowNo}行：团组无法识别`);
      return;
    }
    const groupKey = Math.floor(groupId);
    const requiredIds = parseDelimitedIdList(requiredLocationIdsText);
    const requiredNames = parseDelimitedList(requiredLocationNamesText);
    if (requiredIds.length > 0) {
      let requiredSet = requiredByGroup.get(groupKey);
      if (!requiredSet) {
        requiredSet = new Set();
        requiredByGroup.set(groupKey, requiredSet);
      }
      let requiredNameMap = requiredNameByGroup.get(groupKey);
      if (!requiredNameMap) {
        requiredNameMap = new Map();
        requiredNameByGroup.set(groupKey, requiredNameMap);
      }
      requiredIds.forEach((id, idx) => {
        requiredSet.add(id);
        const name = requiredNames[idx] || locationIdToName.get(id) || `#${id}`;
        requiredNameMap.set(id, name);
      });
    }
    if (!dayjs(dateText).isValid()) {
      errors.push(`第${rowNo}行：日期无效`);
      return;
    }
    if (!timeSlot) {
      errors.push(`第${rowNo}行：时段无效（需为上午/下午/晚上或 MORNING/AFTERNOON/EVENING）`);
      return;
    }
    if (!Number.isFinite(locationId) || locationId <= 0) {
      errors.push(`第${rowNo}行：地点无法识别`);
      return;
    }

    assignments.push({
      groupId: Math.floor(groupId),
      date: dayjs(dateText).format('YYYY-MM-DD'),
      timeSlot,
      locationId: Math.floor(locationId),
      participantCount: Number.isFinite(participantCount) && participantCount > 0
        ? Math.floor(participantCount)
        : (groupSizeById.get(Math.floor(groupId)) || null),
      notes: notes || `csv:${fileName || 'import'}`
    });
  });

  if (errors.length > 0) {
    throw new Error(errors.slice(0, 5).join('；'));
  }
  if (!assignments.length) {
    throw new Error('CSV 中没有可导入的有效记录');
  }

  const assignedLocationsByGroup = new Map();
  assignments.forEach((item) => {
    const groupKey = Number(item.groupId);
    const locationId = Number(item.locationId);
    if (!Number.isFinite(groupKey) || !Number.isFinite(locationId) || locationId <= 0) return;
    let set = assignedLocationsByGroup.get(groupKey);
    if (!set) {
      set = new Set();
      assignedLocationsByGroup.set(groupKey, set);
    }
    set.add(locationId);
  });

  const missingRequiredErrors = [];
  requiredByGroup.forEach((requiredSet, groupId) => {
    if (!requiredSet || requiredSet.size === 0) return;
    const assignedSet = assignedLocationsByGroup.get(groupId) || new Set();
    const nameMap = requiredNameByGroup.get(groupId) || new Map();
    const missing = Array.from(requiredSet).filter(locationId => !assignedSet.has(locationId));
    if (missing.length === 0) return;
    const missingText = missing
      .map(locationId => nameMap.get(locationId) || locationIdToName.get(locationId) || `#${locationId}`)
      .join('、');
    const groupName = groupIdToName.get(groupId) || `#${groupId}`;
    missingRequiredErrors.push(`${groupName} 缺少必去行程点：${missingText}`);
  });
  if (missingRequiredErrors.length > 0) {
    throw new Error(missingRequiredErrors.slice(0, 5).join('；'));
  }

  return {
    schema: 'ec-planning-result@1',
    snapshot_id: `csv-${Date.now()}`,
    mode: 'replaceExisting',
    assignments,
    unassigned: []
  };
};

export const extractPlanningAssignments = (payload) => (
  payload && Array.isArray(payload.assignments) ? payload.assignments : []
);

export const extractPlanningGroupIds = (payload) => {
  const ids = extractPlanningAssignments(payload)
    .map(item => Number(item?.groupId ?? item?.group_id))
    .filter(Number.isFinite);
  return Array.from(new Set(ids));
};

export const extractPlanningRange = (payload) => {
  if (!payload) return null;
  const range = payload.range || {};
  const start = range.startDate || range.start_date;
  const end = range.endDate || range.end_date;
  if (start && end) {
    return { start, end };
  }
  const dates = extractPlanningAssignments(payload)
    .map(item => item?.date)
    .filter(Boolean)
    .sort();
  if (!dates.length) return null;
  return { start: dates[0], end: dates[dates.length - 1] };
};

export const buildPlanningImportValidationKey = (payload, options) => JSON.stringify({
  snapshot: payload?.snapshot_id || '',
  assignments: extractPlanningAssignments(payload).length,
  groupIds: (options.groupIds || []).map(id => Number(id)).filter(Number.isFinite).sort((a, b) => a - b),
  replaceExisting: Boolean(options.replaceExisting),
  skipConflicts: Boolean(options.skipConflicts),
  startDate: options.startDate || '',
  endDate: options.endDate || ''
});

