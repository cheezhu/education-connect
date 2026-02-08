import React from 'react';

const CalendarDetailSidebarContainer = ({
  resourcePane,
  width = 280,
  onDragOver,
  onDrop
}) => {
  return (
    <div
      className="resource-cards-container"
      style={{ width }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {resourcePane}
    </div>
  );
};

export default CalendarDetailSidebarContainer;
