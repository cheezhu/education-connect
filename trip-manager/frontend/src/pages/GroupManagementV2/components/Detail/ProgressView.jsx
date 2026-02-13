import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import {
  buildCompletionStats,
  isItineraryItem,
  isMealComplete,
  isTextFilled,
  resolveEventTitle,
  weekdayLabel
} from './profileUtils';
import { PROFILE_TEXT } from '../../constants';

const ProgressView = ({ group, schedules = [], onNavigateTab }) => {
  const logistics = useMemo(
    () => (Array.isArray(group?.logistics) ? group.logistics : []),
    [group?.logistics]
  );

  const completionStats = useMemo(
    () => buildCompletionStats(logistics, group),
    [logistics, group?.start_date, group?.end_date]
  );

  const daysToStart = useMemo(
    () => (group?.start_date ? dayjs(group.start_date).diff(dayjs(), 'day') : null),
    [group?.start_date]
  );

  const scheduleSummary = useMemo(() => {
    const map = new Map();
    (schedules || []).forEach((item) => {
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
  }, [schedules]);

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
    <div className="profile-layout profile-doc">
      <div className="profile-center doc-container">
        <div className="doc-content">
          <div className="dashboard-section">
            <div className="dash-header">
              <div className="dash-title">准备进度概览</div>
            </div>
            <div className="dash-grid">
              <div className="progress-card">
                <div className="ring-container">
                  <svg width="100" height="100">
                    <circle className="ring-bg" cx="50" cy="50" r="40"></circle>
                    <circle
                      className="ring-val"
                      cx="50"
                      cy="50"
                      r="40"
                      style={{
                        strokeDasharray: 251,
                        strokeDashoffset: Math.max(0, 251 - (completionStats.percent / 100) * 251)
                      }}
                    ></circle>
                  </svg>
                  <div className="ring-text">{completionStats.percent}%</div>
                </div>
                <div className="ring-title">整体完成度</div>
                <div className="ring-sub">
                  {daysToStart !== null ? `预计 ${Math.max(daysToStart, 0)} 天后出发` : '未设置出发日期'}
                </div>
              </div>

              <div className="staff-list">
                {completionStats.modules.map((module) => (
                  <div className="staff-row" key={module.key}>
                    <div className="avatar" style={{ background: '#f1f5f9', color: module.color }}>
                      {module.label.slice(0, 1)}
                    </div>
                    <div className="staff-info">
                      <div className="staff-name">{module.label}</div>
                      <div className="staff-role">按食行卡片填写完成度统计</div>
                    </div>
                    <div className="task-bar">
                      <div
                        className="task-fill"
                        style={{ width: `${module.ratio}%`, background: module.color }}
                      ></div>
                    </div>
                    <div className="task-stat" style={{ color: module.color }}>
                      {module.ratio}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="day-block">
            <div className="day-header">
              <div className="day-title">食行卡片预览</div>
              <button
                type="button"
                className="day-action"
                onClick={() => onNavigateTab?.('meals')}
              >
                查看全部
              </button>
            </div>

            {logistics.length === 0 && <div className="empty-state">暂无食行卡片数据</div>}

            {logistics.map((day, index) => {
              const dayMeals = day.meals || {};
              const scheduleItems = (scheduleSummary.get(day.date) || []).filter(isItineraryItem);
              const hotelDone = day.hotel_disabled || isTextFilled(day.hotel) || isTextFilled(day.hotel_address);
              const vehicleDone =
                day.vehicle_disabled ||
                isTextFilled(day.vehicle?.plate) ||
                isTextFilled(day.vehicle?.driver) ||
                isTextFilled(day.vehicle?.phone) ||
                isTextFilled(day.vehicle?.name);
              const guideDone = day.guide_disabled || isTextFilled(day.guide?.name) || isTextFilled(day.guide?.phone);
              const securityDone =
                day.security_disabled || isTextFilled(day.security?.name) || isTextFilled(day.security?.phone);
              const mealsDone = isMealComplete(dayMeals, day.meals_disabled);
              const statusItems = [
                { key: 'hotel', label: '住宿', done: hotelDone },
                { key: 'vehicle', label: '车辆', done: vehicleDone },
                { key: 'guide', label: '导游', done: guideDone },
                { key: 'security', label: '安保', done: securityDone },
                { key: 'meals', label: '餐饮', done: mealsDone }
              ];
              const mealEntries = [
                {
                  key: 'breakfast',
                  label: '早餐',
                  place: dayMeals.breakfast_place,
                  plan: dayMeals.breakfast,
                  disabled: dayMeals.breakfast_disabled
                },
                {
                  key: 'lunch',
                  label: '午餐',
                  place: dayMeals.lunch_place,
                  plan: dayMeals.lunch,
                  disabled: dayMeals.lunch_disabled
                },
                {
                  key: 'dinner',
                  label: '晚餐',
                  place: dayMeals.dinner_place,
                  plan: dayMeals.dinner,
                  disabled: dayMeals.dinner_disabled
                }
              ];
              const visibleMeals = mealEntries.filter((meal) => !meal.disabled);
              return (
                <div className="shixing-card" key={`${day.date}-${index}`}>
                  <div className="card-row">
                    <div className="card-label">日期</div>
                    <div className="card-content">
                      <strong>{dayjs(day.date).format('MM-DD')}</strong>
                      <span className="muted">{weekdayLabel(day.date)}</span>
                    </div>
                  </div>
                  <div className="card-row">
                    <div className="card-label">录入状态</div>
                    <div className="card-content">
                      {statusItems.map((item) => (
                        <span
                          key={`${day.date}-${item.key}`}
                          className={`status-badge ${item.done ? 'done' : 'pending'}`}
                        >
                          {item.label}
                          {item.done ? '已填' : '未填'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="card-row">
                    <div className="card-label">餐饮安排</div>
                    <div className="card-content">
                      {visibleMeals.length === 0 && <span className="muted">无用餐安排</span>}
                      {visibleMeals.map((meal) => {
                        const text = [meal.place, meal.plan].filter(Boolean).join(' · ') || '未填写';
                        return (
                          <span className="schedule-chip" key={`${day.date}-${meal.key}`}>
                            {meal.label}：{text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="card-row">
                    <div className="card-label">行程安排</div>
                    <div className="card-content">
                      {scheduleItems.length === 0 && <span className="muted">暂无行程安排</span>}
                      {scheduleItems.map((item) => (
                        <span className="schedule-chip" key={`${day.date}-${item.id || item.startTime}`}>
                          {(item.startTime || item.start_time || '--:--') + ' '}
                          {resolveEventTitle(item)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressView;
