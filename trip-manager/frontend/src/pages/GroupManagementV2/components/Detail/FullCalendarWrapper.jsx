import React from 'react';
import ScheduleManagement from '../../../GroupEditV2/ScheduleManagement';

const FullCalendarWrapper = ({
  group,
  schedules,
  onSchedulesUpdate,
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
    <ScheduleManagement
      groupId={group.id}
      groupData={group}
      schedules={schedules}
      onUpdate={onSchedulesUpdate}
      onCustomResourcesChange={onCustomResourcesChange}
      resourceWidth={resourceWidth}
      scheduleRevision={scheduleRevision}
      onRevisionChange={onRevisionChange}
      onRevisionConflict={onRevisionConflict}
    />
  );
};

export default FullCalendarWrapper;
