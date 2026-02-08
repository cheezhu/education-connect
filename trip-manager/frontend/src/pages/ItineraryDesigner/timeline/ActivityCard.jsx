import React from 'react';

function ActivityCard({
  activity,
  group,
  location,
  compact = false,
  cardStyle = 'minimal',
  isArrivalDay = false,
  isDepartureDay = false,
  onOpenEdit,
  onDelete
}) {
  const dayMarkers = [];
  if (isArrivalDay) dayMarkers.push('arrival');
  if (isDepartureDay) dayMarkers.push('departure');

  const activityNote = activity?.notes ? String(activity.notes).trim() : '';
  const activityDetail = location?.name || activityNote;

  const renderDayMarkers = () => (
    dayMarkers.length ? (
      <div className="activity-day-marker">
        {dayMarkers.map((marker) => (
          <span
            key={`${activity.id}-${marker}`}
            className={`activity-day-marker-dot ${marker}`}
          />
        ))}
      </div>
    ) : null
  );

  const handleOpenEdit = (event) => {
    event.stopPropagation();
    onOpenEdit?.(activity);
  };

  const handleDelete = (event) => {
    event.stopPropagation();
    onDelete?.(activity);
  };

  if (cardStyle === 'tag') {
    return (
      <div
        className="activity-card-tag"
        style={{
          display: 'inline-block',
          padding: '4px 12px 4px 10px',
          backgroundColor: group?.color + '20',
          borderRadius: '14px',
          border: `1px solid ${group?.color}`,
          fontSize: '11px',
          marginRight: '4px',
          marginBottom: '4px',
          cursor: 'grab',
          position: 'relative'
        }}
        onDoubleClick={handleOpenEdit}
      >
        {renderDayMarkers()}
        <span style={{ fontWeight: '600', color: 'var(--text-strong)' }}>{group?.name}</span>
        {activityDetail && (
          <span style={{ opacity: 0.7, fontSize: '10px', color: 'var(--text-muted)' }}>
            {' '}
            @{activityDetail}
          </span>
        )}

        <span
          className="tag-delete-btn"
          onClick={handleDelete}
          style={{
            marginLeft: '6px',
            padding: '0 4px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.8)',
            color: 'var(--text-muted)',
            fontSize: '10px',
            display: 'none',
            cursor: 'pointer'
          }}
        >
          ×
        </span>
      </div>
    );
  }

  if (cardStyle === 'minimal') {
    if (compact) {
      return (
        <div
          className="activity-card-minimal compact"
          style={{
            borderLeft: `2px solid ${group?.color}`,
            marginBottom: '4px',
            cursor: 'grab',
            backgroundColor: 'rgba(255,255,255,0.06)',
            padding: '2px 8px',
            borderRadius: '0 4px 4px 0',
            position: 'relative'
          }}
          onDoubleClick={handleOpenEdit}
        >
          {renderDayMarkers()}
          <div className="activity-card-line activity-card-group">{group?.name}</div>
          {activityDetail && (
            <div className="activity-card-line activity-card-location">{activityDetail}</div>
          )}
          <span
            className="minimal-delete-btn"
            onClick={handleDelete}
            style={{
              padding: '0 4px',
              color: 'var(--text-muted)',
              fontSize: '10px',
              display: 'none',
              cursor: 'pointer'
            }}
          >
            ×
          </span>
        </div>
      );
    }

    return (
      <div
        className="activity-card-minimal"
        style={{
          borderLeft: `2px solid ${group?.color}`,
          marginBottom: '4px',
          fontSize: '11px',
          cursor: 'grab',
          backgroundColor: 'rgba(255,255,255,0.06)',
          padding: '2px 8px',
          borderRadius: '0 4px 4px 0',
          position: 'relative'
        }}
        onDoubleClick={handleOpenEdit}
      >
        {renderDayMarkers()}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: '500', lineHeight: '16px', color: 'var(--text-strong)' }}>{group?.name}</div>
          <span
            className="minimal-delete-btn"
            onClick={handleDelete}
            style={{
              padding: '0 4px',
              color: 'var(--text-muted)',
              fontSize: '10px',
              display: 'none',
              cursor: 'pointer'
            }}
          >
            ×
          </span>
        </div>
        {activityDetail && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '14px' }}>
            {activityDetail}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default ActivityCard;

