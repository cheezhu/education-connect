import React, { useState } from 'react';
import CalendarDetailCopilot from './CalendarDetailCopilot';

const CalendarDetailSidebar = ({
  width = 260,
  resourcePane,
  aiProps,
  onDragOver,
  onDrop,
  show = true
}) => {
  const [activeTab, setActiveTab] = useState('resources');
  const [isDragOver, setIsDragOver] = useState(false);

  if (!show) {
    return null;
  }

  const handleDragOver = (event) => {
    onDragOver?.(event);
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (event) => {
    setIsDragOver(false);
    onDrop?.(event);
  };

  return (
    <div
      className={`resource-cards-container calendar-sidebar-right ${isDragOver ? 'drag-over' : ''}`}
      style={{ width }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="sidebar-tabs">
        <div
          className={`sidebar-tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          AI 助手
        </div>
        <div
          className={`sidebar-tab ${activeTab === 'resources' ? 'active' : ''}`}
          onClick={() => setActiveTab('resources')}
        >
          资源库
        </div>
      </div>

      <div className={`sidebar-pane ${activeTab === 'ai' ? 'active' : ''}`}>
        <CalendarDetailCopilot {...aiProps} />
      </div>

      <div className={`sidebar-pane ${activeTab === 'resources' ? 'active' : ''}`}>
        {resourcePane}
      </div>
    </div>
  );
};

export default CalendarDetailSidebar;

