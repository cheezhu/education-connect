import React, { useId } from 'react';
import dayjs from 'dayjs';

const weekdayLabel = (dateStr) => {
  if (!dateStr) return '';
  return dayjs(dateStr).format('ddd / MMM');
};

const resolveEventTitle = (event) => {
  return event?.title || event?.location || event?.description || '未命名活动';
};

const toPlainText = (value) => {
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

const formatWeatherTime = (value) => {
  if (!value) return '';
  const parsed = dayjs(value);
  if (!parsed.isValid()) return value;
  return parsed.format('MM-DD HH:mm');
};

const downloadJson = (filename, payload) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
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
  isLastDay = false,
  weatherData
}) => {
  const id = useId();
  const meals = day.meals || {};
  const vehicle = day.vehicle || {};
  const guide = day.guide || {};
  const security = day.security || {};
  const vehicleDriver = toPlainText(vehicle.driver || vehicle.name);
  const guideName = toPlainText(guide.name);
  const securityName = toPlainText(security.name);
  const hotelDisabled = !!day.hotel_disabled;
  const vehicleDisabled = !!day.vehicle_disabled;
  const guideDisabled = !!day.guide_disabled;
  const securityDisabled = !!day.security_disabled;
  const weatherCities = [];
  if (day.departure_city) weatherCities.push({ label: '出发城市', value: day.departure_city });
  if (day.arrival_city) weatherCities.push({ label: '抵达城市', value: day.arrival_city });
  if (weatherCities.length === 0 && day.city) weatherCities.push({ label: '所在城市', value: day.city });
  const hkoCurrent = weatherData?.current;
  const hkoForecast = weatherData?.forecast;
  const hkoStatus = hkoCurrent?.status;
  const hkoData = hkoCurrent?.data;
  const hkoTemp = hkoData?.temperature;
  const hkoHumidity = hkoData?.humidity;
  const hkoRainfall = hkoData?.rainfall;
  const hkoUpdate = formatWeatherTime(hkoData?.updateTime);
  const hkoWarning = toPlainText(hkoData?.warningMessage);
  const forecastList = Array.isArray(hkoForecast?.list) ? hkoForecast.list : [];
  const forecastForDay = forecastList.find((item) => item.date === day.date);
  const hasForecast = !!forecastForDay;
  const forecastUpdate = formatWeatherTime(hkoForecast?.updateTime);
  const todayStr = dayjs().format('YYYY-MM-DD');
  const isToday = day.date === todayStr;
  const hasHkoData = !!(hkoData && (hkoTemp?.value !== undefined || hkoHumidity?.value !== undefined));
  const itineraryItems = scheduleItems.filter(isItineraryItem);
  const scheduleBuckets = splitScheduleItems(itineraryItems);
  const morningItems = buildSlotList(scheduleBuckets.morning);
  const afternoonItems = buildSlotList(scheduleBuckets.afternoon);

  const hotelStatus = hotelDisabled || day.hotel ? '已填' : '未填';
  const vehicleStatus = vehicleDisabled || vehicle.plate || vehicleDriver || vehicle.phone ? '已填' : '未填';
  const guideStatus = guideDisabled || guideName || guide.phone ? '已填' : '未填';
  const securityStatus = securityDisabled || securityName || security.phone ? '已填' : '未填';
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
      updates[`${field}_time`] = '';
      updates[`${field}_end`] = '';
      updates[`${field}_detached`] = false;
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

  const handleHotelToggle = () => {
    const nextDisabled = !hotelDisabled;
    handleUpdate({
      hotel_disabled: nextDisabled,
      hotel: nextDisabled ? '' : day.hotel,
      hotel_address: nextDisabled ? '' : day.hotel_address
    });
  };

  const handleVehicleToggle = () => {
    const nextDisabled = !vehicleDisabled;
    handleUpdate({
      vehicle_disabled: nextDisabled,
      vehicle: nextDisabled ? { driver: '', plate: '', phone: '' } : vehicle
    });
  };

  const handleGuideToggle = () => {
    const nextDisabled = !guideDisabled;
    handleUpdate({
      guide_disabled: nextDisabled,
      guide: nextDisabled ? { name: '', phone: '' } : guide
    });
  };

  const handleSecurityToggle = () => {
    const nextDisabled = !securityDisabled;
    handleUpdate({
      security_disabled: nextDisabled,
      security: nextDisabled ? { name: '', phone: '' } : security
    });
  };

  const breakfastDisabled = !!meals.breakfast_disabled;
  const lunchDisabled = !!meals.lunch_disabled;
  const dinnerDisabled = !!meals.dinner_disabled;

  const handleDownloadWeather = () => {
    const filename = `hko-weather-${day.date}.json`;

    if (isToday && hkoData) {
      const payload = {
        date: day.date,
        source: 'HKO rhrread',
        temperature: hkoTemp,
        humidity: hkoHumidity,
        rainfall: hkoRainfall,
        warning: hkoWarning || '',
        wind: forecastForDay?.wind || '',
        forecast: forecastForDay
          ? {
              weather: forecastForDay.weather,
              minTemp: forecastForDay.minTemp,
              maxTemp: forecastForDay.maxTemp,
              minRh: forecastForDay.minRh,
              maxRh: forecastForDay.maxRh
            }
          : null,
        updateTime: hkoUpdate,
        forecastUpdateTime: hkoForecast?.updateTime || ''
      };
      downloadJson(filename, payload);
      return;
    }

    if (hasForecast) {
      const payload = {
        date: day.date,
        source: 'HKO fnd',
        temperature: {
          min: forecastForDay.minTemp,
          max: forecastForDay.maxTemp,
          unit: 'C'
        },
        humidity: {
          min: forecastForDay.minRh,
          max: forecastForDay.maxRh,
          unit: 'percent'
        },
        rainfall: null,
        warning: '',
        wind: forecastForDay.wind || '',
        weather: forecastForDay.weather || '',
        updateTime: hkoForecast?.updateTime || ''
      };
      downloadJson(filename, payload);
      return;
    }

    window.alert('该日期暂无香港天文台数据可下载');
  };

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
          <div className="weather-header">
            <div className="weather-label">香港天文台</div>
            <button
              className="btn-link weather-download"
              type="button"
              onClick={handleDownloadWeather}
            >
              下载天气
            </button>
          </div>
          {isToday && !hasHkoData && hkoStatus !== 'error' && (
            <div className="weather-item">加载中...</div>
          )}
          {isToday && hkoStatus === 'error' && (
            <div className="weather-item">暂无法获取</div>
          )}
          {isToday && hasHkoData && (
            <>
              <div className="weather-item">
                气温：{hkoTemp?.value ?? '--'}{hkoTemp?.unit || ''}
              </div>
              <div className="weather-item">
                湿度：{hkoHumidity?.value ?? '--'}{hkoHumidity?.unit || ''}
              </div>
              {hkoRainfall && (
                <div className="weather-item">
                  降雨：{hkoRainfall.value ?? '--'}{hkoRainfall.unit || ''}
                </div>
              )}
              {hkoUpdate && (
                <div className="weather-item">更新：{hkoUpdate}</div>
              )}
              {hkoWarning && (
                <div className="weather-item weather-warn">提示：{hkoWarning}</div>
              )}
            </>
          )}
          {!isToday && hasForecast && (
            <>
              {forecastForDay.weather && (
                <div className="weather-item">预报：{forecastForDay.weather}</div>
              )}
              <div className="weather-item">
                温度：{forecastForDay.minTemp ?? '--'}-{forecastForDay.maxTemp ?? '--'}C
              </div>
              <div className="weather-item">
                湿度：{forecastForDay.minRh ?? '--'}-{forecastForDay.maxRh ?? '--'}%
              </div>
              {forecastForDay.wind && (
                <div className="weather-item">风：{forecastForDay.wind}</div>
              )}
              {forecastUpdate && (
                <div className="weather-item">更新：{forecastUpdate}</div>
              )}
            </>
          )}
          {!isToday && !hasForecast && (
            <div className="weather-item">暂无预报</div>
          )}
          {weatherCities.length > 0 && (
            <div className="weather-city">
              {weatherCities.map((city) => (
                <div className="weather-item" key={`${day.date}-${city.label}`}>
                  {city.label}：{city.value}
                </div>
              ))}
            </div>
          )}
          {weatherCities.length === 0 && !hasHkoData && !hasForecast && (
            <div className="weather-item">设置城市后显示</div>
          )}
        </div>

        <div className="context-footer">
          <button
            className="btn-link context-copy-btn"
            type="button"
            disabled={index === 0}
            onClick={() => onCopyPrevDay?.(index)}
          >
            复制上一日出行安排
          </button>
        </div>
      </div>

      <div className="day-form">
        <div className="form-grid">
          <div className={`input-group ${hotelDisabled ? 'is-disabled' : ''}`}>
            <div className="section-header">
              <label className="label">住宿酒店</label>
              <button
                className={`section-toggle ${hotelDisabled ? 'is-off' : ''}`}
                type="button"
                onClick={handleHotelToggle}
              >
                {hotelDisabled ? '未安排' : '不安排'}
              </button>
            </div>
            <div className="multi-input">
              <input
                className="input-box input-main"
                value={day.hotel || ''}
                placeholder={hotelDisabled ? '已标记不安排' : '输入酒店名称'}
                onChange={(event) => handleUpdate({ hotel: event.target.value })}
                list={`${id}-hotel`}
                disabled={hotelDisabled}
              />
              <input
                className="input-box input-sub"
                value={day.hotel_address || ''}
                placeholder={hotelDisabled ? '已标记不安排' : '酒店地址'}
                onChange={(event) => handleUpdate({ hotel_address: event.target.value })}
                disabled={hotelDisabled}
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
          <div className={`input-group ${vehicleDisabled ? 'is-disabled' : ''}`}>
            <div className="section-header">
              <label className="label">车辆调度</label>
              <button
                className={`section-toggle ${vehicleDisabled ? 'is-off' : ''}`}
                type="button"
                onClick={handleVehicleToggle}
              >
                {vehicleDisabled ? '未安排' : '不安排'}
              </button>
            </div>
            <div className="vehicle-stack">
              <div className="vehicle-row">
                <input
                  className="input-box vehicle-input"
                  value={vehicle.plate || ''}
                  placeholder={vehicleDisabled ? '已标记不安排' : '车牌号'}
                  onChange={(event) => handleVehicleChange('plate', event.target.value)}
                  disabled={vehicleDisabled}
                />
              </div>
              <div className="vehicle-row">
                <input
                  className="input-box vehicle-input"
                  value={vehicleDriver}
                  placeholder={vehicleDisabled ? '已标记不安排' : '司机姓名'}
                  onChange={(event) => handleVehicleChange('driver', event.target.value)}
                  list={`${id}-vehicle`}
                  disabled={vehicleDisabled}
                />
              </div>
              <div className="vehicle-row">
                <input
                  className="input-box vehicle-input"
                  value={vehicle.phone || ''}
                  placeholder={vehicleDisabled ? '已标记不安排' : '联系电话'}
                  onChange={(event) => handleVehicleChange('phone', event.target.value)}
                  disabled={vehicleDisabled}
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
          <div className={`input-group ${guideDisabled ? 'is-disabled' : ''}`}>
            <div className="section-header">
              <label className="label">随团导游</label>
              <button
                className={`section-toggle ${guideDisabled ? 'is-off' : ''}`}
                type="button"
                onClick={handleGuideToggle}
              >
                {guideDisabled ? '未安排' : '不安排'}
              </button>
            </div>
            <div className="multi-input">
              <input
                className="input-box input-main normal"
                  value={guideName}
                  placeholder={guideDisabled ? '已标记不安排' : '导游姓名'}
                  onChange={(event) => handleGuideChange('name', event.target.value)}
                  list={`${id}-guide`}
                  disabled={guideDisabled}
              />
              <input
                className="input-box input-sub"
                value={guide.phone || ''}
                placeholder={guideDisabled ? '已标记不安排' : '联系电话'}
                onChange={(event) => handleGuideChange('phone', event.target.value)}
                disabled={guideDisabled}
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
          <div className={`input-group ${securityDisabled ? 'is-disabled' : ''}`}>
            <div className="section-header">
              <label className="label">安保人员</label>
              <button
                className={`section-toggle ${securityDisabled ? 'is-off' : ''}`}
                type="button"
                onClick={handleSecurityToggle}
              >
                {securityDisabled ? '未安排' : '不安排'}
              </button>
            </div>
            <div className="multi-input">
              <input
                className="input-box input-main normal"
                  value={securityName}
                  placeholder={securityDisabled ? '已标记不安排' : '安保姓名'}
                  onChange={(event) => handleSecurityChange('name', event.target.value)}
                  list={`${id}-security`}
                  disabled={securityDisabled}
              />
              <input
                className="input-box input-sub"
                value={security.phone || ''}
                placeholder={securityDisabled ? '已标记不安排' : '联系电话'}
                onChange={(event) => handleSecurityChange('phone', event.target.value)}
                disabled={securityDisabled}
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
              className="meal-input meal-input-plan"
              value={meals.breakfast || ''}
              placeholder={breakfastDisabled ? '已标记不安排' : '早餐餐厅名'}
              onChange={(event) => handleMealChange('breakfast', event.target.value)}
              list={`${id}-meal`}
              disabled={breakfastDisabled}
            />
            <input
              className="meal-input meal-input-address"
              value={meals.breakfast_place || ''}
              placeholder={breakfastDisabled ? '已标记不安排' : '地址'}
              onChange={(event) => handleMealChange('breakfast_place', event.target.value)}
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
              className="meal-input meal-input-plan"
              value={meals.lunch || ''}
              placeholder={lunchDisabled ? '已标记不安排' : '午餐餐厅名'}
              onChange={(event) => handleMealChange('lunch', event.target.value)}
              list={`${id}-meal`}
              disabled={lunchDisabled}
            />
            <input
              className="meal-input meal-input-address"
              value={meals.lunch_place || ''}
              placeholder={lunchDisabled ? '已标记不安排' : '地址'}
              onChange={(event) => handleMealChange('lunch_place', event.target.value)}
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
              className="meal-input meal-input-plan"
              value={meals.dinner || ''}
              placeholder={dinnerDisabled ? '已标记不安排' : '晚餐餐厅名'}
              onChange={(event) => handleMealChange('dinner', event.target.value)}
              list={`${id}-meal`}
              disabled={dinnerDisabled}
            />
            <input
              className="meal-input meal-input-address"
              value={meals.dinner_place || ''}
              placeholder={dinnerDisabled ? '已标记不安排' : '地址'}
              onChange={(event) => handleMealChange('dinner_place', event.target.value)}
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

      </div>

      <div className="day-summary">
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
            <span>餐厅名</span>
            <span className={`summary-status ${statusClassName(mealStatus)}`}>{mealStatus}</span>
          </div>
        </div>

        <div className="summary-save">
          <span className="status-dot" />
          自动保存
        </div>
      </div>
    </div>
  );
};

export default React.memo(DayLogisticsCard);



