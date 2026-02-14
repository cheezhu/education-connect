import React from 'react';
import { TAB_GROUPS } from '../../constants';

const TabBar = ({
  activeTab,
  mode = 'read',
  onTabChange,
  isSidebarCollapsed,
  onExpandSidebar,
  onCollapseSidebar
}) => {
  const isCollapsed = Boolean(isSidebarCollapsed);

  const handleSidebarToggle = () => {
    if (isCollapsed) {
      onExpandSidebar?.();
      return;
    }
    onCollapseSidebar?.();
  };

  const toggleLabel = isCollapsed ? '\u663e\u793a\u5217\u8868' : '\u9690\u85cf\u5217\u8868';
  const toggleIcon = isCollapsed ? '\u25b6' : '\u25c0';

  return (
    <div className="tab-container">
      <button
        type="button"
        className={`sidebar-toggle-btn ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`}
        onClick={handleSidebarToggle}
        title={toggleLabel}
        aria-label={toggleLabel}
      >
        <span className="sidebar-toggle-icon" aria-hidden="true">{toggleIcon}</span>
      </button>

      {TAB_GROUPS.map((group, index) => (
        <React.Fragment key={group.id}>
          <div className={`tab-group tab-group-${group.mode} ${mode === group.mode ? 'active' : ''}`}>
            {group.tabs.map((tab) => (
              <div
                key={tab.key}
                className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => onTabChange(tab.key)}
              >
                {tab.label}
              </div>
            ))}
          </div>
          {index < TAB_GROUPS.length - 1 && <div className="tab-group-divider" />}
        </React.Fragment>
      ))}
    </div>
  );
};

export default TabBar;
