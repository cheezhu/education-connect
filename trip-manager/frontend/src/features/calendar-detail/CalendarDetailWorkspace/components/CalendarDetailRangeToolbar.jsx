import React from 'react';
import Button from 'antd/es/button';
import DatePicker from 'antd/es/date-picker';

const CalendarDetailRangeToolbar = ({
  visible,
  atWindowStart,
  atWindowEnd,
  windowStartLabel,
  windowEndLabel,
  windowStartIndex,
  visibleDaysCount,
  totalDays,
  onJumpPrevChunk,
  onJumpPrevDay,
  onJumpNextDay,
  onJumpNextChunk,
  disableJumpDate,
  onPickDate
}) => {
  if (!visible) return null;

  return (
    <div className="calendar-range-toolbar">
      <div className="calendar-range-actions">
        <Button size="small" onClick={onJumpPrevChunk} disabled={atWindowStart}>
          上一段
        </Button>
        <Button size="small" onClick={onJumpPrevDay} disabled={atWindowStart}>
          上一天
        </Button>
      </div>

      <div className="calendar-range-center" title={`${windowStartLabel} ~ ${windowEndLabel}`}>
        <div className="calendar-range-title">
          {windowStartLabel} ~ {windowEndLabel}
        </div>
        <div className="calendar-range-subtitle">
          第 {windowStartIndex + 1}-{windowStartIndex + visibleDaysCount} 天 / 共 {totalDays} 天
        </div>
      </div>

      <div className="calendar-range-actions">
        <Button size="small" onClick={onJumpNextDay} disabled={atWindowEnd}>
          下一天
        </Button>
        <Button size="small" onClick={onJumpNextChunk} disabled={atWindowEnd}>
          下一段
        </Button>
        <DatePicker
          size="small"
          allowClear
          placeholder="跳转日期"
          disabledDate={disableJumpDate}
          onChange={(value) => {
            if (!value) return;
            onPickDate?.(value.format('YYYY-MM-DD'));
          }}
          style={{ width: 120 }}
        />
      </div>
    </div>
  );
};

export default CalendarDetailRangeToolbar;
