import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { createEmptyLogisticsRow } from '../../groupDataUtils';
import { PROFILE_TEXT } from '../../constants';

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

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text || text === '[object Object]' || text === 'undefined' || text === 'null') return '';
  return text;
};

const AccommodationView = ({ group, onUpdate }) => {
  const [rows, setRows] = useState([]);
  const debounceRef = useRef(null);

  const dateRange = useMemo(
    () => buildDateRange(group?.start_date, group?.end_date),
    [group?.start_date, group?.end_date]
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!group) {
      setRows([]);
      return;
    }
    const source = Array.isArray(group.logistics) ? group.logistics : [];
    const nextRows = dateRange.map((date) => {
      const existing = source.find((item) => item?.date === date);
      return existing ? { ...existing } : createEmptyLogisticsRow(date);
    });
    setRows(nextRows);
  }, [group?.id, group?.logistics, dateRange]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const queueSave = (nextRows) => {
    if (!group || !onUpdate) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate({ ...group, logistics: nextRows });
    }, 300);
  };

  const handleChange = (date, updates) => {
    setRows((prev) => {
      const next = prev.map((row) => (
        row.date === date ? { ...row, ...updates } : row
      ));
      queueSave(next);
      return next;
    });
  };

  if (!group) {
    return (
      <div className="profile-layout profile-doc">
        <div className="profile-center">
          <div className="empty-state">{PROFILE_TEXT.emptyState}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="accommodation-view">
      <div className="accommodation-header">
        <div className="accommodation-title">住宿安排</div>
        <div className="accommodation-subtitle">按天维护不同地点的酒店与房间安排（房间安排写入当日备注）</div>
      </div>

      {!rows.length ? (
        <div className="empty-state">未设置团组日期，无法生成住宿安排</div>
      ) : (
        <div className="accommodation-list">
          {rows.map((row, index) => (
            <div className="accommodation-card" key={row.date || index}>
              <div className="accommodation-card-date">
                <div className="date-main">{dayjs(row.date).format('MM-DD')}</div>
                <div className="date-sub">{dayjs(row.date).format('ddd')}</div>
              </div>
              <div className="accommodation-card-body">
                <div className="accommodation-row">
                  <label>城市</label>
                  <input
                    value={normalizeText(row.city || row.arrival_city || row.departure_city)}
                    placeholder="输入城市"
                    onChange={(event) => handleChange(row.date, { city: event.target.value })}
                  />
                </div>
                <div className="accommodation-row">
                  <label>酒店</label>
                  <input
                    value={normalizeText(row.hotel)}
                    placeholder="输入酒店名称"
                    onChange={(event) => handleChange(row.date, { hotel: event.target.value })}
                  />
                </div>
                <div className="accommodation-row">
                  <label>地址</label>
                  <input
                    value={normalizeText(row.hotel_address)}
                    placeholder="输入酒店地址"
                    onChange={(event) => handleChange(row.date, { hotel_address: event.target.value })}
                  />
                </div>
                <div className="accommodation-row full">
                  <label>房间安排</label>
                  <textarea
                    rows={3}
                    value={normalizeText(row.note)}
                    placeholder="例如：男生 12 间 / 女生 10 间 / 教师 6 间"
                    onChange={(event) => handleChange(row.date, { note: event.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AccommodationView;

