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
        return { label: '行程点', className: 'source-plan' };
      }
      if (resourceId.startsWith('daily:')) {
        return { label: '每日卡片', className: 'source-daily' };
      }
    }
    return { label: '自定义', className: 'source-custom' };
  };

  const sourceMeta = resolveSource();

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
      title="右键编辑活动"
    >
      <div className="activity-content simple-activity">
        <div className="activity-time">
          {activity.startTime}-{activity.endTime}
        </div>
        <div className="activity-title">{activity.location || activity.title || '未命名'}</div>
        <div className="activity-meta">
          <span className={`activity-source-badge ${sourceMeta.className}`}>
            数据来源：{sourceMeta.label}
          </span>
        </div>
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

