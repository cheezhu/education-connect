import React, { useId } from 'react';
import dayjs from 'dayjs';

const weekdayLabel = (dateStr) => {
  if (!dateStr) return '';
  return dayjs(dateStr).format('ddd / MMM');
};

const resolveEventTitle = (event) => {
  return event?.title || event?.location || event?.description || '未命名活动';
};

const isItineraryItem = (item) => {
  const type = (item?.type || '').toString().toLowerCase();
  if (!type) return true;
  return !['meal', 'transport', 'rest', 'free'].includes(type);
};

const parseHour = (timeStr = '') => {
  if (!timeStr) return null;
  const match = String(timeStr).match(/\d{1,2}/);
  if (!match) return null;
  const hour = Number(match[0]);
  if (Number.isNaN(hour)) return null;
  return hour;
};

const splitScheduleItems = (items = []) => {
  const buckets = {
    morning: [],
    afternoon: [],
    evening: []
  };

  items.forEach((item) => {
    const time = item.startTime || item.start_time || item.time || '';
    const hour = parseHour(time);
    let bucket = 'morning';
    if (hour !== null) {
      if (hour < 12) bucket = 'morning';
      else if (hour < 18) bucket = 'afternoon';
      else bucket = 'evening';
    }
    buckets[bucket].push(item);
  });

  return buckets;
};

