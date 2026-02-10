import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import ActivityCard from '../ItineraryDesigner/timeline/ActivityCard';

const buildBaselineMap = (assignments) => {
  const map = new Map();
  (assignments || []).forEach((row) => {
    if (!row) return;
    const groupId = Number(row.groupId);
    const date = String(row.date || '');
    const timeSlot = String(row.timeSlot || '').toUpperCase();
    const locationId = Number(row.locationId);
    if (!Number.isFinite(groupId) || !date || !timeSlot || !Number.isFinite(locationId)) return;
    map.set(`${groupId}|${date}|${timeSlot}`, locationId);
  });
  return map;
};

function SolverTimelineGrid({
  dateStrings,
  visibleTimeSlots,
  assignments,
  groupsById,
  locationsById,
  baselineAssignments,
  highlightDiff
}) {
  const activitiesByCell = useMemo(() => {
    const map = new Map();
    (assignments || []).forEach((row, index) => {
      if (!row) return;
      const date = String(row.date || '');
      const timeSlot = String(row.timeSlot || '').toUpperCase();
      if (!date || !timeSlot) return;
      const key = `${date}|${timeSlot}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        id: row.id || `${row.groupId}|${date}|${timeSlot}|${row.locationId}|${index}`,
        groupId: row.groupId,
        locationId: row.locationId,
        date,
        timeSlot,
        participantCount: row.participantCount,
        notes: row.notes
      });
    });

    for (const [key, items] of map.entries()) {
      items.sort((a, b) => {
        const ga = groupsById?.get?.(Number(a.groupId));
        const gb = groupsById?.get?.(Number(b.groupId));
        const na = ga?.name || String(a.groupId || '');
        const nb = gb?.name || String(b.groupId || '');
        return na.localeCompare(nb, 'zh');
      });
      map.set(key, items);
    }

    return map;
  }, [assignments, groupsById]);

  const baselineLocationBySlot = useMemo(() => (
    buildBaselineMap(baselineAssignments)
  ), [baselineAssignments]);

  return (
    <div className="timeline-grid">
      <div className="timeline-header">
        <div className="time-label-cell">时间段</div>
        {dateStrings.map((dateString) => (
          <div key={dateString} className="date-header-cell">
            <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 'bold' }}>{dayjs(dateString).format('MM-DD')}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{dayjs(dateString).format('ddd')}</span>
            </div>
          </div>
        ))}
      </div>

      {visibleTimeSlots.map(timeSlot => (
        <div key={timeSlot.key} className="timeline-row">
          <div
            className="time-label-cell"
            style={{
              backgroundColor: timeSlot.color,
              borderLeft: `3px solid ${timeSlot.borderColor}`
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold' }}>{timeSlot.label}</div>
              <div style={{ fontSize: '10px' }}>{timeSlot.time}</div>
            </div>
          </div>

          {dateStrings.map((dateString) => {
            const cellKey = `${dateString}|${timeSlot.key}`;
            const activities = activitiesByCell.get(cellKey) || [];

            return (
              <div
                key={cellKey}
                className="timeline-cell"
                style={{ backgroundColor: timeSlot.color }}
              >
                {activities.length > 0 ? (
                  <div className="activity-summary grouped compact">
                    {activities.map((activity) => {
                      const groupId = Number(activity.groupId);
                      const locationId = Number(activity.locationId);
                      const group = groupsById?.get?.(groupId) || { id: groupId, name: `#${groupId}`, color: '#1890ff' };
                      const location = locationsById?.get?.(locationId) || { id: locationId, name: `#${locationId}` };
                      const baselineKey = `${groupId}|${dateString}|${String(timeSlot.key).toUpperCase()}`;
                      const baselineLocationId = baselineLocationBySlot.get(baselineKey) ?? null;
                      const isDiff = Boolean(highlightDiff && (baselineLocationId === null || baselineLocationId !== locationId));

                      return (
                        <div
                          key={activity.id}
                          style={{
                            outline: isDiff ? '2px solid #fa541c' : 'none',
                            background: isDiff ? 'rgba(250, 84, 28, 0.12)' : 'transparent',
                            borderRadius: '4px'
                          }}
                          title={`${group?.name} @ ${location?.name}`}
                        >
                          <ActivityCard
                            activity={activity}
                            group={group}
                            location={location}
                            compact={false}
                            cardStyle="minimal"
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default SolverTimelineGrid;

