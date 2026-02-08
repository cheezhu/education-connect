import React from 'react';

import { resolveSourceMeta } from '../../../../domain/resourceSource';

const typeLabel = (type) => {
  switch (type) {
    case 'visit':
      return '参观';
    case 'meal':
      return '用餐';
    case 'transport':
      return '交通';
    case 'rest':
      return '休息';
    case 'activity':
      return '活动';
    case 'free':
      return '自由';
    default:
      return '活动';
  }
};

const CalendarDetailEventChip = ({
  activity,
  style,
  isDragged,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onClick,
  onContextMenu,
  onResizeStart,
  isResizing
}) => {
  const sourceMeta = resolveSourceMeta(activity);

  const rawTitle = (activity?.title || '').trim();
  const rawLocation = (activity?.location || '').trim();

  // If title is missing or equals location, show a "name" line as type label.
  // This avoids the "grid only shows location" feeling.
  const titleText = (() => {
    if (rawTitle && rawTitle !== rawLocation) return rawTitle;
    if (rawTitle && !rawLocation) return rawTitle;
    return typeLabel(activity?.type);
  })();

  const locationText = rawLocation || (rawTitle && rawTitle !== titleText ? rawTitle : '');

  const handleClick = (event) => {
    if (onClick) {
      onClick(event, activity, event.currentTarget.getBoundingClientRect());
    }
  };

  const handleContextMenu = (event) => {
    if (onContextMenu) {
      onContextMenu(event, activity, event.currentTarget.getBoundingClientRect());
    }
  };

  const tagText = String(sourceMeta?.tag || '').slice(0, 2);
  const chipType = activity?.type || 'activity';

  return (
    <div
      className={`calendar-activity ${chipType} ${isDragged ? 'dragging' : ''}`}
      style={style}
      draggable
      onDragStart={(event) => onDragStart?.(event, activity)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver?.(event, activity)}
      onDrop={(event) => onDrop?.(event, activity)}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={`${sourceMeta.title} | 右键编辑活动`}
    >
      <div className={`activity-corner-tag ${sourceMeta.className}`}>{tagText}</div>

      <div className="activity-content simple-activity">
        <div className="activity-time">
          {activity.startTime}-{activity.endTime}
        </div>
        <div className="activity-title">{titleText || '未命名'}</div>
        {locationText ? <div className="activity-location">{locationText}</div> : null}
      </div>

      <div
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={(event) => onResizeStart?.(event, activity)}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
        title="拖拽调整活动时长"
      />
    </div>
  );
};

export default CalendarDetailEventChip;

