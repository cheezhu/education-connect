import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import { textRenderer } from 'handsontable/renderers/textRenderer';
import { createEmptyLogisticsRow } from '../../../groupDataUtils';
import { UNNAMED_GROUP_NAME } from '../../../constants';
import { decodeEscapedUnicode } from '../../../../../domain/text';
import apiClient from '../../../../../services/api';

registerAllModules();

const ensureHandsontableStyles = (() => {
  let stylePromise;
  return () => {
    if (!stylePromise) {
      stylePromise = Promise.all([
        import('handsontable/styles/handsontable.min.css'),
        import('handsontable/styles/ht-theme-main.min.css')
      ]);
    }
    return stylePromise;
  };
})();

const COPYABLE_PROPS = new Set([
  'city',
  'hotel',
  'hotel_address',
  'vehicle_plate',
  'vehicle_driver',
  'vehicle_phone',
  'guide_name',
  'guide_phone',
  'security_name',
  'security_phone',
  'breakfast',
  'breakfast_place',
  'lunch',
  'lunch_place',
  'dinner',
  'dinner_place',
  'transfer_time',
  'transfer_location',
  'transfer_flight_no',
  'transfer_airline',
  'transfer_note',
  'transfer_disabled'
]);

const MEAL_PROPS = new Set([
  'breakfast',
  'breakfast_place',
  'lunch',
  'lunch_place',
  'dinner',
  'dinner_place'
]);

const TRANSFER_PROPS = new Set([
  'transfer_time',
  'transfer_location',
  'transfer_flight_no',
  'transfer_airline',
  'transfer_note'
]);

const BOOLEAN_PROPS = new Set([
  'transfer_disabled'
]);

const WEEK_LABELS = [
  '周日',
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六'
];

const buildHalfHourTimeOptions = (startHour = 6, endHour = 23) => {
  const options = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    options.push(`${String(hour).padStart(2, '0')}:00`);
    if (hour !== endHour) {
      options.push(`${String(hour).padStart(2, '0')}:30`);
    }
  }
  return options;
};

const TIME_OPTIONS = buildHalfHourTimeOptions(6, 23);
const AIRLINE_OPTIONS = [
  '中国国航',
  '中国东航',
  '中国南航',
  '海南航空',
  '厦门航空',
  '深圳航空',
  '春秋航空',
  '香港航空',
  '香港快运',
  '高铁',
  '大巴'
];
const CITY_OPTIONS = ['香港', '澳门', '深圳', '珠海'];

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^[0-9+\-() ]{6,24}$/;
const VEHICLE_PLATE_RE = /^[\u4e00-\u9fa5A-Za-z0-9-]{3,16}$/;
const FLIGHT_OR_TRAIN_RE = /^[A-Za-z0-9\u4e00-\u9fa5-]{2,16}$/;

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    return decodeEscapedUnicode(value).trim();
  }
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return decodeEscapedUnicode(value.name).trim();
    if (typeof value.label === 'string') return decodeEscapedUnicode(value.label).trim();
    if (typeof value.value === 'string' || typeof value.value === 'number') {
      return decodeEscapedUnicode(value.value).trim();
    }
  }
  return '';
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
};

const normalizeTimeText = (value) => normalizeText(value).replace(/：/g, ':');

const toOptionList = (values = []) => {
  const unique = new Set();
  values.forEach((value) => {
    const parsed = normalizeText(value);
    if (parsed) unique.add(parsed);
  });
  return Array.from(unique);
};

const extractAddressCity = (address) => {
  const text = normalizeText(address);
  if (!text) return '';
  const cityMatch = text.match(/([\u4e00-\u9fa5]{2,8}(?:市|州|盟|地区|特别行政区))/);
  if (cityMatch) return cityMatch[1];
  return '';
};

const createPatternValidator = (pattern, normalizer = normalizeText) => (
  (value, callback) => {
    const parsed = normalizer(value);
    if (!parsed) {
      callback(true);
      return;
    }
    callback(pattern.test(parsed));
  }
);

const timeValidator = createPatternValidator(TIME_RE, normalizeTimeText);
const phoneValidator = createPatternValidator(PHONE_RE);
const plateValidator = createPatternValidator(VEHICLE_PLATE_RE);
const flightNoValidator = createPatternValidator(FLIGHT_OR_TRAIN_RE);

const clearTransferFields = (row) => ({
  ...row,
  transfer_time: '',
  transfer_location: '',
  transfer_flight_no: '',
  transfer_airline: '',
  transfer_note: '',
  transfer_disabled: false
});

const hasTransferContent = (transfer = {}) => (
  Boolean(
    normalizeText(transfer.time)
    || normalizeText(transfer.end_time || transfer.endTime)
    || normalizeText(transfer.location)
    || normalizeText(transfer.contact)
    || normalizeText(transfer.flight_no || transfer.flightNo)
    || normalizeText(transfer.airline)
    || normalizeText(transfer.terminal)
    || normalizeText(transfer.note)
    || normalizeBoolean(transfer.disabled)
  )
);

const resolveTransferModeByIndex = (index, rowCount, sourceRow = null) => {
  if (rowCount === 1) {
    const pickup = sourceRow?.pickup || {};
    const dropoff = sourceRow?.dropoff || {};
    if (hasTransferContent(dropoff) && !hasTransferContent(pickup)) return 'dropoff';
    return 'pickup';
  }
  if (index === 0) return 'pickup';
  if (index === rowCount - 1) return 'dropoff';
  return '';
};

const sanitizeTransferRowByIndex = (row, index, rowCount) => {
  const forcedMode = resolveTransferModeByIndex(index, rowCount, row._source || null);
  if (!forcedMode) {
    return {
      ...clearTransferFields(row),
      _transferMode: '',
      _transferEditable: false
    };
  }
  return {
    ...row,
    _transferMode: forcedMode,
    _transferEditable: true
  };
};

const sanitizeTransferRows = (rows = []) => {
  const rowCount = rows.length;
  return rows.map((row, index) => sanitizeTransferRowByIndex(row, index, rowCount));
};

const isTransferFieldEditable = (field, rowIndex, rowCount) => {
  if (!TRANSFER_PROPS.has(field) && !BOOLEAN_PROPS.has(field)) return true;
  if (rowCount === 1) return rowIndex === 0;
  if (rowIndex === 0 || rowIndex === rowCount - 1) return true;
  return false;
};

