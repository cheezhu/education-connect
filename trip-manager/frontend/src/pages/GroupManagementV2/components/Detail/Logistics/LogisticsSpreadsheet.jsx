import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import { textRenderer } from 'handsontable/renderers/textRenderer';
import { createEmptyLogisticsRow } from '../../../groupDataUtils';
import { UNNAMED_GROUP_NAME } from '../../../constants';
import apiClient from '../../../../../services/api';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

registerAllModules();

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
  'dinner_place'
]);

const MEAL_PROPS = new Set([
  'breakfast',
  'breakfast_place',
  'lunch',
  'lunch_place',
  'dinner',
  'dinner_place'
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

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name.trim();
    if (typeof value.label === 'string') return value.label.trim();
    if (typeof value.value === 'string' || typeof value.value === 'number') {
      return String(value.value).trim();
    }
  }
  return '';
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
      { data: 'vehicle_plate', type: 'text', renderer: (...args) => vehiclePlateRenderer(...args) },
      { data: 'vehicle_driver', type: 'text', renderer: (...args) => staffNameRenderer(...args) },
      { data: 'vehicle_phone', type: 'text', renderer: (...args) => staffPhoneRenderer(...args) },
      { data: 'guide_name', type: 'text', renderer: (...args) => staffNameRenderer(...args) },
      { data: 'guide_phone', type: 'text', renderer: (...args) => staffPhoneRenderer(...args) },
      { data: 'security_name', type: 'text', renderer: (...args) => staffNameRenderer(...args) },
      { data: 'security_phone', type: 'text', renderer: (...args) => staffPhoneRenderer(...args) }
    ],
    defaultWidths: [170, 120, 130, 140, 130, 140, 130, 140]
  },
  {
    key: 'meals',
    title: '餐饮安排',
    headers: ['时间', '早餐餐厅', '早餐地址', '午餐餐厅', '午餐地址', '晚餐餐厅', '晚餐地址'],
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
    }
  };
};

const toSheetRow = (sourceRow) => {
  const parsed = dayjs(sourceRow.date);
  const dateLabel = parsed.isValid()
    ? `${parsed.format('MM-DD')} (${WEEK_LABELS[parsed.day()]})`
    : (sourceRow.date || '');

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

  return dates.map((date) => toSheetRow(normalizeSourceRow(date, rowMap.get(date) || {})));
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
      row.security_phone
    ].join('|')
  )).join('||')
);

const mergeSheetRowToSource = (row) => {
  const base = normalizeSourceRow(row.date, row._source || {});
  return {
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
    }
  };
};

const toClassName = (rowData, prop, busyDriverSet) => {
  const classes = [];
  if (MEAL_PROPS.has(prop)) classes.push('hot-meal-cell');
  if (prop === 'vehicle_driver') {
    const driver = normalizeText(rowData?.vehicle_driver).toLowerCase();
    if (driver && busyDriverSet.has(driver)) classes.push('hot-busy-driver-cell');
  }
  return classes.join(' ');
};

const ASCII_LETTER_RE = /^[A-Za-z]$/;

const LogisticsSpreadsheet = ({ group, onUpdate, busyDriverNames = [] }) => {
  const hotRef = useRef(null);
  const saveColWidthsTimerRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [activeSection, setActiveSection] = useState(TABLE_CONFIGS[0].key);
  const [sectionColWidths, setSectionColWidths] = useState(SECTION_DEFAULT_WIDTHS);

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
    onUpdate?.({
      ...group,
      logistics: nextStateRows.map(mergeSheetRowToSource)
    });
  }, [group, onUpdate]);

  const handleAfterChange = useCallback((changes, source) => {
    if (!changes || source === 'loadData' || source === 'internal-sync') return;

    setRows((prev) => {
      let changed = false;
      const next = [...prev];

      changes.forEach(([rowIndex, prop, oldValue, newValue]) => {
        const field = String(prop);
        if (!COPYABLE_PROPS.has(field)) return;
        if (oldValue === newValue) return;
        if (!next[rowIndex]) return;
        next[rowIndex] = {
          ...next[rowIndex],
          [field]: newValue === null || newValue === undefined ? '' : String(newValue)
        };
        changed = true;
      });

      if (!changed) return prev;
      emitRowsUpdate(next);
      return next;
    });
  }, [emitRowsUpdate]);

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

    const cellValue = normalizeText(hot.getDataAtCell(visualRow, visualCol));
    if (cellValue) return;

    editor.setValue('');
  }, []);

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
    return {
      readOnly: prop === 'dateLabel',
      className: toClassName(rowData, prop, busyDriverSet)
    };
  }, [rows, busyDriverSet]);

  const sectionConfig = useMemo(
    () => TABLE_CONFIGS.find((section) => section.key === activeSection) || TABLE_CONFIGS[0],
    [activeSection]
  );

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
