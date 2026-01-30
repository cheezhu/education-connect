import React from 'react';
import ScheduleManagement from '../../../GroupEditV2/ScheduleManagement';

const FullCalendarWrapper = ({ group, schedules, onSchedulesUpdate }) => {
  if (!group) {
    return <div className="calendar-fullscreen">请选择团组</div>;
  }

  return (
    <ScheduleManagement
      groupId={group.id}
      groupData={group}
      schedules={schedules}
      onUpdate={onSchedulesUpdate}
    />
  );
};

export default FullCalendarWrapper;