const extractHotelName = (hotelValue) => {
  if (!hotelValue) return '';
  if (typeof hotelValue === 'object') {
    return normalizeText(
      hotelValue.name
      || hotelValue.hotel_name
      || hotelValue.value
      || hotelValue.label
    );
  }
  return normalizeText(hotelValue);
};

const extractHotelAddress = (source = {}) => {
  const direct = normalizeText(source.hotel_address || source.hotelAddress);
  if (direct) return direct;
  if (!source.hotel || typeof source.hotel !== 'object') return '';
  return normalizeText(
    source.hotel.address
    || source.hotel.addr
    || source.hotel.location
  );
};

const createPlaceholderRenderer = (placeholderText) => (
  (instance, td, row, col, prop, value, cellProperties) => {
    textRenderer(instance, td, row, col, prop, value, cellProperties);
    if (normalizeText(value)) {
      td.classList.remove('hot-cell-placeholder');
    } else {
      td.classList.add('hot-cell-placeholder');
      td.textContent = placeholderText;
    }
    return td;
  }
);

const staffNameRenderer = createPlaceholderRenderer('姓名');
const staffPhoneRenderer = createPlaceholderRenderer('电话');
const vehiclePlateRenderer = createPlaceholderRenderer('车牌');
const cityRenderer = createPlaceholderRenderer('输入城市');
const hotelNameRenderer = createPlaceholderRenderer('酒店名称');
const hotelAddressRenderer = createPlaceholderRenderer('酒店地址');
const mealNameRenderer = createPlaceholderRenderer('餐厅名');
const mealAddressRenderer = createPlaceholderRenderer('地址');
const transferTimeRenderer = createPlaceholderRenderer('例如 09:30');
const transferLocationRenderer = createPlaceholderRenderer('机场 / 车站 / 码头');
const transferFlightRenderer = createPlaceholderRenderer('例如 MU1234');
const transferAirlineRenderer = createPlaceholderRenderer('例如 中国东航');
const transferNoteRenderer = createPlaceholderRenderer('补充说明（可选）');

const TABLE_CONFIGS = [
  {
    key: 'basic',
    title: '基础信息',
    headers: ['时间', '城市', '酒店名称', '酒店地址'],
    columns: [
      { data: 'dateLabel', type: 'text', readOnly: true },
      { data: 'city', type: 'text', renderer: (...args) => cityRenderer(...args) },
      { data: 'hotel', type: 'text', renderer: (...args) => hotelNameRenderer(...args) },
      { data: 'hotel_address', type: 'text', renderer: (...args) => hotelAddressRenderer(...args) }
    ],
    defaultWidths: [170, 180, 210, 250]
  },
    {
    key: 'transport',
    title: '出行人力',
    headers: [
      '时间',
      '车牌',
      '司机姓名',
      '司机电话',
      '导游姓名',
      '导游电话',
      '安全员姓名',
      '安全员电话'
    ],
    columns: [
      { data: 'dateLabel', type: 'text', readOnly: true },
      {
        data: 'vehicle_plate',
        type: 'text',
        renderer: (...args) => vehiclePlateRenderer(...args),
        validator: plateValidator,
        allowInvalid: false
      },
      { data: 'vehicle_driver', type: 'text', renderer: (...args) => staffNameRenderer(...args) },
      {
        data: 'vehicle_phone',
        type: 'text',
        renderer: (...args) => staffPhoneRenderer(...args),
        validator: phoneValidator,
        allowInvalid: false
      },
      { data: 'guide_name', type: 'text', renderer: (...args) => staffNameRenderer(...args) },
      {
        data: 'guide_phone',
        type: 'text',
        renderer: (...args) => staffPhoneRenderer(...args),
        validator: phoneValidator,
        allowInvalid: false
      },
      { data: 'security_name', type: 'text', renderer: (...args) => staffNameRenderer(...args) },
      {
        data: 'security_phone',
        type: 'text',
        renderer: (...args) => staffPhoneRenderer(...args),
        validator: phoneValidator,
        allowInvalid: false
      }
    ],
    defaultWidths: [170, 120, 130, 140, 130, 140, 130, 140]
  },
  {
    key: 'meals',
    title: '餐饮安排',
    headers: ['时间', '早餐餐厅名', '早餐地址', '午餐餐厅名', '午餐地址', '晚餐餐厅名', '晚餐地址'],
    columns: [
      { data: 'dateLabel', type: 'text', readOnly: true },
      { data: 'breakfast', type: 'text', renderer: (...args) => mealNameRenderer(...args) },
      { data: 'breakfast_place', type: 'text', renderer: (...args) => mealAddressRenderer(...args) },
      { data: 'lunch', type: 'text', renderer: (...args) => mealNameRenderer(...args) },
      { data: 'lunch_place', type: 'text', renderer: (...args) => mealAddressRenderer(...args) },
      { data: 'dinner', type: 'text', renderer: (...args) => mealNameRenderer(...args) },
      { data: 'dinner_place', type: 'text', renderer: (...args) => mealAddressRenderer(...args) }
    ],
    defaultWidths: [170, 170, 170, 170, 170, 170, 170]
  },
  {
    key: 'transfer',
    title: '接送站',
    headers: [
      '时间',
      '航班/车次',
      '接/送时间',
      '地址',
      '航空公司',
      '备注',
      '不安排'
    ],
    columns: [
      { data: 'dateLabel', type: 'text', readOnly: true },
      {
        data: 'transfer_flight_no',
        type: 'text',
        renderer: (...args) => transferFlightRenderer(...args),
        validator: flightNoValidator,
        allowInvalid: false
      },
      {
        data: 'transfer_time',
        type: 'autocomplete',
        source: TIME_OPTIONS,
        strict: false,
        filter: true,
        trimDropdown: true,
        renderer: (...args) => transferTimeRenderer(...args),
        validator: timeValidator,
        allowInvalid: false
      },
      { data: 'transfer_location', type: 'text', renderer: (...args) => transferLocationRenderer(...args) },
      {
        data: 'transfer_airline',
        type: 'autocomplete',
        source: AIRLINE_OPTIONS,
        strict: false,
        filter: true,
        trimDropdown: true,
        renderer: (...args) => transferAirlineRenderer(...args)
      },
      { data: 'transfer_note', type: 'text', renderer: (...args) => transferNoteRenderer(...args) },
      { data: 'transfer_disabled', type: 'checkbox' }
    ],
    defaultWidths: [170, 180, 150, 260, 180, 220, 92]
  }
];

