﻿﻿﻿﻿import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Result } from 'antd';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import dayjs from 'dayjs';
import ItineraryDesignerSkeleton from './ItineraryDesignerSkeleton';
import PlanningImportModal from './planning/PlanningImportModal';
import PlanningExportModal from './planning/PlanningExportModal';
import usePlanningExport from './planning/usePlanningExport';
import usePlanningImport from './planning/usePlanningImport';
import useItineraryDesignerData from './hooks/useItineraryDesignerData';
import useItineraryDesignerConfig from './hooks/useItineraryDesignerConfig';
import useActivityCrud from './hooks/useActivityCrud';
import useGroupCalendarResize from './hooks/useGroupCalendarResize';
import useGroupCalendarDetail from './hooks/useGroupCalendarDetail';
import { generateDateRange, formatDateString } from './shared/dates';
import { timeSlotWindows } from './shared/timeSlots';
import { isDateWithinGroupRange } from './shared/groupRules';
import SlotConflictModal from './conflicts/SlotConflictModal';
import TimelineGrid from './timeline/TimelineGrid';
import ActivityCard from './timeline/ActivityCard';
import useTimelineDnD from './timeline/useTimelineDnD';
import GroupConsoleDrawer from './console/GroupConsoleDrawer';
import useGroupConsoleDnD from './console/useGroupConsoleDnD';
import useGroupConsoleModel from './console/useGroupConsoleModel';
import ActivityEditModal from './components/ActivityEditModal';
import GroupCalendarDetailModal from './components/GroupCalendarDetailModal';
import ItineraryDesignerHeader from './components/ItineraryDesignerHeader';
import GroupSelectorDrawer from './components/GroupSelectorDrawer';
import useTimelineSlotConflictMap from './conflicts/useTimelineSlotConflictMap';
import './ItineraryDesigner.css';

