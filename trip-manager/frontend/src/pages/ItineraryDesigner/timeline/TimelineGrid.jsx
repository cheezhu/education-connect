import React from 'react';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

function TimelineGrid({
  dateRange,
  visibleTimeSlots,
  alignGroupRows,
  showUnscheduledGroups,
  showDailyFocus,
  groups,
  locations,
  timelineSlotConflictMap,
  selectedActivities,
  batchMode,

  formatDateString,
  getActivitiesForSlot,
  getGroupDisplayName,
  getActiveGroupsForDate,
  getActiveGroupNamesForDate,
  isGroupArrivalDay,
  isGroupDepartureDay,
  getArrivalsForDate,
  getDeparturesForDate,
  getLocationTotalsForDate,

  handleCellClick,
  handleDragOver,
  handleDragEnter,
  handleDragLeave,
  handleDrop,
  handleDragStart,
  handleDragEnd,
  openGroupCalendar,
  setSelectedActivities,
  renderActivityCard
}) {
  return (
    <div className="timeline-grid">
      {/* 表头 */}
      <div className="timeline-header">
        <div className="time-label-cell">时间段</div>
        {dateRange.map((date, index) => (
          <div key={index} className="date-header-cell">
            <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 'bold' }}>
                {dayjs(date).format('MM-DD')}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {dayjs(date).format('ddd')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 表格主体 */}
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

          {(() => {
            const groupNamesForSlot = new Set();
            if (alignGroupRows) {
              dateRange.forEach((date) => {
                const slotActivities = getActivitiesForSlot(date, timeSlot.key);
                slotActivities.forEach((activity) => {
                  const group = groups.find(g => g.id === activity.groupId);
                  const groupName = getGroupDisplayName(group);
                  groupNamesForSlot.add(groupName);
                });
                if (showUnscheduledGroups) {
                  getActiveGroupsForDate(date).forEach((group) => {
                    groupNamesForSlot.add(getGroupDisplayName(group));
                  });
                }
              });
            }
            const orderedGroupNames = alignGroupRows
              ? Array.from(groupNamesForSlot).sort((a, b) => a.localeCompare(b, 'zh'))
              : [];
            return dateRange.map((date, dateIndex) => {
              const dateString = formatDateString(date);
              const slotActivities = getActivitiesForSlot(date, timeSlot.key);
              const groupedByName = slotActivities.reduce((acc, activity) => {
                const group = groups.find(g => g.id === activity.groupId);
                const groupName = getGroupDisplayName(group);
                if (!acc.has(groupName)) {
                  acc.set(groupName, []);
                }
                acc.get(groupName).push({ activity, group });
                return acc;
              }, new Map());
              const activeGroupNames = showUnscheduledGroups
                ? getActiveGroupNamesForDate(date)
                : null;
              if (showUnscheduledGroups) {
                activeGroupNames.forEach((groupName) => {
                  if (!groupedByName.has(groupName)) {
                    groupedByName.set(groupName, []);
                  }
                });
              }
              const rowGroupNames = alignGroupRows
                ? orderedGroupNames
                : Array.from(groupedByName.keys()).sort((a, b) => a.localeCompare(b, 'zh'));
              const slotConflictInfo = timelineSlotConflictMap.get(`${dateString}|${timeSlot.key}`) || null;
              const hasSlotConflict = Boolean(slotConflictInfo?.conflicts?.length);

              return (
                <div
                  key={`${timeSlot.key}-${dateIndex}`}
                  className={`timeline-cell ${alignGroupRows ? 'aligned-rows' : ''}`}
                  style={{ backgroundColor: timeSlot.color }}
                  onClick={() => handleCellClick(date, timeSlot.key, slotActivities, slotConflictInfo)}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, date, timeSlot.key)}
                >
                  {hasSlotConflict ? (
                    <div className="cell-conflict-badge">
                      冲突 {slotConflictInfo.conflicts.length}
                    </div>
                  ) : null}
                  {rowGroupNames.length === 0 ? (
                    <div className="empty-cell">
                      <PlusOutlined style={{ color: 'var(--text-muted)' }} />
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>点击添加</div>
                    </div>
                  ) : (
                    <div className={`activity-summary grouped ${alignGroupRows ? "aligned" : "compact"}`}>
                      {rowGroupNames.map((groupName) => {
                        const items = groupedByName.get(groupName) || [];
                        const fallbackGroup = showUnscheduledGroups
                          ? getActiveGroupsForDate(date).find(group => getGroupDisplayName(group) === groupName)
                          : null;
                        const groupForRow = items[0]?.group || fallbackGroup || null;
                        const isActiveGroup = showUnscheduledGroups
                          ? activeGroupNames?.has(groupName)
                          : items.length > 0;
                        const showPlaceholder = showUnscheduledGroups && isActiveGroup && items.length === 0;
                        const showArrivalMarker = showPlaceholder && isGroupArrivalDay(groupForRow, dateString);
                        const showDepartureMarker = showPlaceholder && isGroupDepartureDay(groupForRow, dateString);
                        const rowClassName = [
                          'activity-group-row',
                          items.length === 0 ? 'empty' : '',
                          showPlaceholder ? 'unscheduled' : '',
                          showUnscheduledGroups && !isActiveGroup ? 'inactive' : ''
                        ]
                          .filter(Boolean)
                          .join(' ');
                        return (
                          <div
                            key={groupName}
                            className={rowClassName}
                          >
                            {items.map(({ activity, group }) => {
                              const isCompact = items.length > 1;
                              const location = locations.find(l => l.id === activity.locationId);
                              const isSelected = selectedActivities.includes(activity.id);

                              return (
                                <div
                                  key={activity.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, activity)}
                                  onDragEnd={handleDragEnd}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (batchMode) {
                                      if (isSelected) {
                                        setSelectedActivities(prev => prev.filter(id => id !== activity.id));
                                      } else {
                                        setSelectedActivities(prev => [...prev, activity.id]);
                                      }
                                    } else {
                                      openGroupCalendar(activity.groupId);
                                    }
                                  }}
                                  style={{
                                    opacity: batchMode && !isSelected ? 0.6 : 1,
                                    outline: isSelected ? '2px solid #1890ff' : 'none',
                                    borderRadius: '4px'
                                  }}
                                  title={`${group?.name}${location ? ` - ${location.name}` : ''} (${activity.participantCount}人)`}
                                >
                                  {renderActivityCard(activity, group, location, isCompact)}
                                </div>
                              );
                            })}
                            {showPlaceholder && (
                              <div
                                className="unscheduled-card"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (groupForRow?.id) {
                                    openGroupCalendar(groupForRow.id);
                                  }
                                }}
                              >
                                {(showArrivalMarker || showDepartureMarker) && (
                                  <div className="unscheduled-day-marker">
                                    {showArrivalMarker && (
                                      <span className="activity-day-marker-dot arrival" />
                                    )}
                                    {showDepartureMarker && (
                                      <span className="activity-day-marker-dot departure" />
                                    )}
                                  </div>
                                )}
                                {groupName}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      ))}

      {showDailyFocus && (
        <div
          className="daily-focus-row"
          style={{ gridTemplateColumns: `100px repeat(${dateRange.length}, minmax(0, 1fr))` }}
        >
          <div className="daily-focus-label-cell">
            <div className="daily-focus-title">每日关注</div>
          </div>
          {dateRange.map((date) => {
            const dateString = formatDateString(date);
            const arrivals = getArrivalsForDate(dateString);
            const departures = getDeparturesForDate(dateString);

            return (
              <div key={dateString} className="daily-focus-cell">
                <div className="daily-focus-section">
                  <div className="daily-focus-item">
                    {arrivals.length
                      ? arrivals.map(group => `${group.name}团组抵达`).join('，')
                      : '暂无团组抵达'}
                  </div>
                  <div className="daily-focus-item">
                    {departures.length
                      ? departures.map(group => `${group.name}团组结束`).join('，')
                      : '暂无团组结束'}
                  </div>
                </div>

                {visibleTimeSlots.map((slot) => {
                  const totals = getLocationTotalsForDate(dateString, slot.key);
                  return (
                    <div key={`${dateString}-${slot.key}`} className="daily-focus-section">
                      <div className="daily-focus-section-title">{slot.label}</div>
                      {totals.length ? (
                        totals.map(item => (
                          <div key={`${item.locationId}-${slot.key}`} className="daily-focus-item">
                            {item.name} {item.total}人
                          </div>
                        ))
                      ) : (
                        <div className="daily-focus-item">暂无安排</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TimelineGrid;

