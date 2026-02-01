import React from 'react';
import dayjs from 'dayjs';
import SmartInput from './SmartInput';

const weekdayLabel = (dateStr) => {
  const day = dayjs(dateStr).day();
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return labels[day] || '';
};

const resolveEventTitle = (event) => {
  return event?.title || event?.location || event?.description || '未命名活动';
};

const parseDropPayload = (event) => {
  const json = event.dataTransfer?.getData('application/json');
  if (json) {
    try {
      return JSON.parse(json);
    } catch (error) {
      return null;
    }
  }
  const text = event.dataTransfer?.getData('text/plain');
  if (text) return { name: text };
  return null;
};

const DayResourceRow = ({
  day,
  scheduleItems = [],
  onUpdateDay,
  hotelOptions = [],
  mealOptions = []
}) => {
  const meals = day.meals || {};
  const vehicle = day.vehicle || {};
  const guide = day.guide || {};

  const handleUpdate = (updates) => {
    onUpdateDay?.(day.date, updates);
  };

  const handleMealChange = (key, value) => {
    handleUpdate({ meals: { ...meals, [key]: value } });
  };

  const handleVehicleChange = (key, value) => {
    handleUpdate({ vehicle: { ...vehicle, [key]: value } });
  };

  const handleGuideChange = (key, value) => {
    handleUpdate({ guide: { ...guide, [key]: value } });
  };

  const handleDrop = (slot) => (event) => {
    event.preventDefault();
    const payload = parseDropPayload(event);
    if (!payload) return;

    if (slot === 'vehicle') {
      handleUpdate({
        vehicle: {
          ...vehicle,
          name: payload.name || vehicle.name || '',
          plate: payload.plate || payload.sub || vehicle.plate || ''
        }
      });
      return;
    }
    if (slot === 'guide') {
      handleUpdate({
        guide: {
          ...guide,
          name: payload.name || guide.name || '',
          phone: payload.phone || payload.sub || guide.phone || ''
        }
      });
      return;
    }
    if (slot === 'security') {
      handleUpdate({ security: payload.name || day.security || '' });
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  return (
    <div className="matrix-row">
      <div className="matrix-date-col">
        <div className="date-big">{dayjs(day.date).format('MM-DD')}</div>
        {weekdayLabel(day.date)}
      </div>

      <div className="matrix-schedule-col">
        {scheduleItems.length === 0 && (
          <div className="sched-item empty">暂无行程</div>
        )}
        {scheduleItems.slice(0, 3).map((item) => (
          <div className="sched-item" key={item.id || `${day.date}-${item.startTime || item.start_time}`}
          >
            <div className="sched-dot" />
            {resolveEventTitle(item)}
          </div>
        ))}
      </div>

      <div className="matrix-res-col">
        <div className="res-grid-top">
          <div className="res-slot">
            <div className="slot-lbl">住宿</div>
            <SmartInput
              className="hotel"
              value={day.hotel || ''}
              placeholder="酒店/公寓"
              options={hotelOptions}
              onChange={(value) => handleUpdate({ hotel: value })}
            />
          </div>
          <div className="res-slot">
            <div className="slot-lbl">早餐</div>
            <SmartInput
              className="meal"
              value={meals.b || ''}
              placeholder="早餐"
              options={mealOptions}
              onChange={(value) => handleMealChange('b', value)}
            />
          </div>
          <div className="res-slot">
            <div className="slot-lbl">午餐</div>
            <SmartInput
              className="meal"
              value={meals.l || ''}
              placeholder="午餐"
              options={mealOptions}
              onChange={(value) => handleMealChange('l', value)}
            />
          </div>
          <div className="res-slot">
            <div className="slot-lbl">晚餐</div>
            <SmartInput
              className="meal"
              value={meals.d || ''}
              placeholder="晚餐"
              options={mealOptions}
              onChange={(value) => handleMealChange('d', value)}
            />
          </div>
        </div>

        <div className="res-grid-mid">
          <div className="res-slot" onDrop={handleDrop('vehicle')} onDragOver={handleDragOver}>
            <div className="slot-lbl">车辆</div>
            <SmartInput
              value={vehicle.name || ''}
              placeholder="司机/车辆"
              onChange={(value) => handleVehicleChange('name', value)}
              className="bold"
            />
            <SmartInput
              value={vehicle.plate || ''}
              placeholder="车牌/电话"
              onChange={(value) => handleVehicleChange('plate', value)}
              className="smart-input-sub"
            />
          </div>
          <div className="res-slot" onDrop={handleDrop('guide')} onDragOver={handleDragOver}>
            <div className="slot-lbl">导游</div>
            <SmartInput
              value={guide.name || ''}
              placeholder="导游姓名"
              onChange={(value) => handleGuideChange('name', value)}
              className="bold"
            />
            <SmartInput
              value={guide.phone || ''}
              placeholder="电话"
              onChange={(value) => handleGuideChange('phone', value)}
              className="smart-input-sub"
            />
          </div>
          <div className="res-slot" onDrop={handleDrop('security')} onDragOver={handleDragOver}>
            <div className="slot-lbl">安保</div>
            <SmartInput
              value={day.security || ''}
              placeholder="安保人员"
              onChange={(value) => handleUpdate({ security: value })}
            />
          </div>
        </div>

        <div className="res-note-row">
          <textarea
            className="ghost-area"
            placeholder="当日备注..."
            value={day.note || ''}
            onChange={(event) => handleUpdate({ note: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
};

export default DayResourceRow;

