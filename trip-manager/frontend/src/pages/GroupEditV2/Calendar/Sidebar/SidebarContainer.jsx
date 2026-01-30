import React, { useMemo, useState } from 'react';
import AICoPilot from './AICoPilot';

const SidebarContainer = ({
  defaultTab = 'ai',
  onTabChange,
  resourcePane,
  aiProps,
  width = 280,
  onDragOver,
  onDrop
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleSwitch = (tab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const aiPane = useMemo(() => (
    <AICoPilot {...aiProps} />
  ), [aiProps]);

  return (
    <div
      className="resource-cards-container"
      style={{ width }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="sidebar-tabs">
        <div
          className={`sidebar-tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => handleSwitch('ai')}
        >
          ✨ AI 助手
        </div>
        <div
          className={`sidebar-tab ${activeTab === 'resources' ? 'active' : ''}`}
          onClick={() => handleSwitch('resources')}
        >
          📦 资源库
        </div>
      </div>

      <div className={`sidebar-pane ${activeTab === 'ai' ? 'active' : ''}`}>
        {aiPane}
      </div>

      <div className={`sidebar-pane ${activeTab === 'resources' ? 'active' : ''}`}>
        {resourcePane}
      </div>
    </div>
  );
};

export default SidebarContainer;
