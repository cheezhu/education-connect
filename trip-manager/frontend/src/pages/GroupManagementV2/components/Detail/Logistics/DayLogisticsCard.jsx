import React, { useId } from 'react';
import dayjs from 'dayjs';

const weekdayLabel = (dateStr) => {
  if (!dateStr) return '';
  return dayjs(dateStr).format('ddd / MMM');
};

const resolveEventTitle = (event) => {
  return event?.title || event?.location || event?.description || '未命名活动';
};

const DayLogisticsCard = ({
  day,
  scheduleItems = [],
  index = 0,
  onCopyPrevDay,
  onUpdateDay,
  hotelOptions = [],
  vehicleOptions = [],
  guideOptions = [],
  securityOptions = [],
  mealOptions = []
}) => {
  const id = useId();
  const meals = day.meals || {};
  const vehicle = day.vehicle || {};
  const guide = day.guide || {};
  const security = day.security || {};

  const handleUpdate = (updates) => {
    onUpdateDay?.(day.date, updates);
  };

  const handleMealChange = (field, value) => {
    handleUpdate({ meals: { ...meals, [field]: value } });
  };

  const handleVehicleChange = (field, value) => {
    handleUpdate({ vehicle: { ...vehicle, [field]: value } });
  };

  const handleGuideChange = (field, value) => {
    handleUpdate({ guide: { ...guide, [field]: value } });
  };

  const handleSecurityChange = (field, value) => {
    handleUpdate({ security: { ...security, [field]: value } });
  };

  return (
    <div className="day-card">
      <div className="day-context">
        <div className="date-large">{dayjs(day.date).format('DD')}</div>
        <div className="date-week">{weekdayLabel(day.date)}</div>

        <div className="city-box">
          <div className="city-label">所在城市</div>
          <input
            className="city-input"
            value={day.city || ''}
            placeholder="输入城市..."
            onChange={(event) => handleUpdate({ city: event.target.value })}
          />
        </div>

        <div className="context-events">
          <div className="context-title">行程参考</div>
          {scheduleItems.length === 0 && (
            <div className="context-item empty">暂无行程</div>
          )}
          {scheduleItems.slice(0, 3).map((item) => (
            <div className="context-item" key={item.id || `${day.date}-${item.startTime || item.start_time}`}
            >
              <span className="context-time">{item.startTime || item.start_time || '--:--'}</span>
              <span className="context-name">{resolveEventTitle(item)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="day-form">
        <div className="day-actions">
          <button
            className="btn-link"
            type="button"
            disabled={index === 0}
            onClick={() => onCopyPrevDay?.(index)}
          >
            复制上一日
          </button>
        </div>
        <div className="form-grid">
          <div className="input-group">
            <label className="label">住宿酒店</label>
            <input
              className="input-box"
              value={day.hotel || ''}
              placeholder="输入酒店名称"
              onChange={(event) => handleUpdate({ hotel: event.target.value })}
              list={`${id}-hotel`}
            />
            {hotelOptions.length > 0 && (
              <datalist id={`${id}-hotel`}>
                {hotelOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            )}
          </div>
          <div className="input-group">
            <label className="label">车辆调度</label>
            <div className="multi-input">
              <input
                className="input-box input-main"
                value={vehicle.name || ''}
                placeholder="司机姓名"
                onChange={(event) => handleVehicleChange('name', event.target.value)}
                list={`${id}-vehicle`}
              />
              <input
                className="input-box input-sub"
                value={vehicle.plate || ''}
                placeholder="车牌/电话"
                onChange={(event) => handleVehicleChange('plate', event.target.value)}
              />
            </div>
            {vehicleOptions.length > 0 && (
              <datalist id={`${id}-vehicle`}>
                {vehicleOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            )}
          </div>
        </div>

        <div className="form-grid">
          <div className="input-group">
            <label className="label">随团导游</label>
            <div className="multi-input">
              <input
                className="input-box input-main"
                value={guide.name || ''}
                placeholder="导游姓名"
                onChange={(event) => handleGuideChange('name', event.target.value)}
                list={`${id}-guide`}
              />
              <input
                className="input-box input-sub"
                value={guide.phone || ''}
                placeholder="联系电话"
                onChange={(event) => handleGuideChange('phone', event.target.value)}
              />
            </div>
            {guideOptions.length > 0 && (
              <datalist id={`${id}-guide`}>
                {guideOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            )}
          </div>
          <div className="input-group">
            <label className="label">安保人员</label>
            <div className="multi-input">
              <input
                className="input-box input-main"
                value={security.name || ''}
                placeholder="安保姓名"
                onChange={(event) => handleSecurityChange('name', event.target.value)}
                list={`${id}-security`}
              />
              <input
                className="input-box input-sub"
                value={security.phone || ''}
                placeholder="联系电话"
                onChange={(event) => handleSecurityChange('phone', event.target.value)}
              />
            </div>
            {securityOptions.length > 0 && (
              <datalist id={`${id}-security`}>
                {securityOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            )}
          </div>
        </div>

        <div className="meal-section">
          <div className="meal-row">
            <div className="meal-label-box breakfast">早餐</div>
            <input
              className="meal-input"
              value={meals.breakfast || ''}
              placeholder="早餐安排"
              onChange={(event) => handleMealChange('breakfast', event.target.value)}
              list={`${id}-meal`}
            />
          </div>
          <div className="meal-row">
            <div className="meal-label-box lunch">午餐</div>
            <input
              className="meal-input"
              value={meals.lunch || ''}
              placeholder="午餐安排"
              onChange={(event) => handleMealChange('lunch', event.target.value)}
              list={`${id}-meal`}
            />
          </div>
          <div className="meal-row">
            <div className="meal-label-box dinner">晚餐</div>
            <input
              className="meal-input"
              value={meals.dinner || ''}
              placeholder="晚餐安排"
              onChange={(event) => handleMealChange('dinner', event.target.value)}
              list={`${id}-meal`}
            />
          </div>
          {mealOptions.length > 0 && (
            <datalist id={`${id}-meal`}>
              {mealOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          )}
        </div>

        <div className="input-group">
          <textarea
            className="input-box note-input"
            placeholder="添加当日特殊备注..."
            value={day.note || ''}
            onChange={(event) => handleUpdate({ note: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
};

export default DayLogisticsCard;