const SECTION_DEFAULT_WIDTHS = TABLE_CONFIGS.reduce((acc, table) => {
  acc[table.key] = table.defaultWidths;
  return acc;
}, {});
const COL_WIDTHS_REMOTE_ENDPOINT = '/group-ui/logistics-sheet-col-widths';
const COL_WIDTHS_SAVE_DEBOUNCE_MS = 450;

const readStoredColWidths = (storageKey, defaultWidths) => {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== defaultWidths.length) return null;
    return parsed.map((size, index) => {
      const numeric = Number(size);
      return Number.isFinite(numeric) && numeric > 40 ? numeric : defaultWidths[index];
    });
  } catch (error) {
    return null;
  }
};

const writeStoredColWidths = (storageKey, widths) => {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(widths));
  } catch (error) {
    // ignore storage errors
  }
};

const normalizeSectionColWidths = (candidate, fallback = SECTION_DEFAULT_WIDTHS) => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const next = {};
  for (const section of TABLE_CONFIGS) {
    const defaults = section.defaultWidths;
    const incoming = Object.prototype.hasOwnProperty.call(candidate, section.key)
      ? candidate[section.key]
      : (fallback?.[section.key] || defaults);
    if (!Array.isArray(incoming) || incoming.length !== defaults.length) return null;
    const normalized = incoming.map((item, index) => {
      const parsed = Number(item);
      return Number.isFinite(parsed) && parsed > 40 ? Math.round(parsed) : defaults[index];
    });
    next[section.key] = normalized;
  }
  return next;
};

const buildDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return [];
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  if (!start.isValid() || !end.isValid() || start.isAfter(end, 'day')) return [];

  const dates = [];
  let cursor = start;
  while (!cursor.isAfter(end, 'day')) {
    dates.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'day');
  }
  return dates;
};

const normalizeSourceRow = (date, source = {}) => {
  const base = createEmptyLogisticsRow(date);
  const meals = source.meals || {};
  const vehicle = source.vehicle || {};
  const guide = source.guide || {};
  const security = source.security || {};
  const pickup = source.pickup || {};
  const dropoff = source.dropoff || {};

  return {
    ...base,
    ...source,
    date,
    city: normalizeText(source.city),
    hotel: extractHotelName(source.hotel || source.hotel_name || source.hotelName),
    hotel_address: extractHotelAddress(source),
    meals: {
      ...base.meals,
      ...meals,
      breakfast: normalizeText(meals.breakfast || meals.b),
      breakfast_place: normalizeText(meals.breakfast_place || meals.breakfastPlace),
      lunch: normalizeText(meals.lunch || meals.l),
      lunch_place: normalizeText(meals.lunch_place || meals.lunchPlace),
      dinner: normalizeText(meals.dinner || meals.d),
      dinner_place: normalizeText(meals.dinner_place || meals.dinnerPlace)
    },
    vehicle: {
      ...base.vehicle,
      ...vehicle,
      driver: normalizeText(vehicle.driver || vehicle.name),
      plate: normalizeText(vehicle.plate),
      phone: normalizeText(vehicle.phone)
    },
    guide: {
      ...base.guide,
      ...guide,
      name: normalizeText(guide.name || source.guide),
      phone: normalizeText(guide.phone)
    },
    security: {
      ...base.security,
      ...security,
      name: normalizeText(security.name || source.security),
      phone: normalizeText(security.phone)
    },
    pickup: {
      ...base.pickup,
      ...pickup,
      time: normalizeText(pickup.time || source.pickup_time),
      end_time: normalizeText(pickup.end_time || pickup.endTime || source.pickup_end_time),
      location: normalizeText(pickup.location || source.pickup_location),
      contact: normalizeText(pickup.contact || source.pickup_contact),
      flight_no: normalizeText(pickup.flight_no || pickup.flightNo || source.pickup_flight_no),
      airline: normalizeText(pickup.airline || source.pickup_airline),
      terminal: normalizeText(pickup.terminal || source.pickup_terminal),
      note: normalizeText(pickup.note || source.pickup_note),
      disabled: normalizeBoolean(pickup.disabled ?? source.pickup_disabled),
      detached: normalizeBoolean(pickup.detached ?? source.pickup_detached)
    },
    dropoff: {
      ...base.dropoff,
      ...dropoff,
      time: normalizeText(dropoff.time || source.dropoff_time),
      end_time: normalizeText(dropoff.end_time || dropoff.endTime || source.dropoff_end_time),
      location: normalizeText(dropoff.location || source.dropoff_location),
      contact: normalizeText(dropoff.contact || source.dropoff_contact),
      flight_no: normalizeText(dropoff.flight_no || dropoff.flightNo || source.dropoff_flight_no),
      airline: normalizeText(dropoff.airline || source.dropoff_airline),
      terminal: normalizeText(dropoff.terminal || source.dropoff_terminal),
      note: normalizeText(dropoff.note || source.dropoff_note),
      disabled: normalizeBoolean(dropoff.disabled ?? source.dropoff_disabled),
      detached: normalizeBoolean(dropoff.detached ?? source.dropoff_detached)
    }
  };
};

const toSheetRow = (sourceRow, index, rowCount) => {
  const parsed = dayjs(sourceRow.date);
  const dateLabel = parsed.isValid()
    ? `${parsed.format('MM-DD')} ${WEEK_LABELS[parsed.day()]}`
    : (sourceRow.date || '');
  const isFirstDay = index === 0;
  const isLastDay = index === rowCount - 1;
  const transferMode = resolveTransferModeByIndex(index, rowCount, sourceRow);
  const transfer = transferMode === 'dropoff'
    ? (sourceRow.dropoff || {})
    : (sourceRow.pickup || {});

  return {
    id: sourceRow.date,
    date: sourceRow.date,
    dateLabel,
    city: sourceRow.city || '',
    hotel: sourceRow.hotel || '',
    hotel_address: sourceRow.hotel_address || '',
    vehicle_plate: sourceRow.vehicle?.plate || '',
    vehicle_driver: sourceRow.vehicle?.driver || '',
    vehicle_phone: sourceRow.vehicle?.phone || '',
    breakfast: sourceRow.meals?.breakfast || '',
    breakfast_place: sourceRow.meals?.breakfast_place || '',
    lunch: sourceRow.meals?.lunch || '',
    lunch_place: sourceRow.meals?.lunch_place || '',
    dinner: sourceRow.meals?.dinner || '',
    dinner_place: sourceRow.meals?.dinner_place || '',
    guide_name: sourceRow.guide?.name || '',
    guide_phone: sourceRow.guide?.phone || '',
    security_name: sourceRow.security?.name || '',
    security_phone: sourceRow.security?.phone || '',
    transfer_time: transfer.time || '',
    transfer_location: transfer.location || '',
    transfer_flight_no: transfer.flight_no || '',
    transfer_airline: transfer.airline || '',
    transfer_note: transfer.note || '',
    transfer_disabled: !!transfer.disabled,
    _isFirstDay: isFirstDay,
    _isLastDay: isLastDay,
    _transferMode: transferMode,
    _transferEditable: transferMode !== '',
    _source: sourceRow
  };
};

