import React from 'react';

const EventChip = ({
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
  const resolveSource = () => {
    const resourceId = activity?.resourceId ?? activity?.resource_id ?? '';
    if (typeof resourceId === 'string') {
      if (resourceId.startsWith('plan-')) {
        return { tag: '必去', title: '必去行程点', className: 'source-plan' };
      }
      if (resourceId.startsWith('plan-sync-')) {
        return { tag: '必去', title: '必去行程点', className: 'source-plan' };
      }
      if (resourceId.startsWith('daily:')) {
        return { tag: '每日', title: '每日卡片', className: 'source-daily' };
      }
    }
    if (activity?.planItemId) {
      return { tag: '必去', title: '必去行程点', className: 'source-plan' };
    }
    return { tag: '其他', title: '其他', className: 'source-custom' };
  };

  const sourceMeta = resolveSource();

  const titleText = activity?.title || activity?.location || '未命名';
  const locationText = (() => {
    const loc = activity?.location || '';
    if (!loc) return '';
    if (loc === titleText) return '';
    return loc;
  })();

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

  return (
    <div
      className={`calendar-activity ${activity.type} ${isDragged ? 'dragging' : ''}`}
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
      <div className={`activity-corner-tag ${sourceMeta.className}`}>
        {sourceMeta.tag}
      </div>
      <div className="activity-content simple-activity">
        <div className="activity-time">
          {activity.startTime}-{activity.endTime}
        </div>
        <div className="activity-title">{titleText}</div>
        {locationText ? (
          <div className="activity-location">{locationText}</div>
        ) : null}
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

export default EventChip;

