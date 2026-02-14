import React from 'react';

import { resolveSourceMeta } from '../../../../domain/resourceSource';

const LEGACY_MEAL_TITLES = new Set(['早餐', '午餐', '晚餐', '早饭', '午饭', '晚饭']);

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
  const rawDescription = (activity?.description || '').trim();

  // Keep line-2 aligned with popover title: always prefer `title`, fallback to type label.
  const titleText = (
    activity?.type === 'meal'
    && rawDescription
    && (!rawTitle || LEGACY_MEAL_TITLES.has(rawTitle))
  )
    ? rawDescription
    : (rawTitle || typeLabel(activity?.type));
  const locationText = rawLocation && rawLocation !== titleText ? rawLocation : '';

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
