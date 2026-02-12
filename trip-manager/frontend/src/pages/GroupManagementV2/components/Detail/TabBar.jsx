import React from 'react';

const TabBar = ({
  activeTab,
  mode = 'read',
  onTabChange,
  isSidebarCollapsed,
  onExpandSidebar,
  onCollapseSidebar
}) => {
  return (
    <div className="tab-container">
      <span
        className={`expand-btn ${isSidebarCollapsed ? 'visible' : ''}`}
        onClick={onExpandSidebar}
      >
        ← 列表
      </span>
      <span
        className={`collapse-btn ${!isSidebarCollapsed ? 'visible' : ''}`}
        onClick={onCollapseSidebar}
      >
        隐藏列表 →
      </span>
      <div className={`tab-group tab-group-read ${mode === 'read' ? 'active' : ''}`}>
        <div
          className={`tab-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => onTabChange('profile')}
        >
          团组设置
        </div>
        <div
          className={`tab-item ${activeTab === 'itinerary' ? 'active' : ''}`}
          onClick={() => onTabChange('itinerary')}
        >
          行程详情
        </div>
      </div>

      <div className="tab-group-divider" />

      <div className={`tab-group tab-group-work ${mode === 'work' ? 'active' : ''}`}>
        <div
          className={`tab-item ${activeTab === 'logistics' ? 'active' : ''}`}
          onClick={() => onTabChange('logistics')}
        >
          食行卡片
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

    </div>
  );
};

export default TabBar;
