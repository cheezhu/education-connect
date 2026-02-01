import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import LogisticsMatrix from './LogisticsMatrix';

const buildDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return [];
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  if (!start.isValid() || !end.isValid() || start.isAfter(end)) return [];
  const dates = [];
  let cursor = start;
  while (!cursor.isAfter(end, 'day')) {
    dates.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'day');
  }
  return dates;
};

const normalizeLogisticsRow = (date, source = {}) => ({
  date,
  city: source.city || '',
  hotel: source.hotel || '',
  meals: {
    breakfast: source.meals?.breakfast || source.meals?.b || source.breakfast || '',
    lunch: source.meals?.lunch || source.meals?.l || source.lunch || '',
    dinner: source.meals?.dinner || source.meals?.d || source.dinner || ''
  },
  vehicle: {
    name: source.vehicle?.name || '',
    plate: source.vehicle?.plate || '',
    phone: source.vehicle?.phone || ''
  },
  guide: {
    name: source.guide?.name || '',
    phone: source.guide?.phone || ''
  },
  security: {
    name: source.security?.name || source.security || '',
    phone: source.security?.phone || ''
  },
  note: source.note || ''
});

const cloneRowValues = (date, source) => ({
  date,
  city: source.city || '',
  hotel: source.hotel || '',
  meals: { ...(source.meals || {}) },
  vehicle: { ...(source.vehicle || {}) },
  guide: { ...(source.guide || {}) },
  security: { ...(source.security || {}) },
  note: source.note || ''
});

const buildScheduleMap = (schedules = []) => {
  const map = new Map();
  schedules.forEach((item) => {
    const date = item.activity_date || item.date;
    if (!date) return;
    if (!map.has(date)) map.set(date, []);
    map.get(date).push(item);
  });

  map.forEach((items) => {
    items.sort((a, b) => {
      const aTime = a.startTime || a.start_time || '';
      const bTime = b.startTime || b.start_time || '';
      return aTime.localeCompare(bTime);
    });
  });

  return map;
};

const LogisticsView = ({ group, schedules = [], onUpdate }) => {
  const [rows, setRows] = useState([]);

  const dateRange = useMemo(() => (
    buildDateRange(group?.start_date, group?.end_date)
  ), [group?.start_date, group?.end_date]);

  useEffect(() => {
    if (!group) {
      setRows([]);
      return;
    }
    const existing = Array.isArray(group.logistics) ? group.logistics : [];
    const nextRows = dateRange.map((date) => {
      const match = existing.find((item) => item.date === date) || {};
      return normalizeLogisticsRow(date, match);
    });
    setRows(nextRows);
  }, [group?.id, dateRange]);

  const scheduleMap = useMemo(() => buildScheduleMap(schedules), [schedules]);

  const handleUpdateDay = useCallback((date, updates) => {
    setRows((prev) => prev.map((row) => (
      row.date === date ? { ...row, ...updates } : row
    )));
  }, []);

  const handleCopyFirstDay = () => {
    if (rows.length <= 1) return;
    const source = rows[0];
    setRows((prev) => prev.map((row, index) => (
      index === 0 ? row : cloneRowValues(row.date, source)
    )));
  };

  const handleCopyPrevDay = useCallback((index) => {
    if (index <= 0) return;
    setRows((prev) => {
      const source = prev[index - 1];
      if (!source) return prev;
      return prev.map((row, idx) => (
        idx === index ? cloneRowValues(row.date, source) : row
      ));
    });
  }, []);

  const handleSave = () => {
    if (!group) return;
    onUpdate?.({ ...group, logistics: rows });
  };

  const hotelOptions = ['专家公寓A楼', '维也纳酒店', '锦江之星', '希尔顿花园'];
  const vehicleOptions = ['王师傅', '李师傅', '陈师傅'];
  const guideOptions = ['张导', '李导', '赵导'];
  const securityOptions = ['赵安保', '陈安保'];
  const mealOptions = ['酒店自带', '基地团餐', '自理', '特色餐', '路餐'];

  if (!group) {
    return (
      <div className="logistics-layout">
        <div className="view-container">
          <div className="empty-state">请选择团组</div>
        </div>
      </div>
    );
  }

  return (
    <div className="logistics-layout">
      <div className="view-container">
        <div className="logistics-panel">
          <div className="logistics-header">
            <div className="logistics-title">每日资源分配</div>
            <div className="logistics-actions">
              <button className="logistics-btn" onClick={handleCopyFirstDay}>
                复制首日到全部
              </button>
              <button className="logistics-btn primary" onClick={handleSave}>
                保存修改
              </button>
            </div>
          </div>

          <LogisticsMatrix
            rows={rows}
            scheduleMap={scheduleMap}
            onUpdateDay={handleUpdateDay}
            onCopyPrevDay={handleCopyPrevDay}
            hotelOptions={hotelOptions}
            vehicleOptions={vehicleOptions}
            guideOptions={guideOptions}
            securityOptions={securityOptions}
            mealOptions={mealOptions}
          />
        </div>
      </div>
    </div>
  );
};

export default LogisticsView;