function ItineraryDesigner() {
  const { canAccess } = useAuth();

  const {
    weekStartDate,
    enabledTimeSlots,
    showDailyFocus,
    showUnscheduledGroups,
    groupCalendarHeight,
    setGroupCalendarHeight,
    groupCalendarHeightRef,
    normalizeGroupCalendarHeight,
    persistGroupCalendarHeightConfig,
    handleTimeSlotToggle,
    handleDailyFocusToggle,
    handleShowUnscheduledToggle,
    handleWeekStartChange,
    handleWeekShift
  } = useItineraryDesignerConfig({ api });

  const {
    groups,
    setGroups,
    activities,
    setActivities,
    locations,
    itineraryPlanById,
    loading,
    selectedGroups,
    setSelectedGroups,
    refreshData,
    refreshActivitiesOnly
  } = useItineraryDesignerData({ api });
  const [groupPanelVisible, setGroupPanelVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [selectedSlotConflict, setSelectedSlotConflict] = useState(null);

  const {
    handleAddActivity,
    handleDeleteActivity,
    handleUpdateActivity
  } = useActivityCrud({
    api,
    groups,
    activities,
    locations,
    selectedTimeSlot,
    setSelectedTimeSlot,
    setActivities,
    refreshData
  });
  const cardStyle = 'minimal';
  const alignGroupRows = false;
  const [batchMode, setBatchMode] = useState(false); // 批量选择模式
  const [selectedActivities, setSelectedActivities] = useState([]); // 选中的活动
  const [groupCalendarVisible, setGroupCalendarVisible] = useState(false);
  const [groupCalendarGroupId, setGroupCalendarGroupId] = useState(null);
  const {
    visible: groupCalendarDetailVisible,
    groupId: groupCalendarDetailGroupId,
    schedules: groupCalendarDetailSchedules,
    loading: groupCalendarDetailLoading,
    resourcesVisible: groupCalendarDetailResourcesVisible,
    setResourcesVisible: setGroupCalendarDetailResourcesVisible,
    open: openGroupCalendarDetail,
    close: closeGroupCalendarDetail,
    onUpdate: handleGroupCalendarDetailUpdate
  } = useGroupCalendarDetail({
    api,
    onBeforeOpen: () => setGroupPanelVisible(true)
  });
  const {
    resizing: groupCalendarResizing,
    onResizeStart: handleGroupCalendarResizeStart
  } = useGroupCalendarResize({
    heightRef: groupCalendarHeightRef,
    normalizeHeight: normalizeGroupCalendarHeight,
    setHeight: setGroupCalendarHeight,
    persistHeight: persistGroupCalendarHeightConfig
  });
  const designerRef = useRef(null);
  const getDesignerContainer = () => (
    designerRef.current || document.querySelector('.app-main') || document.body
  );
  const overlayStyles = {
    wrapper: { position: 'absolute', inset: 0 },
    mask: { position: 'absolute', inset: 0 }
  };

  // 时间段定义
  const timeSlots = [
    { key: 'MORNING', label: '上午', time: `${timeSlotWindows.MORNING.start}-${timeSlotWindows.MORNING.end}`, color: 'transparent', borderColor: '#0e639c' },
    { key: 'AFTERNOON', label: '下午', time: `${timeSlotWindows.AFTERNOON.start}-${timeSlotWindows.AFTERNOON.end}`, color: 'transparent', borderColor: '#89d185' },
    { key: 'EVENING', label: '晚上', time: `${timeSlotWindows.EVENING.start}-${timeSlotWindows.EVENING.end}`, color: 'transparent', borderColor: '#cca700' }
  ];
  const visibleTimeSlots = timeSlots.filter((slot) => enabledTimeSlots.includes(slot.key));
  // 生成日期范围（7天一页）
  const dateRange = generateDateRange(weekStartDate);

  // Planning IO: export solver inputs and import solver results
  const {
    planningForm,
    mustVisitFixRef: planningMustVisitFixRef,
    activeLocations,
    planningDateRange,
    planningAvailableGroups,
    planningMissingMustVisitGroupIds,
    planningBlockingMustVisitGroups,
    planningMustVisitFixGroups,
    planningMustVisitDraftByGroupId,
    planningExportVisible,
    planningExportLoading,
    openPlanningExportModal,
    closePlanningExportModal,
    handlePlanningExport,
    updatePlanningMustVisitDraft,
    fillPlanningMustVisitFromPlan,
    fillAllMissingMustVisitFromPlan
  } = usePlanningExport({
    api,
    groups,
    setGroups,
    locations,
    itineraryPlanById,
    selectedGroups,
    dateRange
  });

  const {
    planningImportVisible,
    openPlanningImportModal,
    closePlanningImportModal,
    planningImportFileList,
    handlePlanningImportFile,
    handlePlanningImportRemove,
    planningImportPayload,
    planningImportFile,
    planningImportRange,
    planningImportAssignmentsCount,
    planningImportPayloadGroupIds,
    planningImportForm,
    setPlanningImportValidatedKey,
    planningImportOnlySelectedValue,
    planningImportSelectedGroupIds,
    handlePlanningImportRollback,
    planningImportRollbackLoading,
    planningImportSnapshotToken,
    handlePlanningImportValidate,
    planningImportValidating,
    handlePlanningImportApply,
    planningImportLoading,
    planningImportValidatedKey,
    planningImportResult,
    planningImportSummary,
    planningImportConflicts,
    planningConflictActiveReason,
    setPlanningConflictActiveReason,
    planningConflictRows,
    planningConflictBuckets,
    planningConflictManualOnly,
    setPlanningConflictManualOnly,
    planningConflictTodayOnly,
    setPlanningConflictTodayOnly,
    planningConflictTodayCount,
    planningConflictSortBy,
    setPlanningConflictSortBy,
    planningConflictTodayDate,
    planningConflictFilteredRows
  } = usePlanningImport({
    api,
    groups,
    locations,
    selectedGroups,
    refreshData
  });

  const getTimeSlotLabel = (slotKey) => {
    return timeSlots.find(slot => slot.key === slotKey)?.label || slotKey;
  };

  const getGroupDisplayName = (group) => group?.name || '未命名团组';

  const isGroupActiveOnDate = (group, date) => {
    if (!group?.start_date || !group?.end_date) return false;
    const currentDate = dayjs(date);
    const start = dayjs(group.start_date);
    const end = dayjs(group.end_date);
    if (!currentDate.isValid() || !start.isValid() || !end.isValid()) return false;
    return !start.isAfter(currentDate, 'day') && !end.isBefore(currentDate, 'day');
  };

  const getActiveGroupsForDate = (date) => (
    groups.filter(group => (
      selectedGroups.includes(group.id) && isGroupActiveOnDate(group, date)
    ))
  );

  const getActiveGroupNamesForDate = (date) => (
    new Set(getActiveGroupsForDate(date).map(getGroupDisplayName))
  );

  const isGroupArrivalDay = (group, dateString) => (
    Boolean(group?.start_date && dateString && group.start_date === dateString)
  );

  const isGroupDepartureDay = (group, dateString) => (
    Boolean(group?.end_date && dateString && group.end_date === dateString)
  );

  const getArrivalsForDate = (dateString) => {
    return groups.filter(group => (
      group.start_date === dateString && selectedGroups.includes(group.id)
    ));
  };

  const getDeparturesForDate = (dateString) => {
    return groups.filter(group => (
      group.end_date === dateString && selectedGroups.includes(group.id)
    ));
  };

  const getLocationTotalsForDate = (dateString, slotKey) => {
    const totals = new Map();
    activities.forEach((activity) => {
      if (activity.date !== dateString || activity.timeSlot !== slotKey) return;
      if (!selectedGroups.includes(activity.groupId)) return;
      const locationKey = activity.locationId ?? activity.notes ?? 'none';
      const current = totals.get(locationKey) || 0;
      totals.set(locationKey, current + (activity.participantCount || 0));
    });

    return Array.from(totals.entries())
      .map(([locationKey, total]) => {
        const location = locations.find(loc => loc.id === locationKey);
        return {
          locationId: locationKey,
          total,
          name: location
            ? location.name
            : (typeof locationKey === 'string' && locationKey !== 'none' ? locationKey : '未设置场地')
        };
      })
      .sort((a, b) => b.total - a.total);
  };

  const openGroupCalendar = (groupId) => {
    if (!groupId) return;
    setGroupCalendarGroupId(groupId);
    setGroupCalendarVisible(true);
  };

  // 获取指定时段的活动
  const getActivitiesForSlot = (date, timeSlot) => {
    const dateString = formatDateString(date);
    return activities.filter(activity => {
      const activityDate = activity.date;
      return activityDate === dateString &&
             activity.timeSlot === timeSlot &&
             selectedGroups.includes(activity.groupId);
    });
  };

  const timelineSlotConflictMap = useTimelineSlotConflictMap({
    activities,
    selectedGroups,
    groups,
    locations
  });

  // 工具面板已移除

  // 时间轴网格
  const renderTimelineGrid = () => (
    <TimelineGrid
      dateRange={dateRange}
      visibleTimeSlots={visibleTimeSlots}
      alignGroupRows={alignGroupRows}
      showUnscheduledGroups={showUnscheduledGroups}
      showDailyFocus={showDailyFocus}
      groups={groups}
      locations={locations}
      timelineSlotConflictMap={timelineSlotConflictMap}
      selectedActivities={selectedActivities}
      batchMode={batchMode}
      formatDateString={formatDateString}
      getActivitiesForSlot={getActivitiesForSlot}
      getGroupDisplayName={getGroupDisplayName}
      getActiveGroupsForDate={getActiveGroupsForDate}
      getActiveGroupNamesForDate={getActiveGroupNamesForDate}
      isGroupArrivalDay={isGroupArrivalDay}
      isGroupDepartureDay={isGroupDepartureDay}
      getArrivalsForDate={getArrivalsForDate}
      getDeparturesForDate={getDeparturesForDate}
      getLocationTotalsForDate={getLocationTotalsForDate}
      handleCellClick={handleCellClick}
      handleDragOver={handleDragOver}
      handleDragEnter={handleDragEnter}
      handleDragLeave={handleDragLeave}
      handleDrop={handleDrop}
      handleDragStart={handleDragStart}
      handleDragEnd={handleDragEnd}
      openGroupCalendar={openGroupCalendar}
      setSelectedActivities={setSelectedActivities}
      renderActivityCard={renderActivityCard}
    />
  );

  const renderActivityCard = (activity, group, location, compact = false) => (
    <ActivityCard
      activity={activity}
      group={group}
      location={location}
      compact={compact}
      cardStyle={cardStyle}
      isArrivalDay={isGroupArrivalDay(group, activity?.date)}
      isDepartureDay={isGroupDepartureDay(group, activity?.date)}
      onOpenEdit={() => handleCellClick(null, null, [activity])}
      onDelete={() => handleDeleteActivity(activity.id)}
    />
  );

  // 点击时间格子
  const handleCellClick = (date, timeSlot, activities, slotConflictInfo = null) => {
    const nextSelectedTimeSlot = {
      date: date ? formatDateString(date) : '',
      timeSlot,
      activities
    };
    setSelectedTimeSlot(nextSelectedTimeSlot);

    if (slotConflictInfo?.conflicts?.length) {
      setModalVisible(false);
      setSelectedSlotConflict({
        ...slotConflictInfo,
        date: nextSelectedTimeSlot.date,
        timeSlot
      });
      return;
    }

    setSelectedSlotConflict(null);
    setModalVisible(true);
  };

  const handleOpenEditFromConflict = () => {
    setSelectedSlotConflict(null);
    setModalVisible(true);
  };

  const {
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop
  } = useTimelineDnD({
    groups,
    locations,
    isDateWithinGroupRange,
    formatDateString,
    onUpdateActivity: handleUpdateActivity
  });

  const groupCalendarDetailGroup = groups.find(group => group.id === groupCalendarDetailGroupId);
  const groupCalendarDetailAvailableHeight = groupCalendarVisible ? groupCalendarHeight : 0;
  const groupCalendarDetailHeight = Math.max(20, 100 - groupCalendarDetailAvailableHeight);
  const groupCalendarDetailTop = 0;

  const {
    groupCalendarGroup,
    groupCalendarActivities,
    groupConsoleDates,
    groupConsoleSchedule,
    groupConsoleTypeLabel,
    groupConsoleMustVisitMode,
    groupConsoleActivePlan,
    groupConsoleMustVisitIdSet,
    groupConsoleMustVisitActivityMap,
    groupConsoleMustVisitCards,
    groupConsoleUnassignedMustVisitCards,
    groupConsoleAssignedMustVisitCount
  } = useGroupConsoleModel({
    groupId: groupCalendarGroupId,
    groups,
    activities,
    locations,
    fallbackDates: dateRange,
    formatDateString,
    getTimeSlotLabel
  });

  const {
    dropTarget: groupConsoleDropTarget,
    onCardDragStart: handleGroupConsoleCardDragStart,
    onCardDragEnd: handleGroupConsoleCardDragEnd,
    onCellDragOver: handleGroupConsoleCellDragOver,
    onCellDragEnter: handleGroupConsoleCellDragEnter,
    onCellDragLeave: handleGroupConsoleCellDragLeave,
    onDrop: handleGroupConsoleDrop,
    onRemoveActivity: handleGroupConsoleRemoveActivity,
    onClearSlot: handleGroupConsoleClearSlot
  } = useGroupConsoleDnD({
    api,
    group: groupCalendarGroup,
    groupActivities: groupCalendarActivities,
    mustVisitActivityMap: groupConsoleMustVisitActivityMap,
    locations,
    formatDateString,
    getTimeSlotLabel,
    setActivities,
    refreshData,
    onUpdateActivity: handleUpdateActivity
  });
  if (loading && groups.length === 0 && activities.length === 0) {
    return <ItineraryDesignerSkeleton />;
  }

  if (!canAccess('designer')) {
    return (
      <Result
        status="403"
        title="无权限"
        subTitle="仅管理员可访问行程设计器"
      />
    );
  }
  return (
    <div className="itinerary-designer" ref={designerRef}>
      <ItineraryDesignerHeader
        dateRange={dateRange}
        weekStartDate={weekStartDate}
        onWeekStartChange={handleWeekStartChange}
        onWeekShift={handleWeekShift}
        onOpenGroupPanel={() => setGroupPanelVisible(true)}
        getPopupContainer={getDesignerContainer}
        showDailyFocus={showDailyFocus}
        onDailyFocusToggle={handleDailyFocusToggle}
        showUnscheduledGroups={showUnscheduledGroups}
        onShowUnscheduledToggle={handleShowUnscheduledToggle}
        enabledTimeSlots={enabledTimeSlots}
        onTimeSlotToggle={handleTimeSlotToggle}
        timeSlots={timeSlots}
        onOpenPlanningImport={openPlanningImportModal}
        onOpenPlanningExport={openPlanningExportModal}
      />

      <div className="itinerary-body">
        {/* 中央时间轴 */}
        <div className="itinerary-center">
        <div className="timeline-wrapper">
          {renderTimelineGrid()}
        </div>
      </div>
      </div>

      <GroupSelectorDrawer
        open={groupPanelVisible}
        onClose={() => setGroupPanelVisible(false)}
        groups={groups}
        selectedGroups={selectedGroups}
        onChangeSelectedGroups={setSelectedGroups}
      />

      <GroupConsoleDrawer
        open={groupCalendarVisible}
        onClose={() => setGroupCalendarVisible(false)}
        heightVh={groupCalendarHeight}
        resizing={groupCalendarResizing}
        onResizeStart={handleGroupCalendarResizeStart}
        getContainer={getDesignerContainer}
        group={groupCalendarGroup}
        groupConsoleTypeLabel={groupConsoleTypeLabel}
        groupConsoleUnassignedMustVisitCards={groupConsoleUnassignedMustVisitCards}
        groupConsoleMustVisitCards={groupConsoleMustVisitCards}
        groupConsoleMustVisitMode={groupConsoleMustVisitMode}
        groupConsoleActivePlan={groupConsoleActivePlan}
        groupConsoleAssignedMustVisitCount={groupConsoleAssignedMustVisitCount}
        groupConsoleDates={groupConsoleDates}
        groupConsoleSchedule={groupConsoleSchedule}
        groupConsoleDropTarget={groupConsoleDropTarget}
        formatDateString={formatDateString}
        onCardDragStart={handleGroupConsoleCardDragStart}
        onCardDragEnd={handleGroupConsoleCardDragEnd}
        onClearSlot={handleGroupConsoleClearSlot}
        onOpenCalendarDetail={() => openGroupCalendarDetail(groupCalendarGroup.id)}
        onCellDragOver={handleGroupConsoleCellDragOver}
        onCellDragEnter={handleGroupConsoleCellDragEnter}
        onCellDragLeave={handleGroupConsoleCellDragLeave}
        onDrop={handleGroupConsoleDrop}
        onRemoveActivity={handleGroupConsoleRemoveActivity}
      />

      <GroupCalendarDetailModal
        open={groupCalendarDetailVisible}
        onClose={closeGroupCalendarDetail}
        topVh={groupCalendarDetailTop}
        heightVh={groupCalendarDetailHeight}
        getContainer={getDesignerContainer}
        overlayStyles={overlayStyles}
        group={groupCalendarDetailGroup}
        schedules={groupCalendarDetailSchedules}
        onUpdate={handleGroupCalendarDetailUpdate}
        onPushedToDesigner={() => refreshActivitiesOnly()}
        resourcesVisible={groupCalendarDetailResourcesVisible}
        setResourcesVisible={setGroupCalendarDetailResourcesVisible}
        loading={groupCalendarDetailLoading}
      />

      <SlotConflictModal
        conflictInfo={selectedSlotConflict}
        onClose={() => setSelectedSlotConflict(null)}
        getContainer={getDesignerContainer}
        overlayStyles={overlayStyles}
        getTimeSlotLabel={getTimeSlotLabel}
        onOpenEdit={handleOpenEditFromConflict}
        canOpenEdit={Boolean(selectedTimeSlot)}
      />

      <ActivityEditModal
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        selectedTimeSlot={selectedTimeSlot}
        timeSlots={timeSlots}
        getContainer={getDesignerContainer}
        overlayStyles={overlayStyles}
        groups={groups}
        selectedGroups={selectedGroups}
        locations={locations}
        onAddActivity={handleAddActivity}
        onUpdateActivity={handleUpdateActivity}
        onDeleteActivity={handleDeleteActivity}
      />

      
      
      <PlanningImportModal
        open={planningImportVisible}
        onClose={closePlanningImportModal}
        getContainer={getDesignerContainer}
        overlayStyles={overlayStyles}
        planningImportFileList={planningImportFileList}
        handlePlanningImportFile={handlePlanningImportFile}
        handlePlanningImportRemove={handlePlanningImportRemove}
        planningImportPayload={planningImportPayload}
        planningImportFile={planningImportFile}
        planningImportRange={planningImportRange}
        planningImportAssignmentsCount={planningImportAssignmentsCount}
        planningImportPayloadGroupIds={planningImportPayloadGroupIds}
        planningImportForm={planningImportForm}
        setPlanningImportValidatedKey={setPlanningImportValidatedKey}
        planningImportOnlySelectedValue={planningImportOnlySelectedValue}
        planningImportSelectedGroupIds={planningImportSelectedGroupIds}
        groups={groups}
        handlePlanningImportRollback={handlePlanningImportRollback}
        planningImportRollbackLoading={planningImportRollbackLoading}
        planningImportSnapshotToken={planningImportSnapshotToken}
        handlePlanningImportValidate={handlePlanningImportValidate}
        planningImportValidating={planningImportValidating}
        handlePlanningImportApply={handlePlanningImportApply}
        planningImportLoading={planningImportLoading}
        planningImportValidatedKey={planningImportValidatedKey}
        planningImportResult={planningImportResult}
        planningImportSummary={planningImportSummary}
        planningImportConflicts={planningImportConflicts}
        planningConflictActiveReason={planningConflictActiveReason}
        setPlanningConflictActiveReason={setPlanningConflictActiveReason}
        planningConflictRows={planningConflictRows}
        planningConflictBuckets={planningConflictBuckets}
        planningConflictManualOnly={planningConflictManualOnly}
        setPlanningConflictManualOnly={setPlanningConflictManualOnly}
        planningConflictTodayOnly={planningConflictTodayOnly}
        setPlanningConflictTodayOnly={setPlanningConflictTodayOnly}
        planningConflictTodayCount={planningConflictTodayCount}
        planningConflictSortBy={planningConflictSortBy}
        setPlanningConflictSortBy={setPlanningConflictSortBy}
        planningConflictTodayDate={planningConflictTodayDate}
        planningConflictFilteredRows={planningConflictFilteredRows}
      />


      <PlanningExportModal
        open={planningExportVisible}
        onClose={closePlanningExportModal}
        getContainer={getDesignerContainer}
        overlayStyles={overlayStyles}
        planningForm={planningForm}
        planningAvailableGroups={planningAvailableGroups}
        planningDateRange={planningDateRange}
        handlePlanningExport={handlePlanningExport}
        planningExportLoading={planningExportLoading}
        locations={activeLocations}
        mustVisitFixRef={planningMustVisitFixRef}
        planningMissingMustVisitGroupIds={planningMissingMustVisitGroupIds}
        planningMissingMustVisitGroups={planningBlockingMustVisitGroups}
        planningMustVisitFixGroups={planningMustVisitFixGroups}
        planningMustVisitDraftByGroupId={planningMustVisitDraftByGroupId}
        updatePlanningMustVisitDraft={updatePlanningMustVisitDraft}
        fillPlanningMustVisitFromPlan={fillPlanningMustVisitFromPlan}
        fillAllMissingMustVisitFromPlan={fillAllMissingMustVisitFromPlan}
      />

    </div>
  );
}

export default ItineraryDesigner;
