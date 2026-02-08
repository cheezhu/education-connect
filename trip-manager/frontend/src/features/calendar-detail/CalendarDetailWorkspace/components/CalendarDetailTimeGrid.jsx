import React from 'react';

const CalendarDetailTimeGrid = ({
  days,
  timeSlots,
  slotHeight,
  slotsPerHour,
  activities,
  onSlotClick,
  onSlotDrop,
  onSlotDragOver,
  onSlotDragEnter,
  onSlotDragLeave,
  renderActivity,
  dropIndicator,
  isDragging
}) => {
  if (!Array.isArray(days) || !Array.isArray(timeSlots)) return null;

  const handleGridClick = (event) => {
    if (!onSlotClick) return;
    if (event.target.closest('.calendar-activity')) return;
    if (event.target.classList.contains('time-slot')) return;
    if (event.target.classList.contains('date-header-compact')) return;
    if (event.target.classList.contains('time-label')) return;
    if (!days.length || !timeSlots.length) return;

    const gridRect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - gridRect.left;
    const y = event.clientY - gridRect.top;
    const timeColumnWidth = 60;
    const headerHeight = 30;
    if (x < timeColumnWidth || y < headerHeight) return;

    const dayWidth = (gridRect.width - timeColumnWidth) / days.length;
    const dayIndex = Math.floor((x - timeColumnWidth) / dayWidth);
    const slotIndex = Math.floor((y - headerHeight) / slotHeight);
    const day = days[dayIndex];
    const time = timeSlots[slotIndex];
    if (!day || !time) return;

    const anchorRect = {
      top: event.clientY,
      bottom: event.clientY,
      left: event.clientX,
      right: event.clientX
    };
    onSlotClick(day.dateStr, time, anchorRect);
  };

  return (
    <div
      className={`calendar-grid ${isDragging ? 'dragging-active' : ''}`}
      style={{
        // Use a min width per day so long trips don't compress into unreadable columns.
        // The scroll wrapper will provide horizontal scrolling when needed.
        gridTemplateColumns: `60px repeat(${days.length}, minmax(140px, 1fr))`,
        gridTemplateRows: `30px repeat(${timeSlots.length}, ${slotHeight}px)`
      }}
      onClick={handleGridClick}
    >
      <div className="corner-cell-compact">时间</div>

      {days.map((day, dayIndex) => (
        <div
          key={day.dateStr}
          className={`date-header-compact ${day.isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''}`}
          style={{
            gridColumn: dayIndex + 2,
            gridRow: 1
          }}
          title={`${day.month}月${day.day}日 ${day.dayNameFull}`}
        >
          <div className="date-single-line">
            {day.month}/{day.day}<span className="weekday-inline">{day.dayName}</span>
          </div>
          {day.isToday && <div className="today-badge">今</div>}
        </div>
      ))}

      {timeSlots.map((time, timeIndex) => {
        const isHourSlot = time.endsWith(':00');
        const rowStart = timeIndex + 2;
        const rowEnd = Math.min(rowStart + slotsPerHour, timeSlots.length + 2);

        return (
          <React.Fragment key={time}>
            {isHourSlot ? (
              <div
                className="time-label hour-label"
                style={{
                  gridColumn: 1,
                  gridRow: `${rowStart} / ${rowEnd}`
                }}
              >
                {time}
              </div>
            ) : null}

            {days.map((day, dayIndex) => (
              <div
                key={`${day.dateStr}-${time}`}
                className={`time-slot ${time.endsWith(':00') ? 'hour-slot' : ''}`}
                data-date={day.dateStr}
                data-time={time}
                onClick={(event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  onSlotClick?.(day.dateStr, time, rect);
                }}
                onDrop={(event) => onSlotDrop?.(event, day.dateStr, time)}
                onDragOver={onSlotDragOver}
                onDragEnter={onSlotDragEnter}
                onDragLeave={onSlotDragLeave}
                style={{
                  gridColumn: dayIndex + 2,
                  gridRow: timeIndex + 2,
                  height: `${slotHeight}px`
                }}
              />
            ))}
          </React.Fragment>
        );
      })}

      {activities.map((activity) => {
        const dayIndex = days.findIndex((day) => day.dateStr === activity.date);
        if (dayIndex === -1) return null;
        return renderActivity?.(activity, dayIndex);
      })}

      {dropIndicator && isDragging && (
        <div
          className="drop-indicator"
          style={{
            gridColumn: dropIndicator.dayIndex + 2,
            gridRow: `${dropIndicator.slotIndex + 2} / ${dropIndicator.slotIndex + 2 + dropIndicator.duration}`,
            backgroundColor: 'rgba(24, 144, 255, 0.2)',
            border: '2px dashed #1890ff',
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: 15
          }}
        >
          <div style={{
            padding: '4px 8px',
            fontSize: '12px',
            color: '#1890ff',
            fontWeight: 'bold'
          }}>
            {dropIndicator.time}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarDetailTimeGrid;

