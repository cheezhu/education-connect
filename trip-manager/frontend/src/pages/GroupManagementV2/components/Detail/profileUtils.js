import dayjs from 'dayjs';

export const weekdayLabel = (dateStr) => {
  const day = dayjs(dateStr).day();
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return labels[day] || '';
};

export const resolveEventTitle = (event) => {
  return event?.title || event?.location || event?.description || '未命名活动';
};

export const isItineraryItem = (item) => {
  const type = (item?.type || '').toString().toLowerCase();
  if (!type) return true;
  return !['meal', 'transport', 'rest', 'free'].includes(type);
};

export const buildDateValue = (startDate, endDate) => {
  if (startDate && endDate) return `${startDate} → ${endDate}`;
  return startDate || endDate || '';
};

export const isValidDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');

export const isDraftValid = (value) => {
  if (!value) return false;
  if (!value.name || !String(value.name).trim()) return false;
  if (!value.type) return false;
  if (!isValidDateString(value.start_date) || !isValidDateString(value.end_date)) return false;
  const start = dayjs(value.start_date);
  const end = dayjs(value.end_date);
  if (!start.isValid() || !end.isValid() || end.isBefore(start, 'day')) return false;
  const duration = Number(value.duration);
  if (!Number.isFinite(duration) || duration <= 0) return false;
  return true;
};

export const parseDateRangeInput = (value, fallbackEnd) => {
  const matches = String(value || '').match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (matches.length === 0) return { start: '', end: '' };
  if (matches.length === 1) return { start: matches[0], end: fallbackEnd || '' };
  return { start: matches[0], end: matches[1] };
};

export const normalizeNotes = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  const trimmed = text.trim();
  if (!trimmed) return '';
  const cleaned = trimmed.replace(/[.。…]/g, '');
  if (/^[?？]+$/.test(cleaned)) return '';
  return text;
};

export const MAX_NOTE_IMAGE_COUNT = 8;
export const MAX_NOTE_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_NOTE_IMAGE_TOTAL_CHARS = 8 * 1024 * 1024;
export const NOTE_IMAGE_MAX_EDGE = 1600;
export const NOTE_IMAGE_QUALITY = 0.82;

export const normalizeNotesImages = (value) => {
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

export const readFileAsDataUrlRaw = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('file_read_failed'));
  reader.readAsDataURL(file);
});

export const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('image_decode_failed'));
  image.src = src;
});

export const compressImageDataUrl = async (dataUrl) => {
  const image = await loadImageElement(dataUrl);
  const originWidth = Number(image.naturalWidth || image.width || 0);
  const originHeight = Number(image.naturalHeight || image.height || 0);
  if (!originWidth || !originHeight) return dataUrl;

  const scale = Math.min(1, NOTE_IMAGE_MAX_EDGE / Math.max(originWidth, originHeight));
  const width = Math.max(1, Math.round(originWidth * scale));
  const height = Math.max(1, Math.round(originHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, width, height);

  const compressed = canvas.toDataURL('image/jpeg', NOTE_IMAGE_QUALITY);
  return compressed.length < dataUrl.length ? compressed : dataUrl;
};

export const readFileAsDataUrl = async (file) => {
  const raw = await readFileAsDataUrlRaw(file);
  if (!String(file?.type || '').startsWith('image/')) {
    return raw;
  }
  try {
    return await compressImageDataUrl(raw);
  } catch (error) {
    return raw;
  }
};

export const normalizeMustVisitMode = (value, fallback = 'plan') => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'plan' || mode === 'manual') {
    return mode;
  }
  return fallback;
};

export const normalizeManualMustVisitLocationIds = (value) => {
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
        .map(item => Number(item.trim()))
        .filter(id => Number.isFinite(id) && id > 0)
    ));
  }
  return [];
};

export const extractPlanLocationIds = (items = []) => (
  Array.from(new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => Number(item?.location_id))
      .filter((id) => Number.isFinite(id) && id > 0)
  ))
);

