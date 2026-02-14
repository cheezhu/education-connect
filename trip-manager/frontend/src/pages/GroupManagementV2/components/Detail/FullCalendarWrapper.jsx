import React from 'react';
import CalendarDetailController from '../../../../features/calendar-detail/CalendarDetailController';

const FullCalendarWrapper = ({
  group,
  schedules,
  onSchedulesUpdate,
  onLogisticsUpdate,
  onCustomResourcesChange,
  resourceWidth,
  scheduleRevision = 0,
  onRevisionChange,
  onRevisionConflict
}) => {
  if (!group) {
    return <div className="calendar-fullscreen">请选择团组</div>;
  }

  return (
    <CalendarDetailController
      groupId={group.id}
      groupData={group}
      schedules={schedules}
      onUpdate={onSchedulesUpdate}
      onLogisticsUpdate={onLogisticsUpdate}
      onCustomResourcesChange={onCustomResourcesChange}
      resourceWidth={resourceWidth}
      scheduleRevision={scheduleRevision}
      onRevisionChange={onRevisionChange}
      onRevisionConflict={onRevisionConflict}
    />
  );
};

export default FullCalendarWrapper;
