import React, { useMemo } from 'react';
import dayjs from 'dayjs';

const ScheduleDetail = ({ groupData, schedules = [] }) => {
  const scheduleSummary = useMemo(() => {
    const sorted = [...schedules].filter(item => item?.date).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    const map = new Map();
    sorted.forEach((item) => {
      if (!map.has(item.date)) {
        map.set(item.date, []);
      }
      map.get(item.date).push(item);
    });

    let dates = [];
    if (groupData?.start_date && groupData?.end_date) {
      let cursor = dayjs(groupData.start_date);
      const last = dayjs(groupData.end_date);
      while (cursor.isBefore(last, 'day') || cursor.isSame(last, 'day')) {
        dates.push(cursor.format('YYYY-MM-DD'));
        cursor = cursor.add(1, 'day');
      }
    } else {
      dates = Array.from(map.keys()).sort();
    }

    return { dates, map };
  }, [groupData?.start_date, groupData?.end_date, schedules]);

  return (
    <div className="unified-info-view">
      <div className="info-card">
        <div className="card-header">
          <span className="card-title">详细日程</span>
        </div>
        <div className="card-body">
          <div className="schedule-detail-list">
            {scheduleSummary.dates.map((date) => {
              const items = scheduleSummary.map.get(date) || [];
              const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
              const weekday = weekdayLabels[dayjs(date).day()];

              return (
                <div key={date} className="schedule-detail-day">
                  <div className="schedule-detail-date">
                    {dayjs(date).format('YYYY-MM-DD')} {weekday}
                  </div>
                  {items.length === 0 ? (
                    <div className="schedule-detail-empty">暂无安排</div>
                  ) : (
                    <div className="schedule-detail-items">
                      {items.map((item) => (
                        <div key={item.id} className="schedule-detail-item">
                          <span className="schedule-detail-time">
                            {item.startTime}-{item.endTime}
                          </span>
                          <span className="schedule-detail-name">{item.title || '未命名'}</span>
                          {item.location ? (
                            <span className="schedule-detail-location">{item.location}</span>
                          ) : null}
                          {item.description ? (
                            <span className="schedule-detail-desc">{item.description}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDetail;