export const buildBaseProperties = (group, hasMembers) => {
  const tagsValue = Array.isArray(group.tags) ? group.tags.join(', ') : (group.tags || '');
  const dateValue = buildDateValue(group.start_date, group.end_date);
  const totalCount = (group.student_count || 0) + (group.teacher_count || 0);
  const typeOptions = [
    { value: 'primary', label: '小学' },
    { value: 'secondary', label: '中学' },
    { value: 'vip', label: 'VIP' }
  ];

  return [
    {
      id: 'dates',
      key: '日期范围',
      value: dateValue,
      type: 'date',
      icon: 'CAL',
      field: 'dates',
      placeholder: 'YYYY-MM-DD → YYYY-MM-DD'
    },
    {
      id: 'duration',
      key: '行程天数',
      value: group.duration || '',
      type: 'number',
      icon: '#',
      field: 'duration',
      readOnly: true
    },
    {
      id: 'group_code',
      key: '团组编号',
      value: group.group_code || '',
      type: 'text',
      icon: 'ID',
      field: 'group_code',
      readOnly: true
    },
    {
      id: 'type',
      key: '团组类型',
      value: group.type || '',
      type: 'select',
      icon: 'SCH',
      field: 'type',
      options: typeOptions
    },
    {
      id: 'students',
      key: '学生人数',
      value: group.student_count ?? '',
      type: 'number',
      icon: '#',
      field: 'student_count',
      readOnly: hasMembers,
      badge: hasMembers ? '自动' : ''
    },
    {
      id: 'teachers',
      key: '教师人数',
      value: group.teacher_count ?? '',
      type: 'number',
      icon: '#',
      field: 'teacher_count',
      readOnly: hasMembers,
      badge: hasMembers ? '自动' : ''
    },
    {
      id: 'total',
      key: '总人数',
      value: totalCount,
      type: 'number',
      icon: '#',
      field: 'total',
      readOnly: true
    },
    {
      id: 'accommodation',
      key: '住宿酒店',
      value: group.accommodation || '',
      type: 'text',
      icon: 'HOT',
      field: 'accommodation'
    },
    {
      id: 'color',
      key: '标识颜色',
      value: group.color || '#1890ff',
      type: 'color',
      icon: 'CLR',
      field: 'color'
    },
    {
      id: 'tags',
      key: '标签',
      value: tagsValue,
      type: 'text',
      icon: 'TAG',
      field: 'tags'
    },
    {
      id: 'contact_person',
      key: '联系人',
      value: group.contact_person || '',
      type: 'person',
      icon: '@',
      field: 'contact_person'
    },
    {
      id: 'contact_phone',
      key: '联系电话',
      value: group.contact_phone || '',
      type: 'text',
      icon: 'TEL',
      field: 'contact_phone'
    },
    {
      id: 'emergency_contact',
      key: '紧急联系人',
      value: group.emergency_contact || '',
      type: 'person',
      icon: '!',
      field: 'emergency_contact'
    },
    {
      id: 'emergency_phone',
      key: '紧急电话',
      value: group.emergency_phone || '',
      type: 'text',
      icon: 'TEL',
      field: 'emergency_phone'
    }
  ];
};

export const mergeCustomProperties = (baseProperties, groupProperties) => {
  if (!Array.isArray(groupProperties)) return baseProperties;
  const baseIds = new Set(baseProperties.map((prop) => prop.id));
  const custom = groupProperties.filter((prop) => prop && !baseIds.has(prop.id));
  return [...baseProperties, ...custom];
};

export const isTextFilled = (value) => {
  if (value === null || value === undefined) return false;
  return String(value).trim() !== '' && String(value).trim() !== '[object Object]';
};

export const isMealComplete = (meals = {}, fallbackDisabled = false) => {
  if (fallbackDisabled || meals.disabled || meals.all_disabled) return true;
  return ['breakfast', 'lunch', 'dinner'].every((key) => (
    meals[`${key}_disabled`] || isTextFilled(meals[key]) || isTextFilled(meals[`${key}_place`])
  ));
};

