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
  departure_city: source.departure_city || source.departureCity || '',
  arrival_city: source.arrival_city || source.arrivalCity || '',
  hotel: source.hotel || '',
  hotel_address: source.hotel_address || source.hotelAddress || '',
  pickup: {
    time: source.pickup?.time || source.pickup_time || '',
    location: source.pickup?.location || source.pickup_location || '',
    contact: source.pickup?.contact || source.pickup_contact || '',
    flight_no: source.pickup?.flight_no || source.pickup?.flightNo || source.pickup_flight_no || '',
    airline: source.pickup?.airline || source.pickup_airline || '',
    terminal: source.pickup?.terminal || source.pickup_terminal || ''
  },
  dropoff: {
    time: source.dropoff?.time || source.dropoff_time || '',
    location: source.dropoff?.location || source.dropoff_location || '',
    contact: source.dropoff?.contact || source.dropoff_contact || '',
    flight_no: source.dropoff?.flight_no || source.dropoff?.flightNo || source.dropoff_flight_no || '',
    airline: source.dropoff?.airline || source.dropoff_airline || '',
    terminal: source.dropoff?.terminal || source.dropoff_terminal || ''
  },
  meals: {
    breakfast: source.meals?.breakfast || source.meals?.b || source.breakfast || '',
    breakfast_place: source.meals?.breakfast_place || source.meals?.breakfast_address || source.breakfast_place || '',
    breakfast_disabled: source.meals?.breakfast_disabled || source.meals?.breakfastDisabled || false,
    lunch: source.meals?.lunch || source.meals?.l || source.lunch || '',
    lunch_place: source.meals?.lunch_place || source.meals?.lunch_address || source.lunch_place || '',
    lunch_disabled: source.meals?.lunch_disabled || source.meals?.lunchDisabled || false,
    dinner: source.meals?.dinner || source.meals?.d || source.dinner || '',
    dinner_place: source.meals?.dinner_place || source.meals?.dinner_address || source.dinner_place || '',
    dinner_disabled: source.meals?.dinner_disabled || source.meals?.dinnerDisabled || false
  },
  vehicle: {
    driver: source.vehicle?.driver || source.vehicle?.name || '',
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
  departure_city: source.departure_city || source.departureCity || '',
  arrival_city: source.arrival_city || source.arrivalCity || '',
  hotel: source.hotel || '',
  hotel_address: source.hotel_address || source.hotelAddress || '',
  pickup: { ...(source.pickup || {}) },
  dropoff: { ...(source.dropoff || {}) },
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
  const groupSize = useMemo(() => (
    (group?.student_count || 0) + (group?.teacher_count || 0)
  ), [group?.student_count, group?.teacher_count]);

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
          groupSize={groupSize}
        />
        </div>
      </div>
    </div>
  );
};

export default LogisticsView;




