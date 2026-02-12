const CANCELLED_STATUS = '\u5df2\u53d6\u6d88';
const ALLOWED_GROUP_TYPES = new Set(['primary', 'secondary', 'vip']);
const GROUP_CODE_PREFIX = 'TG';

const GROUP_TYPE_ALIASES = new Map([
  ['primary', 'primary'],
  ['\u5c0f\u5b66', 'primary'],
  ['\u5c0f\u5b78', 'primary'],
  ['灏忓', 'primary'], // mojibake variant
  ['\u00e5\u00b0\u008f\u00e5\u00ad\u00a6', 'primary'], // mojibake variant
  ['secondary', 'secondary'],
  ['\u4e2d\u5b66', 'secondary'],
  ['\u4e2d\u5b78', 'secondary'],
  ['涓', 'secondary'], // mojibake variant
  ['\u00e4\u00b8\u00ad\u00e5\u00ad\u00a6', 'secondary'], // mojibake variant
  ['vip', 'vip']
]);

const GROUP_COLOR_PALETTE = [
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#eb2f96',
  '#13c2c2',
  '#722ed1',
  '#f5222d',
  '#fa541c',
  '#2f54eb',
  '#a0d911'
];

const UPDATE_ALLOWED_FIELDS = [
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
  'status',
  'must_visit_mode',
  'manual_must_visit_location_ids'
];

const buildGroupCode = (id) => {
  const normalizedId = Number(id);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) return '';
  return `${GROUP_CODE_PREFIX}${String(Math.floor(normalizedId)).padStart(6, '0')}`;
};