const buildSlotList = (items = []) => {
  if (!items.length) return ['未安排'];
  return items.map((item) => {
    const title = resolveEventTitle(item);
    const location = item?.location || item?.place || item?.venue || '';
    return location || title;
  }).filter(Boolean);
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
  mealOptions = [],
  groupSize = 0,
  isFirstDay = false,
  isLastDay = false
}) => {
  const id = useId();
  const meals = day.meals || {};
  const vehicle = day.vehicle || {};
  const guide = day.guide || {};
  const security = day.security || {};
  const pickup = day.pickup || {};
  const dropoff = day.dropoff || {};
  const weatherCities = [];
  if (day.departure_city) weatherCities.push({ label: '出发城市', value: day.departure_city });
  if (day.arrival_city) weatherCities.push({ label: '抵达城市', value: day.arrival_city });
  if (weatherCities.length === 0 && day.city) weatherCities.push({ label: '所在城市', value: day.city });
  const itineraryItems = scheduleItems.filter(isItineraryItem);
  const scheduleBuckets = splitScheduleItems(itineraryItems);
  const morningItems = buildSlotList(scheduleBuckets.morning);
  const afternoonItems = buildSlotList(scheduleBuckets.afternoon);

  const hotelStatus = day.hotel ? '已填' : '未填';
  const vehicleStatus = vehicle.plate || vehicle.driver || vehicle.phone ? '已填' : '未填';
  const guideStatus = guide.name || guide.phone ? '已填' : '未填';
  const securityStatus = security.name || security.phone ? '已填' : '未填';
  const mealFilled = (value, disabled) => !!disabled || !!value;
  const mealFilledList = [
    mealFilled(meals.breakfast, meals.breakfast_disabled),
    mealFilled(meals.lunch, meals.lunch_disabled),
    mealFilled(meals.dinner, meals.dinner_disabled)
  ];
  const filledCount = mealFilledList.filter(Boolean).length;
  const mealStatus = filledCount === 0 ? '未填' : filledCount === 3 ? '已填' : '部分未填';
  const statusClassName = (value) => (value === '已填' ? 'status-ok' : 'status-warn');

  const handleUpdate = (updates) => {
    onUpdateDay?.(day.date, updates);
  };

  const handleMealChange = (field, value) => {
    handleUpdate({ meals: { ...meals, [field]: value } });
  };

  const handleMealToggle = (field) => {
    const key = `${field}_disabled`;
    const nextDisabled = !meals[key];
    const updates = { [key]: nextDisabled };
    if (nextDisabled) {
      updates[field] = '';
      updates[`${field}_place`] = '';
    }
    handleUpdate({ meals: { ...meals, ...updates } });
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

  const handlePickupChange = (field, value) => {
    handleUpdate({ pickup: { ...pickup, [field]: value } });
  };

  const handleDropoffChange = (field, value) => {
    handleUpdate({ dropoff: { ...dropoff, [field]: value } });
  };

  const breakfastDisabled = !!meals.breakfast_disabled;
  const lunchDisabled = !!meals.lunch_disabled;
  const dinnerDisabled = !!meals.dinner_disabled;

  return (
    <div className="day-card">
      <div className="day-context">
        <div className="date-large">{dayjs(day.date).format('DD')}</div>
        <div className="date-week">{weekdayLabel(day.date)}</div>

        <div className="city-box">
          {(isFirstDay || isLastDay) ? (
            <>
              <div className="city-label">出发城市</div>
              <input
                className="city-input"
                value={day.departure_city || ''}
                placeholder="输入城市..."
                onChange={(event) => handleUpdate({ departure_city: event.target.value })}
              />
              <div className="city-label">抵达城市</div>
              <input
                className="city-input"
                value={day.arrival_city || ''}
                placeholder="输入城市..."
                onChange={(event) => handleUpdate({ arrival_city: event.target.value })}
              />
            </>
          ) : (
            <>
              <div className="city-label">所在城市</div>
              <input
                className="city-input"
                value={day.city || ''}
                placeholder="输入城市..."
                onChange={(event) => handleUpdate({ city: event.target.value })}
              />
            </>
          )}
        </div>

        <div className="weather-box">
          <div className="weather-label">城市天气</div>
          {weatherCities.length === 0 && (
            <div className="weather-item">设置城市后显示</div>
          )}
          {weatherCities.map((city) => (
            <div className="weather-city" key={`${day.date}-${city.label}`}>
              <div className="weather-item">{city.label}：{city.value}</div>
              <div className="weather-item">温度：--</div>
              <div className="weather-item">湿度：--</div>
            </div>
          ))}
        </div>
      </div>

      <div className="day-form">
        <div className="day-form-header">
          <div className="day-form-title">资源配置</div>
          <div className="day-form-status">
            <span className="status-dot" />
            自动保存
          </div>
        </div>
        {isFirstDay && (
          <div className="transfer-section">
            <div className="transfer-title">接站信息</div>
            <div className="transfer-grid">
              <div className="input-group">
                <label className="label">接站时间</label>
                <input
                  className="input-box"
                  value={pickup.time || ''}
                  placeholder="例如 09:30"
                  onChange={(event) => handlePickupChange('time', event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">接站地点</label>
                <input
                  className="input-box"
                  value={pickup.location || ''}
                  placeholder="机场 / 车站 / 码头"
                  onChange={(event) => handlePickupChange('location', event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">接站负责人</label>
                <input
                  className="input-box"
                  value={pickup.contact || ''}
                  placeholder="负责人 / 电话"
                  onChange={(event) => handlePickupChange('contact', event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">航班号</label>
                <input
                  className="input-box"
                  value={pickup.flight_no || ''}
                  placeholder="例如 MU1234"
                  onChange={(event) => handlePickupChange('flight_no', event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">航司</label>
                <input
                  className="input-box"
                  value={pickup.airline || ''}
                  placeholder="例如 中国东航"
                  onChange={(event) => handlePickupChange('airline', event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">航站楼/登机口</label>
                <input
                  className="input-box"
                  value={pickup.terminal || ''}
                  placeholder="T2 / G18"
                  onChange={(event) => handlePickupChange('terminal', event.target.value)}
                />
              </div>
            </div>
          </div>
        )}
        <div className="form-grid">
          <div className="input-group">
            <label className="label">住宿酒店</label>
            <div className="multi-input">
              <input
                className="input-box input-main"
                value={day.hotel || ''}
                placeholder="输入酒店名称"
                onChange={(event) => handleUpdate({ hotel: event.target.value })}
                list={`${id}-hotel`}
              />
              <input
                className="input-box input-sub"
                value={day.hotel_address || ''}
                placeholder="酒店地址"
                onChange={(event) => handleUpdate({ hotel_address: event.target.value })}
              />
            </div>
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
            <div className="vehicle-stack">
              <div className="vehicle-row">
                <span className="vehicle-label">车牌</span>
                <input
                  className="input-box vehicle-input"
                  value={vehicle.plate || ''}
                  placeholder="车牌号"
                  onChange={(event) => handleVehicleChange('plate', event.target.value)}
                />
              </div>
              <div className="vehicle-row">
                <span className="vehicle-label">司机</span>
                <input
                  className="input-box vehicle-input"
                  value={vehicle.driver || vehicle.name || ''}
                  placeholder="司机姓名"
                  onChange={(event) => handleVehicleChange('driver', event.target.value)}
                  list={`${id}-vehicle`}
                />
              </div>
              <div className="vehicle-row">
                <span className="vehicle-label">电话</span>
                <input
                  className="input-box vehicle-input"
                  value={vehicle.phone || ''}
                  placeholder="联系电话"
                  onChange={(event) => handleVehicleChange('phone', event.target.value)}
                />
              </div>
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
                className="input-box input-main normal"
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
                className="input-box input-main normal"
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
          <div className={`meal-row ${breakfastDisabled ? 'is-disabled' : ''}`}>
            <div className="meal-label-box breakfast">早餐</div>
            <input
              className="meal-input meal-input-address"
              value={meals.breakfast_place || ''}
              placeholder={breakfastDisabled ? '已标记不安排' : '地址'}
              onChange={(event) => handleMealChange('breakfast_place', event.target.value)}
              disabled={breakfastDisabled}
            />
            <input
              className="meal-input meal-input-plan"
              value={meals.breakfast || ''}
              placeholder={breakfastDisabled ? '已标记不安排' : '早餐安排'}
              onChange={(event) => handleMealChange('breakfast', event.target.value)}
              list={`${id}-meal`}
              disabled={breakfastDisabled}
            />
            <button
              className={`meal-toggle ${breakfastDisabled ? 'is-off' : ''}`}
              type="button"
              onClick={() => handleMealToggle('breakfast')}
            >
              {breakfastDisabled ? '未安排' : '不安排'}
            </button>
          </div>
          <div className={`meal-row ${lunchDisabled ? 'is-disabled' : ''}`}>
            <div className="meal-label-box lunch">午餐</div>
            <input
              className="meal-input meal-input-address"
              value={meals.lunch_place || ''}
              placeholder={lunchDisabled ? '已标记不安排' : '地址'}
              onChange={(event) => handleMealChange('lunch_place', event.target.value)}
              disabled={lunchDisabled}
            />
            <input
              className="meal-input meal-input-plan"
              value={meals.lunch || ''}
              placeholder={lunchDisabled ? '已标记不安排' : '午餐安排'}
              onChange={(event) => handleMealChange('lunch', event.target.value)}
              list={`${id}-meal`}
              disabled={lunchDisabled}
            />
            <button
              className={`meal-toggle ${lunchDisabled ? 'is-off' : ''}`}
              type="button"
              onClick={() => handleMealToggle('lunch')}
            >
              {lunchDisabled ? '未安排' : '不安排'}
            </button>
          </div>
          <div className={`meal-row ${dinnerDisabled ? 'is-disabled' : ''}`}>
            <div className="meal-label-box dinner">晚餐</div>
            <input
              className="meal-input meal-input-address"
              value={meals.dinner_place || ''}
              placeholder={dinnerDisabled ? '已标记不安排' : '地址'}
              onChange={(event) => handleMealChange('dinner_place', event.target.value)}
              disabled={dinnerDisabled}
            />
            <input
              className="meal-input meal-input-plan"
              value={meals.dinner || ''}
              placeholder={dinnerDisabled ? '已标记不安排' : '晚餐安排'}
              onChange={(event) => handleMealChange('dinner', event.target.value)}
              list={`${id}-meal`}
              disabled={dinnerDisabled}
            />
            <button
              className={`meal-toggle ${dinnerDisabled ? 'is-off' : ''}`}
              type="button"
              onClick={() => handleMealToggle('dinner')}
            >
              {dinnerDisabled ? '未安排' : '不安排'}
            </button>
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

        {isLastDay && (
          <div className="transfer-section">
            <div className="transfer-title">送站信息</div>
            <div className="transfer-grid">
              <div className="input-group">
                <label className="label">送站时间</label>
                <input
                  className="input-box"
                  value={dropoff.time || ''}
                  placeholder="例如 18:00"
                  onChange={(event) => handleDropoffChange('time', event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">送站地点</label>
                <input
                  className="input-box"
                  value={dropoff.location || ''}
                  placeholder="机场 / 车站 / 码头"
                  onChange={(event) => handleDropoffChange('location', event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">送站负责人</label>
                <input
                  className="input-box"
                  value={dropoff.contact || ''}
                  placeholder="负责人 / 电话"
                  onChange={(event) => handleDropoffChange('contact', event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">航班号</label>
                <input
                  className="input-box"
                  value={dropoff.flight_no || ''}
                  placeholder="例如 CZ5678"
                  onChange={(event) => handleDropoffChange('flight_no', event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">航司</label>
                <input
                  className="input-box"
                  value={dropoff.airline || ''}
                  placeholder="例如 南方航空"
                  onChange={(event) => handleDropoffChange('airline', event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="label">航站楼/登机口</label>
                <input
                  className="input-box"
                  value={dropoff.terminal || ''}
                  placeholder="T2 / G18"
                  onChange={(event) => handleDropoffChange('terminal', event.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="day-summary">
        <div className="summary-action">
          <button
            className="btn-link copy-btn"
            type="button"
            disabled={index === 0}
            onClick={() => onCopyPrevDay?.(index)}
          >
            复制上一日
          </button>
        </div>
        <div className="summary-card">
          <div className="summary-title">当日行程摘要</div>
          <div className="summary-slot">
            <div className="summary-slot-label">上午</div>
            <div className="summary-slot-list">
              {morningItems.map((item, idx) => (
                <div className="summary-slot-main" key={`${day.date}-morning-${idx}`}>
                  {item}
                </div>
              ))}
            </div>
            {groupSize > 0 && <div className="summary-slot-sub">{groupSize}人</div>}
          </div>
          <div className="summary-slot">
            <div className="summary-slot-label">下午</div>
            <div className="summary-slot-list">
              {afternoonItems.map((item, idx) => (
                <div className="summary-slot-main" key={`${day.date}-afternoon-${idx}`}>
                  {item}
                </div>
              ))}
            </div>
            {groupSize > 0 && <div className="summary-slot-sub">{groupSize}人</div>}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-title">录入状态</div>
          <div className="summary-status-item">
            <span>住宿酒店</span>
            <span className={`summary-status ${statusClassName(hotelStatus)}`}>{hotelStatus}</span>
          </div>
          <div className="summary-status-item">
            <span>车辆调度</span>
            <span className={`summary-status ${statusClassName(vehicleStatus)}`}>{vehicleStatus}</span>
          </div>
          <div className="summary-status-item">
            <span>随团导游</span>
            <span className={`summary-status ${statusClassName(guideStatus)}`}>{guideStatus}</span>
          </div>
          <div className="summary-status-item">
            <span>安保人员</span>
            <span className={`summary-status ${statusClassName(securityStatus)}`}>{securityStatus}</span>
          </div>
          <div className="summary-status-item">
            <span>餐饮安排</span>
            <span className={`summary-status ${statusClassName(mealStatus)}`}>{mealStatus}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayLogisticsCard;