const buildSheetRows = (group) => {
  if (!group) return [];
  const dates = buildDateRange(group.start_date, group.end_date);
  if (dates.length === 0) return [];

  const rowMap = new Map();
  (group.logistics || []).forEach((row) => {
    if (row?.date) rowMap.set(row.date, row);
  });

  return dates.map((date, index) => (
    sanitizeTransferRowByIndex(
      toSheetRow(normalizeSourceRow(date, rowMap.get(date) || {}), index, dates.length),
      index,
      dates.length
    )
  ));
};

const buildRowsSignature = (rows = []) => (
  rows.map((row) => (
    [
      row.date,
      row.city,
      row.hotel,
      row.hotel_address,
      row.vehicle_plate,
      row.vehicle_driver,
      row.vehicle_phone,
      row.breakfast,
      row.breakfast_place,
      row.lunch,
      row.lunch_place,
      row.dinner,
      row.dinner_place,
      row.guide_name,
      row.guide_phone,
      row.security_name,
      row.security_phone,
      row.transfer_time,
      row.transfer_location,
      row.transfer_flight_no,
      row.transfer_airline,
      row.transfer_note,
      row.transfer_disabled,
      row._transferMode
    ].join('|')
  )).join('||')
);

const mergeSheetRowToSource = (row) => {
  const base = normalizeSourceRow(row.date, row._source || {});
  const next = {
    ...base,
    city: normalizeText(row.city),
    hotel: normalizeText(row.hotel),
    hotel_address: normalizeText(row.hotel_address),
    vehicle: {
      ...base.vehicle,
      plate: normalizeText(row.vehicle_plate),
      driver: normalizeText(row.vehicle_driver),
      phone: normalizeText(row.vehicle_phone)
    },
    guide: {
      ...base.guide,
      name: normalizeText(row.guide_name),
      phone: normalizeText(row.guide_phone)
    },
    security: {
      ...base.security,
      name: normalizeText(row.security_name),
      phone: normalizeText(row.security_phone)
    },
    meals: {
      ...base.meals,
      breakfast: normalizeText(row.breakfast),
      breakfast_place: normalizeText(row.breakfast_place),
      lunch: normalizeText(row.lunch),
      lunch_place: normalizeText(row.lunch_place),
      dinner: normalizeText(row.dinner),
      dinner_place: normalizeText(row.dinner_place)
    },
    pickup: { ...base.pickup },
    dropoff: { ...base.dropoff }
  };
  const transferPayload = {
    time: normalizeText(row.transfer_time),
    location: normalizeText(row.transfer_location),
    flight_no: normalizeText(row.transfer_flight_no),
    airline: normalizeText(row.transfer_airline),
    note: normalizeText(row.transfer_note),
    disabled: normalizeBoolean(row.transfer_disabled),
    detached: false
  };
  if (transferPayload.disabled) {
    transferPayload.time = '';
    transferPayload.location = '';
    transferPayload.flight_no = '';
    transferPayload.airline = '';
    transferPayload.note = '';
    transferPayload.end_time = '';
    transferPayload.contact = '';
    transferPayload.terminal = '';
  }
  const allowPickup = !!row._isFirstDay;
  const allowDropoff = !!row._isLastDay;
  const transferMode = row._transferMode === 'dropoff' ? 'dropoff' : 'pickup';
  if (transferMode === 'pickup') {
    next.pickup = {
      ...next.pickup,
      ...transferPayload
    };
    next.dropoff = {
      ...next.dropoff,
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
    };
  } else {
    next.dropoff = {
      ...next.dropoff,
      ...transferPayload
    };
    next.pickup = {
      ...next.pickup,
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
    };
  }
  if (!allowPickup) {
    next.pickup = {
      ...next.pickup,
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
    };
  }
  if (!allowDropoff) {
    next.dropoff = {
      ...next.dropoff,
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
    };
  }
  return next;
};

const toClassName = (rowData, prop, busyDriverSet) => {
  const classes = [];
  if (MEAL_PROPS.has(prop)) classes.push('hot-meal-cell');
  if (TRANSFER_PROPS.has(prop)) classes.push('hot-transfer-cell');
  if ((TRANSFER_PROPS.has(prop) || BOOLEAN_PROPS.has(prop)) && !rowData?._transferEditable) {
    classes.push('hot-transfer-cell-disabled');
  }
  if (prop === 'vehicle_driver') {
    const driver = normalizeText(rowData?.vehicle_driver).toLowerCase();
    if (driver && busyDriverSet.has(driver)) classes.push('hot-busy-driver-cell');
  }
  return classes.join(' ');
};

const ASCII_LETTER_RE = /^[A-Za-z]$/;