const assignGroupCodeById = (db, id) => {
  const code = buildGroupCode(id);
  if (!code) return '';
  db.prepare(`
    UPDATE groups
    SET group_code = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(code, id);
  return code;
};

const calculateDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 5;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

const getRandomGroupColor = () => (
  GROUP_COLOR_PALETTE[Math.floor(Math.random() * GROUP_COLOR_PALETTE.length)] || '#1890ff'
);

const normalizeGroupType = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  if (GROUP_TYPE_ALIASES.has(normalized)) {
    return GROUP_TYPE_ALIASES.get(normalized) || '';
  }
  if (GROUP_TYPE_ALIASES.has(raw)) {
    return GROUP_TYPE_ALIASES.get(raw) || '';
  }
  return normalized;
};

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
      }
    } catch (error) {
      // ignore parse errors
    }
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const serializeTags = (value) => JSON.stringify(normalizeTags(value));

const normalizeNotesImages = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeNotesImages(parsed);
      }
    } catch (error) {
      // ignore parse error
    }
  }
  return [];
};

const serializeNotesImages = (value) => JSON.stringify(normalizeNotesImages(value));

const normalizeMustVisitMode = (value, fallback = 'plan') => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'plan' || mode === 'manual') {
    return mode;
  }
  return fallback;
};

const normalizeManualMustVisitLocationIds = (value) => {
  if (Array.isArray(value)) {
    return Array.from(new Set(
      value.map((item) => Number(item)).filter((id) => Number.isFinite(id) && id > 0)
    ));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeManualMustVisitLocationIds(parsed);
      }
    } catch (error) {
      // ignore parse error and fallback to split
    }
    return Array.from(new Set(
      trimmed
        .split(/[,\uFF0C\u3001;|]/)
        .map((item) => Number(item.trim()))
        .filter((id) => Number.isFinite(id) && id > 0)
    ));
  }

  return [];
};

const serializeManualMustVisitLocationIds = (value) => (
  JSON.stringify(normalizeManualMustVisitLocationIds(value))
);

const hydrateGroup = (group) => {
  if (!group) return group;
  const manualMustVisitLocationIds = normalizeManualMustVisitLocationIds(
    group.manual_must_visit_location_ids
  );
  const fallbackMode = manualMustVisitLocationIds.length > 0 ? 'manual' : 'plan';
  return {
    ...group,
    tags: normalizeTags(group.tags),
    notes_images: normalizeNotesImages(group.notes_images),
    must_visit_mode: normalizeMustVisitMode(group.must_visit_mode, fallbackMode),
    manual_must_visit_location_ids: manualMustVisitLocationIds
  };
};

const normalizeGroupPayload = (payload = {}) => {
  const name = payload.name?.trim();
  const type = normalizeGroupType(payload.type);
  const startDate = payload.startDate ?? payload.start_date;
  const endDate = payload.endDate ?? payload.end_date;
  const studentCount = payload.studentCount ?? payload.student_count ?? 40;
  const teacherCount = payload.teacherCount ?? payload.teacher_count ?? 4;
  const duration = payload.duration ?? calculateDuration(startDate, endDate);
  const color = payload.color ?? getRandomGroupColor();
  const mustVisitModeRaw = payload.mustVisitMode ?? payload.must_visit_mode;
  const manualMustVisitLocationIdsRaw =
    payload.manualMustVisitLocationIds ?? payload.manual_must_visit_location_ids;
  const mustVisitMode = normalizeMustVisitMode(mustVisitModeRaw, 'plan');
  const itineraryPlanIdRaw = payload.itineraryPlanId ?? payload.itinerary_plan_id ?? null;
  const itineraryPlanId = mustVisitMode === 'manual' ? null : itineraryPlanIdRaw;
  const status = payload.status ?? null;
  const contactPerson = payload.contactPerson ?? payload.contact_person;
  const contactPhone = payload.contactPhone ?? payload.contact_phone;
  const emergencyContact = payload.emergencyContact ?? payload.emergency_contact;
  const emergencyPhone = payload.emergencyPhone ?? payload.emergency_phone;
  const accommodation = payload.accommodation ?? '';
  const tags = serializeTags(payload.tags);
  const notes = payload.notes ?? '';
  const notesImages = serializeNotesImages(payload.notesImages ?? payload.notes_images);
  const manualMustVisitLocationIds = mustVisitMode === 'manual'
    ? serializeManualMustVisitLocationIds(manualMustVisitLocationIdsRaw)
    : '[]';

  return {
    name,
    type,
    startDate,
    endDate,
    studentCount,
    teacherCount,
    duration,
    color,
    itineraryPlanId,
    status,
    contactPerson,
    contactPhone,
    emergencyContact,
    emergencyPhone,
    accommodation,
    tags,
    notes,
    notesImages,
    mustVisitMode,
    manualMustVisitLocationIds
  };
};

const isValidGroupType = (type) => (
  typeof type === 'string' && ALLOWED_GROUP_TYPES.has(normalizeGroupType(type))
);

const buildGroupUpdateMutation = (payload = {}) => {
  const normalizedBody = { ...payload };
  if (normalizedBody.must_visit_mode !== undefined) {
    const mode = normalizeMustVisitMode(normalizedBody.must_visit_mode, 'plan');
    normalizedBody.must_visit_mode = mode;
    if (mode === 'manual') {
      normalizedBody.itinerary_plan_id = null;
    } else {
      normalizedBody.manual_must_visit_location_ids = [];
    }
  }

  const updates = [];
  const values = [];
  UPDATE_ALLOWED_FIELDS.forEach((field) => {
    if (normalizedBody[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (field === 'tags') {
        values.push(serializeTags(normalizedBody[field]));
      } else if (field === 'notes_images') {
        values.push(serializeNotesImages(normalizedBody[field]));
      } else if (field === 'must_visit_mode') {
        values.push(normalizeMustVisitMode(normalizedBody[field], 'plan'));
      } else if (field === 'manual_must_visit_location_ids') {
        values.push(serializeManualMustVisitLocationIds(normalizedBody[field]));
      } else if (field === 'type') {
        values.push(normalizeGroupType(normalizedBody[field]));
      } else {
        values.push(normalizedBody[field]);
      }
    }
  });

  return {
    normalizedBody,
    updates,
    values
  };
};

module.exports = {
  CANCELLED_STATUS,
  assignGroupCodeById,
  hydrateGroup,
  normalizeGroupPayload,
  isValidGroupType,
  buildGroupUpdateMutation
};
