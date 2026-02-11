import React from 'react';
import dayjs from 'dayjs';
import DayLogisticsCard from './DayLogisticsCard';

const EMPTY_SCHEDULE_ITEMS = [];

const TransferStrip = ({ type, day, onUpdateDay }) => {
  const isPickup = type === 'pickup';
  const transfer = isPickup ? (day.pickup || {}) : (day.dropoff || {});
  const disabled = !!transfer.disabled;
  const label = isPickup ? '接站' : '送站';
  const title = isPickup ? '接站信息' : '送站信息';

  const handleChange = (field, value) => {
    onUpdateDay?.(day.date, {
      [type]: { ...transfer, [field]: value }
    });
  };

  const handleToggle = () => {
    const nextDisabled = !disabled;
    onUpdateDay?.(day.date, {
      [type]: nextDisabled
        ? {
            time: '',
            end_time: '',
            location: '',
            contact: '',
            flight_no: '',
            airline: '',
            terminal: '',
            detached: false,
            disabled: true
          }
        : { ...transfer, disabled: false }
    });
  };

  return (
    <div className={`transfer-strip ${type}`}>
      <div className="transfer-context">
        <div className="transfer-tag">{label}</div>
        <div className="transfer-date">{dayjs(day.date).format('DD')}</div>
        <div className="transfer-week">{dayjs(day.date).format('ddd / MMM')}</div>
      </div>
      <div className={`transfer-body ${disabled ? 'is-disabled' : ''}`}>
        <div className="section-header">
          <div className="transfer-title">{title}</div>
          <button
            className={`section-toggle ${disabled ? 'is-off' : ''}`}
            type="button"
            onClick={handleToggle}
          >
            {disabled ? '未安排' : '不安排'}
          </button>
        </div>
        <div className="transfer-grid">
          <div className="input-group">
            <label className="label">时间</label>
            <input
              className="input-box"
              value={transfer.time || ''}
              placeholder={disabled ? '已标记不安排' : '例如 09:30'}
              onChange={(event) => handleChange('time', event.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="input-group">
            <label className="label">结束时间</label>
            <input
              className="input-box"
              value={transfer.end_time || ''}
              placeholder={disabled ? '已标记不安排' : '例如 10:30'}
              onChange={(event) => handleChange('end_time', event.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="input-group">
            <label className="label">地点</label>
            <input
              className="input-box"
              value={transfer.location || ''}
              placeholder={disabled ? '已标记不安排' : '机场 / 车站 / 码头'}
              onChange={(event) => handleChange('location', event.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="input-group">
            <label className="label">负责人</label>
            <input
              className="input-box"
              value={transfer.contact || ''}
              placeholder={disabled ? '已标记不安排' : '负责人 / 电话'}
              onChange={(event) => handleChange('contact', event.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="input-group">
            <label className="label">航班/车次</label>
            <input
              className="input-box"
              value={transfer.flight_no || ''}
              placeholder={disabled ? '已标记不安排' : '例如 MU1234'}
              onChange={(event) => handleChange('flight_no', event.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="input-group">
            <label className="label">航司/公司</label>
            <input
              className="input-box"
              value={transfer.airline || ''}
              placeholder={disabled ? '已标记不安排' : '例如 中国东航'}
              onChange={(event) => handleChange('airline', event.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="input-group">
            <label className="label">航站楼/站台</label>
            <input
              className="input-box"
              value={transfer.terminal || ''}
              placeholder={disabled ? '已标记不安排' : 'T2 / G18'}
              onChange={(event) => handleChange('terminal', event.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const LogisticsMatrix = ({
  rows = [],
  scheduleMap,
  onUpdateDay,
  onCopyPrevDay,
  onFocusCapture,
  onBlurCapture,
  onCompositionStartCapture,
  onCompositionEndCapture,
  hotelOptions,
  vehicleOptions,
  guideOptions,
  securityOptions,
  mealOptions,
  groupSize = 0,
  weatherData
}) => {
  if (!rows.length) {
    return <div className="empty-state">暂无资源安排</div>;
  }

  return (
    <div
      className="logistics-list"
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
      onCompositionStartCapture={onCompositionStartCapture}
      onCompositionEndCapture={onCompositionEndCapture}
    >
      {rows.map((day, index) => (
        <React.Fragment key={day.date}>
          {index === 0 && (
            <TransferStrip type="pickup" day={day} onUpdateDay={onUpdateDay} />
          )}
          <DayLogisticsCard
            index={index}
            day={day}
            scheduleItems={scheduleMap?.get(day.date) || EMPTY_SCHEDULE_ITEMS}
            onUpdateDay={onUpdateDay}
            onCopyPrevDay={onCopyPrevDay}
            hotelOptions={hotelOptions}
            vehicleOptions={vehicleOptions}
            guideOptions={guideOptions}
            securityOptions={securityOptions}
            mealOptions={mealOptions}
            groupSize={groupSize}
            weatherData={weatherData}
            isFirstDay={index === 0}
            isLastDay={index === rows.length - 1}
          />
          {index === rows.length - 1 && (
            <TransferStrip type="dropoff" day={day} onUpdateDay={onUpdateDay} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default LogisticsMatrix;



