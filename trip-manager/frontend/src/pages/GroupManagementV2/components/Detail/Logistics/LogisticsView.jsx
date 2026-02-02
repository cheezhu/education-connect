import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const toText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    if (!text || text === '[object Object]' || text === 'undefined' || text === 'null') {
      return '';
    }
    return text;
  }
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name;
    if (typeof value.label === 'string') return value.label;
    if (typeof value.value === 'string' || typeof value.value === 'number') {
      return String(value.value);
    }
  }
  return '';
};

const normalizeLogisticsRow = (date, source = {}) => ({
  date,
  city: toText(source.city),
  departure_city: toText(source.departure_city || source.departureCity),
  arrival_city: toText(source.arrival_city || source.arrivalCity),
  hotel: toText(source.hotel),
  hotel_address: toText(source.hotel_address || source.hotelAddress),
  hotel_disabled: source.hotel_disabled || false,
  pickup: {
    time: toText(source.pickup?.time || source.pickup_time),
    end_time: toText(source.pickup?.end_time || source.pickup?.endTime || source.pickup_end_time),
    location: toText(source.pickup?.location || source.pickup_location),
    contact: toText(source.pickup?.contact || source.pickup_contact),
    flight_no: toText(source.pickup?.flight_no || source.pickup?.flightNo || source.pickup_flight_no),
    airline: toText(source.pickup?.airline || source.pickup_airline),
    terminal: toText(source.pickup?.terminal || source.pickup_terminal),
    detached: source.pickup?.detached || false,
    disabled: source.pickup?.disabled || source.pickup_disabled || false
  },
  dropoff: {
    time: toText(source.dropoff?.time || source.dropoff_time),
    end_time: toText(source.dropoff?.end_time || source.dropoff?.endTime || source.dropoff_end_time),
    location: toText(source.dropoff?.location || source.dropoff_location),
    contact: toText(source.dropoff?.contact || source.dropoff_contact),
    flight_no: toText(source.dropoff?.flight_no || source.dropoff?.flightNo || source.dropoff_flight_no),
    airline: toText(source.dropoff?.airline || source.dropoff_airline),
    terminal: toText(source.dropoff?.terminal || source.dropoff_terminal),
    detached: source.dropoff?.detached || false,
    disabled: source.dropoff?.disabled || source.dropoff_disabled || false
  },
  meals: {
    breakfast: toText(source.meals?.breakfast || source.meals?.b || source.breakfast),
    breakfast_place: toText(source.meals?.breakfast_place || source.meals?.breakfast_address || source.breakfast_place),
    breakfast_disabled: source.meals?.breakfast_disabled || source.meals?.breakfastDisabled || false,
    breakfast_time: toText(source.meals?.breakfast_time || source.meals?.breakfastTime),
    breakfast_end: toText(source.meals?.breakfast_end || source.meals?.breakfastEnd),
    breakfast_detached: source.meals?.breakfast_detached || source.meals?.breakfastDetached || false,
    lunch: toText(source.meals?.lunch || source.meals?.l || source.lunch),
    lunch_place: toText(source.meals?.lunch_place || source.meals?.lunch_address || source.lunch_place),
    lunch_disabled: source.meals?.lunch_disabled || source.meals?.lunchDisabled || false,
    lunch_time: toText(source.meals?.lunch_time || source.meals?.lunchTime),
    lunch_end: toText(source.meals?.lunch_end || source.meals?.lunchEnd),
    lunch_detached: source.meals?.lunch_detached || source.meals?.lunchDetached || false,
    dinner: toText(source.meals?.dinner || source.meals?.d || source.dinner),
    dinner_place: toText(source.meals?.dinner_place || source.meals?.dinner_address || source.dinner_place),
    dinner_disabled: source.meals?.dinner_disabled || source.meals?.dinnerDisabled || false,
    dinner_time: toText(source.meals?.dinner_time || source.meals?.dinnerTime),
    dinner_end: toText(source.meals?.dinner_end || source.meals?.dinnerEnd),
    dinner_detached: source.meals?.dinner_detached || source.meals?.dinnerDetached || false
  },
  vehicle: {
    driver: toText(source.vehicle?.driver || source.vehicle?.name),
    plate: toText(source.vehicle?.plate),
    phone: toText(source.vehicle?.phone)
  },
  vehicle_disabled: source.vehicle_disabled || source.vehicle?.disabled || false,
  guide: {
    name: toText(source.guide?.name || source.guide),
    phone: toText(source.guide?.phone)
  },
  guide_disabled: source.guide_disabled || source.guide?.disabled || false,
  security: {
    name: toText(source.security?.name || source.security),
    phone: toText(source.security?.phone)
  },
  security_disabled: source.security_disabled || source.security?.disabled || false,
  note: toText(source.note)
});

