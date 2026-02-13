import React, { lazy } from 'react';
import ProfileView from './components/Detail/ProfileView';
import ProgressView from './components/Detail/ProgressView';

const FullCalendarWrapper = lazy(() => import('./components/Detail/FullCalendarWrapper'));
const LogisticsView = lazy(() => import('./components/Detail/Logistics/LogisticsView'));
const ItineraryTextDetail = lazy(() => import('./components/Detail/ItineraryTextDetail'));
const HelpView = lazy(() => import('./components/Detail/HelpView'));
const MembersView = lazy(() => import('./components/Detail/MembersView'));

export const isReadModeTab = (tabKey) => tabKey === 'profile' || tabKey === 'progress' || tabKey === 'itinerary';

export const renderTabView = ({
  activeTab,
  activeGroup,
  groupSchedules,
  hasMembers,
  itineraryPlans,
  locations,
  onGroupUpdate,
  onDeleteGroup,
  rightPanelWidth,
  onResizeRightPanel,
  onNavigateTab,
  onLogisticsChange,
  onScheduleUpdate,
  onCalendarLogisticsUpdate,
  onCustomResourcesChange,
  scheduleRevision,
  onRevisionChange,
  onRevisionConflict
}) => {
  switch (activeTab) {
    case 'profile':
      return (
        <ProfileView
          group={activeGroup}
          hasMembers={hasMembers}
          itineraryPlans={itineraryPlans}
          locations={locations}
          onUpdate={onGroupUpdate}
          onDelete={onDeleteGroup}
          rightPanelWidth={rightPanelWidth}
          onResizeRightPanel={onResizeRightPanel}
        />
      );
    case 'progress':
      return (
        <ProgressView
          group={activeGroup}
          schedules={groupSchedules}
          onNavigateTab={onNavigateTab}
        />
      );
    case 'logistics':
      return (
        <LogisticsView
          group={activeGroup}
          schedules={groupSchedules}
          onUpdate={onLogisticsChange}
        />
      );
    case 'schedule':
      return (
        <FullCalendarWrapper
          group={activeGroup}
          schedules={groupSchedules}
          onSchedulesUpdate={onScheduleUpdate}
          onLogisticsUpdate={onCalendarLogisticsUpdate}
          onCustomResourcesChange={onCustomResourcesChange}
          resourceWidth={rightPanelWidth}
          scheduleRevision={scheduleRevision}
          onRevisionChange={onRevisionChange}
          onRevisionConflict={onRevisionConflict}
        />
      );
    case 'itinerary':
      return (
        <ItineraryTextDetail
          group={activeGroup}
          schedules={groupSchedules}
        />
      );
    case 'members':
      return (
        <MembersView groupId={activeGroup?.id ?? null} />
      );
    case 'help':
      return <HelpView />;
    default:
      return null;
  }
};
