import React from 'react';

const TabBar = ({ activeTab, onTabChange, isSidebarCollapsed, onExpandSidebar }) => {
  return (
    <div className="tab-container">
      <span
        className={`expand-btn ${isSidebarCollapsed ? 'visible' : ''}`}
        onClick={onExpandSidebar}
      >
        ← 列表
      </span>
      <div
        className={`tab-item ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => onTabChange('profile')}
      >
        团组信息
      </div>
      <div
        className={`tab-item ${activeTab === 'schedule' ? 'active' : ''}`}
        onClick={() => onTabChange('schedule')}
      >
        日历详情
      </div>
      <div
        className={`tab-item ${activeTab === 'members' ? 'active' : ''}`}
        onClick={() => onTabChange('members')}
      >
        人员信息
      </div>
    </div>
  );
};

export default TabBar;