const cloneRowValues = (date, source) => ({
  date,
  city: source.city || '',
  departure_city: source.departure_city || source.departureCity || '',
  arrival_city: source.arrival_city || source.arrivalCity || '',
  hotel: source.hotel || '',
  hotel_address: source.hotel_address || source.hotelAddress || '',
  hotel_disabled: source.hotel_disabled || false,
  pickup: { ...(source.pickup || {}) },
  dropoff: { ...(source.dropoff || {}) },
  meals: { ...(source.meals || {}) },
  vehicle: { ...(source.vehicle || {}) },
  vehicle_disabled: source.vehicle_disabled || false,
  guide: { ...(source.guide || {}) },
  guide_disabled: source.guide_disabled || false,
  security: { ...(source.security || {}) },
  security_disabled: source.security_disabled || false,
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

const pickStation = (list = [], patterns = []) => {
  if (!Array.isArray(list) || list.length === 0) return null;
  if (patterns.length > 0) {
    const match = list.find((item) => (
      patterns.some((pattern) => (
        typeof item?.place === 'string' && item.place.includes(pattern)
      ))
    ));
    if (match) return match;
  }
  return list[0];
};

const normalizeHkoWeather = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const tempData = payload?.temperature?.data || [];
  const humidityData = payload?.humidity?.data || [];
  const rainfallData = payload?.rainfall?.data || [];
  const tempStation = pickStation(tempData, ['香港天文台', 'Hong Kong Observatory']);
  const humidityStation = pickStation(humidityData, ['香港天文台', 'Hong Kong Observatory']);
  const rainfallStation = pickStation(rainfallData);
  const warning = Array.isArray(payload.warningMessage)
    ? payload.warningMessage.filter(Boolean).join(' ')
    : (payload.warningMessage || '');

  return {
    temperature: tempStation
      ? { place: tempStation.place, value: tempStation.value, unit: tempStation.unit }
      : null,
    humidity: humidityStation
      ? { place: humidityStation.place, value: humidityStation.value, unit: humidityStation.unit }
      : null,
    rainfall: rainfallStation
      ? {
          place: rainfallStation.place,
          value: rainfallStation.max,
          unit: rainfallStation.unit,
          startTime: payload?.rainfall?.startTime || '',
          endTime: payload?.rainfall?.endTime || ''
        }
      : null,
    updateTime: payload.updateTime
      || payload?.temperature?.recordTime
      || payload?.humidity?.recordTime
      || '',
    warningMessage: warning
  };
};

const normalizeHkoForecast = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const list = Array.isArray(payload.weatherForecast) ? payload.weatherForecast : [];
  const normalized = list.map((item) => ({
    date: dayjs(item.forecastDate, 'YYYYMMDD').format('YYYY-MM-DD'),
    minTemp: item.forecastMintemp?.value ?? null,
    maxTemp: item.forecastMaxtemp?.value ?? null,
    minRh: item.forecastMinrh?.value ?? null,
    maxRh: item.forecastMaxrh?.value ?? null,
    wind: item.forecastWind || '',
    weather: item.forecastWeather || ''
  }));

  return {
    list: normalized,
    updateTime: payload.updateTime || ''
  };
};

const LogisticsView = ({ group, schedules = [], onUpdate }) => {
  const [rows, setRows] = useState([]);
  const [hkoWeather, setHkoWeather] = useState({ status: 'idle', data: null, error: '' });
  const [hkoForecast, setHkoForecast] = useState({
    status: 'idle',
    list: [],
    updateTime: '',
    error: ''
  });
  const saveTimeoutRef = useRef(null);

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
  }, [group?.id, group?.logistics, dateRange]);

  useEffect(() => {
    return () => {
      clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchWeather = async () => {
      setHkoWeather((prev) => ({
        ...prev,
        status: prev.data ? 'refreshing' : 'loading',
        error: ''
      }));

      try {
        const response = await fetch(
          'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=sc'
        );
        if (!response.ok) throw new Error('无法获取香港天文台数据');
        const payload = await response.json();
        if (cancelled) return;
        const nextData = normalizeHkoWeather(payload);
        if (!nextData) throw new Error('天气数据格式异常');
        setHkoWeather({ status: 'ready', data: nextData, error: '' });
      } catch (error) {
        if (cancelled) return;
        setHkoWeather((prev) => ({
          status: 'error',
          data: prev.data,
          error: error?.message || '天气数据获取失败'
        }));
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchForecast = async () => {
      setHkoForecast((prev) => ({
        ...prev,
        status: prev.list.length > 0 ? 'refreshing' : 'loading',
        error: ''
      }));

      try {
        const response = await fetch(
          'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=sc'
        );
        if (!response.ok) throw new Error('无法获取香港天文台预报');
        const payload = await response.json();
        if (cancelled) return;
        const nextData = normalizeHkoForecast(payload);
        if (!nextData) throw new Error('天气预报格式异常');
        setHkoForecast({ status: 'ready', ...nextData, error: '' });
      } catch (error) {
        if (cancelled) return;
        setHkoForecast((prev) => ({
          ...prev,
          status: 'error',
          error: error?.message || '天气预报获取失败'
        }));
      }
    };

    fetchForecast();
    const interval = setInterval(fetchForecast, 60 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const scheduleMap = useMemo(() => buildScheduleMap(schedules), [schedules]);
  const groupSize = useMemo(() => (
    (group?.student_count || 0) + (group?.teacher_count || 0)
  ), [group?.student_count, group?.teacher_count]);

  const queueSave = useCallback((nextRows) => {
    if (!group) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      onUpdate?.({ ...group, logistics: nextRows });
    }, 300);
  }, [group, onUpdate]);

  const handleUpdateDay = useCallback((date, updates) => {
    setRows((prev) => {
      const next = prev.map((row) => (
        row.date === date ? { ...row, ...updates } : row
      ));
      queueSave(next);
      return next;
    });
  }, [queueSave]);

  const handleCopyPrevDay = useCallback((index) => {
    if (index <= 0) return;
    setRows((prev) => {
      const source = prev[index - 1];
      if (!source) return prev;
      const next = prev.map((row, idx) => (
        idx === index ? cloneRowValues(row.date, source) : row
      ));
      queueSave(next);
      return next;
    });
  }, [queueSave]);

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
            weatherData={{ current: hkoWeather, forecast: hkoForecast }}
          />
        </div>
      </div>
    </div>
  );
};

export default LogisticsView;