const LogisticsSpreadsheet = ({
  group,
  onUpdate,
  busyDriverNames = [],
  locations = []
}) => {
  const hotRef = useRef(null);
  const saveColWidthsTimerRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [resourceHotels, setResourceHotels] = useState([]);
  const [resourcePeople, setResourcePeople] = useState([]);
  const [resourceVehicles, setResourceVehicles] = useState([]);
  const [resourceRestaurants, setResourceRestaurants] = useState([]);
  const [resourceFlights, setResourceFlights] = useState([]);
  const [activeSection, setActiveSection] = useState(TABLE_CONFIGS[0].key);
  const [sectionColWidths, setSectionColWidths] = useState(SECTION_DEFAULT_WIDTHS);
  const [tableAssetsReady, setTableAssetsReady] = useState(false);

  const colWidthsStorageBaseKey = useMemo(
    () => 'group-management:logistics-sheet:section-col-widths:v5',
    []
  );

  const busyDriverSet = useMemo(() => {
    const incoming = (
      Array.isArray(busyDriverNames) && busyDriverNames.length > 0
        ? busyDriverNames
        : (Array.isArray(group?.busy_drivers) ? group.busy_drivers : [])
    );

    return new Set(
      incoming
        .map((name) => normalizeText(name).toLowerCase())
        .filter(Boolean)
    );
  }, [busyDriverNames, group?.busy_drivers]);

  const nextRows = useMemo(() => buildSheetRows(group), [group]);
  const nextSignature = useMemo(() => buildRowsSignature(nextRows), [nextRows]);

  useEffect(() => {
    let canceled = false;
    const loadTableAssets = async () => {
      try {
        await ensureHandsontableStyles();
      } finally {
        if (!canceled) setTableAssetsReady(true);
      }
    };
    void loadTableAssets();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    const loadResourceLookups = async () => {
      const loaders = [
        ['/resources/hotels', setResourceHotels],
        ['/resources/people', setResourcePeople],
        ['/resources/vehicles', setResourceVehicles],
        ['/resources/restaurants', setResourceRestaurants],
        ['/resources/flights', setResourceFlights]
      ];

      await Promise.all(loaders.map(async ([url, setter]) => {
        try {
          const response = await apiClient.get(url);
          if (canceled) return;
          setter(Array.isArray(response?.data) ? response.data : []);
        } catch (error) {
          if (!canceled) setter([]);
        }
      }));
    };
    void loadResourceLookups();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    setRows((prev) => {
      if (buildRowsSignature(prev) === nextSignature) return prev;
      return nextRows;
    });
  }, [nextRows, nextSignature]);

  useEffect(() => {
    const restored = TABLE_CONFIGS.reduce((acc, section) => {
      const storageKey = `${colWidthsStorageBaseKey}:${section.key}`;
      acc[section.key] = readStoredColWidths(storageKey, section.defaultWidths) || section.defaultWidths;
      return acc;
    }, {});
    setSectionColWidths(restored);
  }, [colWidthsStorageBaseKey]);

  useEffect(() => {
    let canceled = false;
    const loadRemoteColWidths = async () => {
      try {
        const response = await apiClient.get(COL_WIDTHS_REMOTE_ENDPOINT);
        if (canceled) return;
        const normalized = normalizeSectionColWidths(response?.data?.widths, SECTION_DEFAULT_WIDTHS);
        if (!normalized) return;
        setSectionColWidths(normalized);
        TABLE_CONFIGS.forEach((section) => {
          writeStoredColWidths(`${colWidthsStorageBaseKey}:${section.key}`, normalized[section.key]);
        });
      } catch (error) {
        // fallback to localStorage-only when remote config is unavailable
      }
    };
    void loadRemoteColWidths();
    return () => {
      canceled = true;
    };
  }, [colWidthsStorageBaseKey]);

  const persistColWidthsRemote = useCallback((nextSectionColWidths) => {
    const payload = normalizeSectionColWidths(nextSectionColWidths, SECTION_DEFAULT_WIDTHS);
    if (!payload) return;
    clearTimeout(saveColWidthsTimerRef.current);
    saveColWidthsTimerRef.current = setTimeout(async () => {
      try {
        await apiClient.put(COL_WIDTHS_REMOTE_ENDPOINT, { widths: payload });
      } catch (error) {
        // fallback to local storage if remote save fails
      }
    }, COL_WIDTHS_SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => () => {
    clearTimeout(saveColWidthsTimerRef.current);
  }, []);

  const emitRowsUpdate = useCallback((nextStateRows) => {
    if (!group) return;
    const normalizedRows = sanitizeTransferRows(nextStateRows);
    onUpdate?.({
      ...group,
      logistics: normalizedRows.map(mergeSheetRowToSource)
    });
  }, [group, onUpdate]);

  const hotelNameToAddressMap = useMemo(() => {
    const map = new Map();
    resourceHotels.forEach((item) => {
      const hotelName = normalizeText(item?.name);
      const hotelAddress = normalizeText(item?.address);
      if (!hotelName || !hotelAddress) return;
      const key = hotelName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, hotelAddress);
      }
    });
    return map;
  }, [resourceHotels]);

  const hotelAddressToNameMap = useMemo(() => {
    const map = new Map();
    resourceHotels.forEach((item) => {
      const hotelName = normalizeText(item?.name);
      const hotelAddress = normalizeText(item?.address);
      if (!hotelName || !hotelAddress) return;
      const key = hotelAddress.toLowerCase();
      if (!map.has(key)) {
        map.set(key, hotelName);
      }
    });
    return map;
  }, [resourceHotels]);

  const hotelNameToCityMap = useMemo(() => {
    const map = new Map();
    resourceHotels.forEach((item) => {
      const hotelName = normalizeText(item?.name);
      const city = normalizeText(item?.city) || extractAddressCity(item?.address);
      if (!hotelName || !city) return;
      const key = hotelName.toLowerCase();
      if (!map.has(key)) map.set(key, city);
    });
    return map;
  }, [resourceHotels]);

  const hotelAddressToCityMap = useMemo(() => {
    const map = new Map();
    resourceHotels.forEach((item) => {
      const hotelAddress = normalizeText(item?.address);
      const city = normalizeText(item?.city) || extractAddressCity(item?.address);
      if (!hotelAddress || !city) return;
      const key = hotelAddress.toLowerCase();
      if (!map.has(key)) map.set(key, city);
    });
    return map;
  }, [resourceHotels]);

  const peopleByRole = useMemo(() => {
    const bucket = {
      driver: [],
      guide: [],
      security: []
    };
    resourcePeople.forEach((item) => {
      const role = normalizeText(item?.role).toLowerCase();
      if (!bucket[role]) return;
      const name = normalizeText(item?.name);
      const phone = normalizeText(item?.phone);
      if (!name && !phone) return;
      bucket[role].push({ name, phone });
    });
    return bucket;
  }, [resourcePeople]);

  const nameToPhoneMapByRole = useMemo(() => {
    const buildMap = (role) => {
      const map = new Map();
      (peopleByRole[role] || []).forEach((item) => {
        const key = normalizeText(item?.name).toLowerCase();
        const phone = normalizeText(item?.phone);
        if (!key || !phone) return;
        if (!map.has(key)) map.set(key, phone);
      });
      return map;
    };
    return {
      driver: buildMap('driver'),
      guide: buildMap('guide'),
      security: buildMap('security')
    };
  }, [peopleByRole]);

  const phoneToNameMapByRole = useMemo(() => {
    const buildMap = (role) => {
      const map = new Map();
      (peopleByRole[role] || []).forEach((item) => {
        const phone = normalizeText(item?.phone);
        const name = normalizeText(item?.name);
        if (!phone || !name) return;
        if (!map.has(phone)) map.set(phone, name);
      });
      return map;
    };
    return {
      driver: buildMap('driver'),
      guide: buildMap('guide'),
      security: buildMap('security')
    };
  }, [peopleByRole]);

  const restaurantNameToAddressMap = useMemo(() => {
    const map = new Map();
    resourceRestaurants.forEach((item) => {
      const name = normalizeText(item?.name);
      const address = normalizeText(item?.address);
      if (!name || !address) return;
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, address);
    });
    return map;
  }, [resourceRestaurants]);

  const restaurantAddressToNameMap = useMemo(() => {
    const map = new Map();
    resourceRestaurants.forEach((item) => {
      const name = normalizeText(item?.name);
      const address = normalizeText(item?.address);
      if (!name || !address) return;
      const key = address.toLowerCase();
      if (!map.has(key)) map.set(key, name);
    });
    return map;
  }, [resourceRestaurants]);

  const restaurantNameToCityMap = useMemo(() => {
    const map = new Map();
    resourceRestaurants.forEach((item) => {
      const name = normalizeText(item?.name);
      const city = normalizeText(item?.city) || extractAddressCity(item?.address);
      if (!name || !city) return;
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, city);
    });
    return map;
  }, [resourceRestaurants]);

  const restaurantAddressToCityMap = useMemo(() => {
    const map = new Map();
    resourceRestaurants.forEach((item) => {
      const address = normalizeText(item?.address);
      const city = normalizeText(item?.city) || extractAddressCity(item?.address);
      if (!address || !city) return;
      const key = address.toLowerCase();
      if (!map.has(key)) map.set(key, city);
    });
    return map;
  }, [resourceRestaurants]);

  const flightNoToAirlineMap = useMemo(() => {
    const map = new Map();
    resourceFlights.forEach((item) => {
      const flightNo = normalizeText(item?.flight_no).toUpperCase();
      const airline = normalizeText(item?.airline);
      if (!flightNo || !airline) return;
      if (!map.has(flightNo)) map.set(flightNo, airline);
    });
    return map;
  }, [resourceFlights]);

  const airlineToFlightNoMap = useMemo(() => {
    const map = new Map();
    resourceFlights.forEach((item) => {
      const airline = normalizeText(item?.airline);
      const flightNo = normalizeText(item?.flight_no).toUpperCase();
      if (!airline || !flightNo) return;
      const key = airline.toLowerCase();
      if (!map.has(key)) map.set(key, flightNo);
    });
    return map;
  }, [resourceFlights]);

  const handleAfterChange = useCallback((changes, source) => {
    if (!changes || source === 'loadData' || source === 'internal-sync') return;

    setRows((prev) => {
      let changed = false;
      const next = [...prev];

      changes.forEach(([rowIndex, prop, oldValue, newValue]) => {
        const field = String(prop);
        if (!COPYABLE_PROPS.has(field)) return;
        if (!isTransferFieldEditable(field, rowIndex, prev.length)) return;
        if (oldValue === newValue) return;
        if (!next[rowIndex]) return;
        const normalizedValue = BOOLEAN_PROPS.has(field)
          ? normalizeBoolean(newValue)
          : (() => {
              const rawValue = newValue === null || newValue === undefined ? '' : String(newValue);
              if (field === 'transfer_time') return normalizeTimeText(rawValue);
              if (field === 'transfer_flight_no') return rawValue.trim().toUpperCase();
              return rawValue;
            })();
        const rowPatch = { [field]: normalizedValue };
        if (field === 'hotel') {
          const normalizedKey = normalizeText(normalizedValue).toLowerCase();
          const matchedAddress = hotelNameToAddressMap.get(normalizedKey);
          const matchedCity = hotelNameToCityMap.get(normalizedKey);
          if (matchedAddress) {
            rowPatch.hotel_address = matchedAddress;
          }
          if (!normalizeText(next[rowIndex]?.city) && matchedCity) {
            rowPatch.city = matchedCity;
          }
        } else if (field === 'hotel_address') {
          const normalizedKey = normalizeText(normalizedValue).toLowerCase();
          const matchedName = hotelAddressToNameMap.get(normalizedKey);
          const matchedCity = hotelAddressToCityMap.get(normalizedKey);
          if (matchedName) {
            rowPatch.hotel = matchedName;
          }
          if (!normalizeText(next[rowIndex]?.city) && matchedCity) {
            rowPatch.city = matchedCity;
          }
        } else if (field === 'vehicle_driver') {
          const matchedPhone = nameToPhoneMapByRole.driver.get(normalizeText(normalizedValue).toLowerCase());
          if (matchedPhone) {
            rowPatch.vehicle_phone = matchedPhone;
          }
        } else if (field === 'vehicle_phone') {
          const matchedName = phoneToNameMapByRole.driver.get(normalizeText(normalizedValue));
          if (matchedName) {
            rowPatch.vehicle_driver = matchedName;
          }
        } else if (field === 'guide_name') {
          const matchedPhone = nameToPhoneMapByRole.guide.get(normalizeText(normalizedValue).toLowerCase());
          if (matchedPhone) {
            rowPatch.guide_phone = matchedPhone;
          }
        } else if (field === 'guide_phone') {
          const matchedName = phoneToNameMapByRole.guide.get(normalizeText(normalizedValue));
          if (matchedName) {
            rowPatch.guide_name = matchedName;
          }
        } else if (field === 'security_name') {
          const matchedPhone = nameToPhoneMapByRole.security.get(normalizeText(normalizedValue).toLowerCase());
          if (matchedPhone) {
            rowPatch.security_phone = matchedPhone;
          }
        } else if (field === 'security_phone') {
          const matchedName = phoneToNameMapByRole.security.get(normalizeText(normalizedValue));
          if (matchedName) {
            rowPatch.security_name = matchedName;
          }
        } else if (field === 'breakfast' || field === 'lunch' || field === 'dinner') {
          const normalizedKey = normalizeText(normalizedValue).toLowerCase();
          const matchedAddress = restaurantNameToAddressMap.get(normalizedKey);
          const matchedCity = restaurantNameToCityMap.get(normalizedKey);
          if (matchedAddress) {
            rowPatch[`${field}_place`] = matchedAddress;
          }
          if (!normalizeText(next[rowIndex]?.city) && matchedCity) {
            rowPatch.city = matchedCity;
          }
        } else if (field === 'breakfast_place' || field === 'lunch_place' || field === 'dinner_place') {
          const mealField = field.replace('_place', '');
          const normalizedKey = normalizeText(normalizedValue).toLowerCase();
          const matchedName = restaurantAddressToNameMap.get(normalizedKey);
          const matchedCity = restaurantAddressToCityMap.get(normalizedKey);
          if (matchedName) {
            rowPatch[mealField] = matchedName;
          }
          if (!normalizeText(next[rowIndex]?.city) && matchedCity) {
            rowPatch.city = matchedCity;
          }
        } else if (field === 'transfer_flight_no') {
          const matchedAirline = flightNoToAirlineMap.get(normalizeText(normalizedValue).toUpperCase());
          if (matchedAirline) {
            rowPatch.transfer_airline = matchedAirline;
          }
        } else if (field === 'transfer_airline') {
          const matchedFlightNo = airlineToFlightNoMap.get(normalizeText(normalizedValue).toLowerCase());
          if (matchedFlightNo && !normalizeText(next[rowIndex]?.transfer_flight_no)) {
            rowPatch.transfer_flight_no = matchedFlightNo;
          }
        }
        next[rowIndex] = {
          ...next[rowIndex],
          ...rowPatch
        };
        changed = true;
      });

      if (!changed) return prev;
      emitRowsUpdate(next);
      return next;
    });
  }, [
    emitRowsUpdate,
    airlineToFlightNoMap,
    flightNoToAirlineMap,
    hotelAddressToCityMap,
    hotelAddressToNameMap,
    hotelNameToCityMap,
    hotelNameToAddressMap,
    nameToPhoneMapByRole,
    phoneToNameMapByRole,
    restaurantAddressToCityMap,
    restaurantAddressToNameMap,
    restaurantNameToCityMap,
    restaurantNameToAddressMap
  ]);

  const handleAfterColumnResize = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    const defaultWidths = SECTION_DEFAULT_WIDTHS[activeSection] || [];
    if (!defaultWidths.length) return;
    const nextWidths = defaultWidths.map((fallback, index) => {
      const width = hot.getColWidth(index);
      return Number.isFinite(width) && width > 40 ? width : fallback;
    });
    setSectionColWidths((prev) => {
      const next = {
        ...prev,
        [activeSection]: nextWidths
      };
      persistColWidthsRemote(next);
      return next;
    });
    writeStoredColWidths(`${colWidthsStorageBaseKey}:${activeSection}`, nextWidths);
  }, [activeSection, colWidthsStorageBaseKey, persistColWidthsRemote]);

  const handleBeforeCompositionStart = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const editor = hot.getActiveEditor?.();
    if (!editor || !editor.isOpened?.() || typeof editor.getValue !== 'function' || typeof editor.setValue !== 'function') {
      return;
    }

    const editorValue = normalizeText(editor.getValue());
    if (!ASCII_LETTER_RE.test(editorValue)) return;

    const selected = hot.getSelectedLast();
    if (!selected) return;
    const [visualRow, visualCol] = selected;
    const prop = String(hot.colToProp(visualCol) || '');
    if (!COPYABLE_PROPS.has(prop)) return;
    if (!isTransferFieldEditable(prop, visualRow, rows.length)) return;

    const cellValue = normalizeText(hot.getDataAtCell(visualRow, visualCol));
    if (cellValue) return;

    editor.setValue('');
  }, [rows.length]);

  const cityOptions = useMemo(() => CITY_OPTIONS, []);

  const hotelOptions = useMemo(() => (
    toOptionList([
      ...resourceHotels.map((item) => item?.name),
      ...rows.map((row) => row.hotel)
    ])
  ), [resourceHotels, rows]);

  const hotelAddressOptions = useMemo(() => (
    toOptionList([
      ...resourceHotels.map((item) => item?.address),
      ...rows.map((row) => row.hotel_address)
    ])
  ), [resourceHotels, rows]);

  const vehiclePlateOptions = useMemo(() => (
    toOptionList([
      ...resourceVehicles.map((item) => item?.plate),
      ...rows.map((row) => row.vehicle_plate)
    ])
  ), [resourceVehicles, rows]);

  const driverNameOptions = useMemo(() => (
    toOptionList([
      ...(peopleByRole.driver || []).map((item) => item?.name),
      ...rows.map((row) => row.vehicle_driver)
    ])
  ), [peopleByRole.driver, rows]);

  const driverPhoneOptions = useMemo(() => (
    toOptionList([
      ...(peopleByRole.driver || []).map((item) => item?.phone),
      ...rows.map((row) => row.vehicle_phone)
    ])
  ), [peopleByRole.driver, rows]);

  const guideNameOptions = useMemo(() => (
    toOptionList([
      ...(peopleByRole.guide || []).map((item) => item?.name),
      ...rows.map((row) => row.guide_name)
    ])
  ), [peopleByRole.guide, rows]);

  const guidePhoneOptions = useMemo(() => (
    toOptionList([
      ...(peopleByRole.guide || []).map((item) => item?.phone),
      ...rows.map((row) => row.guide_phone)
    ])
  ), [peopleByRole.guide, rows]);

  const securityNameOptions = useMemo(() => (
    toOptionList([
      ...(peopleByRole.security || []).map((item) => item?.name),
      ...rows.map((row) => row.security_name)
    ])
  ), [peopleByRole.security, rows]);

  const securityPhoneOptions = useMemo(() => (
    toOptionList([
      ...(peopleByRole.security || []).map((item) => item?.phone),
      ...rows.map((row) => row.security_phone)
    ])
  ), [peopleByRole.security, rows]);

  const mealNameOptions = useMemo(() => (
    toOptionList([
      ...resourceRestaurants.map((item) => item?.name),
      ...rows.flatMap((row) => [row.breakfast, row.lunch, row.dinner])
    ])
  ), [resourceRestaurants, rows]);

  const mealAddressOptions = useMemo(() => (
    toOptionList([
      ...resourceRestaurants.map((item) => item?.address),
      ...rows.flatMap((row) => [row.breakfast_place, row.lunch_place, row.dinner_place])
    ])
  ), [resourceRestaurants, rows]);

  const transferFlightOptions = useMemo(() => (
    toOptionList([
      ...resourceFlights.map((item) => item?.flight_no),
      ...rows.map((row) => row.transfer_flight_no)
    ]).map((value) => value.toUpperCase())
  ), [resourceFlights, rows]);

  const transferAirlineOptions = useMemo(() => (
    toOptionList([
      ...AIRLINE_OPTIONS,
      ...resourceFlights.map((item) => item?.airline),
      ...rows.map((row) => row.transfer_airline)
    ])
  ), [resourceFlights, rows]);

  const dynamicAutocompleteByField = useMemo(() => ({
    city: cityOptions,
    hotel: hotelOptions,
    hotel_address: hotelAddressOptions,
    vehicle_plate: vehiclePlateOptions,
    vehicle_driver: driverNameOptions,
    vehicle_phone: driverPhoneOptions,
    guide_name: guideNameOptions,
    guide_phone: guidePhoneOptions,
    security_name: securityNameOptions,
    security_phone: securityPhoneOptions,
    breakfast: mealNameOptions,
    lunch: mealNameOptions,
    dinner: mealNameOptions,
    breakfast_place: mealAddressOptions,
    lunch_place: mealAddressOptions,
    dinner_place: mealAddressOptions,
    transfer_flight_no: transferFlightOptions,
    transfer_airline: transferAirlineOptions
  }), [
    cityOptions,
    driverNameOptions,
    driverPhoneOptions,
    guideNameOptions,
    guidePhoneOptions,
    hotelAddressOptions,
    hotelOptions,
    mealAddressOptions,
    mealNameOptions,
    securityNameOptions,
    securityPhoneOptions,
    transferAirlineOptions,
    transferFlightOptions,
    vehiclePlateOptions
  ]);

  const contextMenu = useMemo(() => ({
    items: {
      row_above: {},
      row_below: {},
      remove_row: {},
      '---------': {},
      undo: {},
      redo: {},
      copy: {},
      cut: {},
      copy_to_below: {
          name: '复制到下方',
        callback: () => {
          const hot = hotRef.current?.hotInstance;
          if (!hot) return;
          const selected = hot.getSelectedLast();
          if (!selected) return;

          const [r1, c1, r2, c2] = selected;
          if (c1 !== c2) return;

          const endRow = Math.max(r1, r2);
          const prop = String(hot.colToProp(c1));
          if (!COPYABLE_PROPS.has(prop)) return;
          if (TRANSFER_PROPS.has(prop) || BOOLEAN_PROPS.has(prop)) return;

          const value = hot.getDataAtCell(endRow, c1);
          const updates = [];
          for (let row = endRow + 1; row < hot.countRows(); row += 1) {
            updates.push([row, c1, value]);
          }
          if (updates.length > 0) {
            hot.setDataAtCell(updates, 'copy_to_below');
          }
        }
      }
    }
  }), []);

  const cells = useCallback((row, col, prop) => {
    const rowData = rows[row];
    const field = String(prop);
    const isTransferField = TRANSFER_PROPS.has(field) || BOOLEAN_PROPS.has(field);
    const transferLocked = isTransferField && !isTransferFieldEditable(field, row, rows.length);
    return {
      readOnly: field === 'dateLabel' || transferLocked,
      className: toClassName(rowData, prop, busyDriverSet)
    };
  }, [rows, busyDriverSet]);

  const sectionConfig = useMemo(() => {
    const baseConfig = TABLE_CONFIGS.find((section) => section.key === activeSection) || TABLE_CONFIGS[0];
    const columns = (baseConfig.columns || []).map((column) => {
      const field = column?.data;
      const source = dynamicAutocompleteByField[field];
      if (!Array.isArray(source) || source.length === 0) return column;
      return {
        ...column,
        type: 'autocomplete',
        source,
        strict: false,
        filter: true,
        trimDropdown: true
      };
    });
    return {
      ...baseConfig,
      columns
    };
  }, [activeSection, dynamicAutocompleteByField]);
  const hiddenTransferRows = useMemo(() => {
    if (sectionConfig.key !== 'transfer') return [];
    if (rows.length <= 2) return [];
    return Array.from({ length: rows.length - 2 }, (_, index) => index + 1);
  }, [sectionConfig.key, rows.length]);

  if (!group) {
    return (
      <div className="logistics-spreadsheet-wrap">
        <div className="empty-state">请选择团组</div>
      </div>
    );
  }

  if (!group.start_date || !group.end_date) {
    return (
      <div className="logistics-spreadsheet-wrap">
        <div className="empty-state">请先设置团组起止日期</div>
      </div>
    );
  }

  const groupTitle = normalizeText(group.name) || UNNAMED_GROUP_NAME;

  if (!tableAssetsReady) {
    return (
      <div className="logistics-spreadsheet-wrap">
        <div className="empty-state">资源表加载中...</div>
      </div>
    );
  }

  return (
    <div className="logistics-spreadsheet-wrap">
      <div className="logistics-spreadsheet-title">{groupTitle}</div>
      <div className="logistics-table-shell">
        <div className="logistics-table-card">
          <div className="logistics-handsontable-wrap logistics-handsontable-wrap--split">
            <HotTable
              key={sectionConfig.key}
              ref={hotRef}
              data={rows}
              columns={sectionConfig.columns}
              colHeaders={sectionConfig.headers}
              nestedHeaders={sectionConfig.nestedHeaders || false}
              rowHeaders={false}
              fixedColumnsStart={1}
              width="100%"
              height="100%"
              stretchH="none"
              autoColumnSize={false}
              className="logistics-handsontable ht-theme-main"
              licenseKey="non-commercial-and-evaluation"
              themeName="ht-theme-main"
              contextMenu={contextMenu}
              fillHandle
              copyPaste
              tabNavigation
              navigableHeaders={false}
              autoWrapRow={false}
              autoWrapCol={false}
              outsideClickDeselects={false}
              manualColumnResize
              hiddenRows={
                sectionConfig.key === 'transfer'
                  ? {
                      rows: hiddenTransferRows,
                      indicators: false,
                      copyPasteEnabled: false
                    }
                  : false
              }
              rowHeights={40}
              imeFastEdit
              colWidths={sectionColWidths[sectionConfig.key] || sectionConfig.defaultWidths}
              afterChange={handleAfterChange}
              afterColumnResize={handleAfterColumnResize}
              beforeCompositionStart={handleBeforeCompositionStart}
              cells={cells}
            />
          </div>
        </div>
        <div className="logistics-sheet-tabs">
          {TABLE_CONFIGS.map((section) => (
            <button
              key={section.key}
              type="button"
              className={`logistics-sheet-tab${section.key === sectionConfig.key ? ' is-active' : ''}`}
              onClick={() => setActiveSection(section.key)}
            >
              {section.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LogisticsSpreadsheet;


