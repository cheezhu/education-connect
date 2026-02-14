import React, { Suspense, useEffect, useState } from 'react';
import { message } from 'antd';
import { useLocation } from 'react-router-dom';
import GroupList from './components/Sidebar/GroupList';
import TabBar from './components/Detail/TabBar';
import BulkCreateModal from './components/Modals/BulkCreateModal';
import GroupCommandCenterSkeleton from './components/GroupCommandCenterSkeleton';
import TabErrorBoundary from './components/TabErrorBoundary';
import AiDock from './components/AiDock';
import { useGroupData } from './hooks/useGroupData';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { GROUP_MESSAGES, TAB_GROUPS, TAB_KEYS, resolveTabKey } from './constants';
import { isReadModeTab, renderTabView } from './tabViews';
import './GroupCommandCenter.css';

const GroupManagementV2 = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [aiDockOpen, setAiDockOpen] = useState(false);

  const {
    groups,
    filteredGroups,
    loading,
    activeGroupId,
    activeGroup,
    groupSchedules,
    hasMembers,
    itineraryPlans,
    locations,
    rightPanelWidth,
    bulkOpen,
    bulkSubmitting,
    bulkRows,
    bulkErrors,
    scheduleRevision,
    setRightPanelWidth,
    setBulkOpen,
    handleSelectGroup,
    handleGroupUpdate,
    handleScheduleUpdate,
    handleLogisticsChange,
    handleDeleteGroup,
    handleQuickCreateGroup,
    addBulkRow,
    removeBulkRow,
    updateBulkRow,
    resetBulkForm,
    handleBulkCreate,
    handleCalendarLogisticsUpdate,
    handleCustomResourcesChange,
    handleRevisionChange,
    handleRevisionConflict,
    fetchGroups,
    fetchItineraryPlans,
    fetchLocations,
    fetchLogistics,
    fetchSchedules,
    fetchMemberCount,
    getActiveGroupId
  } = useGroupData({ notify: message });

  useRealtimeSync({
    fetchGroups,
    fetchPlans: fetchItineraryPlans,
    fetchLocations,
    fetchLogistics,
    fetchSchedules,
    fetchMemberCount,
    getActiveGroupId
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (!tab) return;
    const resolvedTab = resolveTabKey(tab);
    if (TAB_KEYS.has(resolvedTab)) {
      setActiveTab(resolvedTab);
    }
  }, [location.search]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleExpandSidebar = () => {
    setIsSidebarCollapsed(false);
  };

  const handleCollapseSidebar = () => {
    setIsSidebarCollapsed(true);
  };

  const handleQuickCreateAndFocusProfile = async () => {
    await handleQuickCreateGroup();
    setActiveTab('profile');
  };

  if (loading && groups.length === 0) {
    return <GroupCommandCenterSkeleton />;
  }

  const isReadMode = isReadModeTab(activeTab);
  const tabMode = isReadMode ? 'read' : 'work';

  const activeTabLabel = (() => {
    for (const group of TAB_GROUPS) {
      const found = Array.isArray(group?.tabs)
        ? group.tabs.find((tab) => tab && tab.key === activeTab)
        : null;
      if (found && found.label) return found.label;
    }
    return activeTab;
  })();

  return (
    <div className={`group-command-center ${aiDockOpen ? 'ai-docked' : ''}`}>
      <div className="layout">
        <div className="content-split">
          <GroupList
            groups={filteredGroups}
            totalCount={groups.length}
            activeGroupId={activeGroupId}
            onSelectGroup={handleSelectGroup}
            onCreateGroup={handleQuickCreateAndFocusProfile}
            onBulkCreate={() => setBulkOpen(true)}
            isCollapsed={isSidebarCollapsed}
          />

          <div className={`detail-view ${isReadMode ? 'mode-read' : 'mode-work'}`}>
            <TabBar
              activeTab={activeTab}
              mode={tabMode}
              onTabChange={handleTabChange}
              isSidebarCollapsed={isSidebarCollapsed}
              onExpandSidebar={handleExpandSidebar}
              onCollapseSidebar={handleCollapseSidebar}
            />

            <div className="tab-content">
              <div className={`content-pane active ${activeTab === 'itinerary' ? 'pane-itinerary' : ''}`}>
                <TabErrorBoundary fallback={GROUP_MESSAGES.tabRenderFailed}>
                  <Suspense fallback={<div className="empty-state">{GROUP_MESSAGES.loading}</div>}>
                    {renderTabView({
                      activeTab,
                      activeGroup,
                      groupSchedules,
                      hasMembers,
                      itineraryPlans,
                      locations,
                      onGroupUpdate: handleGroupUpdate,
                      onDeleteGroup: handleDeleteGroup,
                      rightPanelWidth,
                      onResizeRightPanel: setRightPanelWidth,
                      onNavigateTab: setActiveTab,
                      onLogisticsChange: handleLogisticsChange,
                      onScheduleUpdate: handleScheduleUpdate,
                      onCalendarLogisticsUpdate: handleCalendarLogisticsUpdate,
                      onCustomResourcesChange: handleCustomResourcesChange,
                      scheduleRevision,
                      onRevisionChange: handleRevisionChange,
                      onRevisionConflict: handleRevisionConflict
                    })}
                  </Suspense>
                </TabErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BulkCreateModal
        open={bulkOpen}
        rows={bulkRows}
        errors={bulkErrors}
        onChangeRow={updateBulkRow}
        onAddRow={addBulkRow}
        onRemoveRow={removeBulkRow}
        onClose={() => {
          setBulkOpen(false);
          resetBulkForm();
        }}
        onSubmit={handleBulkCreate}
        submitting={bulkSubmitting}
      />

      <AiDock
        open={aiDockOpen}
        activeGroup={activeGroup}
        activeTabLabel={activeTabLabel}
        onToggle={() => setAiDockOpen((prev) => !prev)}
      />

      {loading && groups.length > 0 && (
        <div className="modal-overlay visible">
          <div className="modal-box" style={{ width: 240, height: 120, alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#666' }}>{GROUP_MESSAGES.loading}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManagementV2;