export const isTransferComplete = (transfer = {}, fallbackDisabled = false) => (
  transfer.disabled
  || fallbackDisabled
  || isTextFilled(transfer.time)
  || isTextFilled(transfer.end_time)
  || isTextFilled(transfer.location)
  || isTextFilled(transfer.contact)
  || isTextFilled(transfer.flight_no)
  || isTextFilled(transfer.airline)
  || isTextFilled(transfer.terminal)
);

export const buildCompletionStats = (logistics = [], group) => {
  if (!Array.isArray(logistics) || logistics.length === 0) {
    return { percent: 0, modules: [] };
  }

  const startDate = group?.start_date || '';
  const endDate = group?.end_date || '';
  const moduleKeys = [
    { key: 'hotel', label: '住宿酒店', color: '#2d9d78' },
    { key: 'vehicle', label: '车辆调度', color: '#2383e2' },
    { key: 'guide', label: '随团导游', color: '#d9730d' },
    { key: 'security', label: '安保人员', color: '#7b1fa2' },
    { key: 'meals', label: '餐饮安排', color: '#2d9d78' },
    { key: 'pickup', label: '接站', color: '#2383e2' },
    { key: 'dropoff', label: '送站', color: '#2383e2' }
  ];

  const moduleTotals = Object.fromEntries(moduleKeys.map(item => [item.key, { total: 0, done: 0 }]));

  let totalCount = 0;
  let doneCount = 0;

  logistics.forEach((row) => {
    const isStart = startDate && row.date === startDate;
    const isEnd = endDate && row.date === endDate;

    const hotelDone = row.hotel_disabled || isTextFilled(row.hotel) || isTextFilled(row.hotel_address);
    const vehicleDone = row.vehicle_disabled
      || isTextFilled(row.vehicle?.plate)
      || isTextFilled(row.vehicle?.driver)
      || isTextFilled(row.vehicle?.phone)
      || isTextFilled(row.vehicle?.name);
    const guideDone = row.guide_disabled || isTextFilled(row.guide?.name) || isTextFilled(row.guide?.phone);
    const securityDone = row.security_disabled || isTextFilled(row.security?.name) || isTextFilled(row.security?.phone);
    const mealsDone = isMealComplete(row.meals || {}, row.meals_disabled);

    const modules = [
      { key: 'hotel', done: hotelDone },
      { key: 'vehicle', done: vehicleDone },
      { key: 'guide', done: guideDone },
      { key: 'security', done: securityDone },
      { key: 'meals', done: mealsDone }
    ];

    modules.forEach((module) => {
      moduleTotals[module.key].total += 1;
      if (module.done) moduleTotals[module.key].done += 1;
      totalCount += 1;
      if (module.done) doneCount += 1;
    });

    if (isStart) {
      moduleTotals.pickup.total += 1;
      if (isTransferComplete(row.pickup || {}, row.pickup_disabled)) moduleTotals.pickup.done += 1;
      totalCount += 1;
      if (isTransferComplete(row.pickup || {}, row.pickup_disabled)) doneCount += 1;
    }
    if (isEnd) {
      moduleTotals.dropoff.total += 1;
      if (isTransferComplete(row.dropoff || {}, row.dropoff_disabled)) moduleTotals.dropoff.done += 1;
      totalCount += 1;
      if (isTransferComplete(row.dropoff || {}, row.dropoff_disabled)) doneCount += 1;
    }
  });

  const percent = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  const modules = moduleKeys
    .filter((module) => moduleTotals[module.key].total > 0)
    .map((module) => {
      const { total, done } = moduleTotals[module.key];
      const ratio = total ? Math.round((done / total) * 100) : 0;
      return {
        ...module,
        ratio
      };
    })
    .filter((module) => module.ratio > 0 || module.key === 'hotel' || module.key === 'vehicle');

  return { percent, modules };
};


