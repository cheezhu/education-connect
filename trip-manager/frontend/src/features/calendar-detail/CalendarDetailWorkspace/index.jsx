
import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import Modal from 'antd/es/modal';
import message from 'antd/es/message';
import dayjs from 'dayjs';
import { useAuth } from '../../../hooks/useAuth';
import CalendarDetailTimeGrid from './components/CalendarDetailTimeGrid';
import CalendarDetailSidebar from './components/CalendarDetailSidebar';
import CalendarDetailResourceLibrary from './components/CalendarDetailResourceLibrary';
import CalendarDetailEventEditorPopover from './components/CalendarDetailEventEditorPopover';
import CalendarDetailEventChip from './components/CalendarDetailEventChip';
import CalendarDetailRangeToolbar from './components/CalendarDetailRangeToolbar';
import CalendarDetailSkeleton from './CalendarDetailSkeleton';
import useCalendarDetailShixingResources from './hooks/useCalendarDetailShixingResources';
import useCalendarDetailDesignerSync from './hooks/useCalendarDetailDesignerSync';
import useCalendarDetailMustVisitPool from './hooks/useCalendarDetailMustVisitPool';
import useCalendarWindowPaging from './hooks/useCalendarWindowPaging';
import useCalendarDetailShixingSync from './hooks/useCalendarDetailShixingSync';
import useCalendarDetailReferenceData from './hooks/useCalendarDetailReferenceData';
import useCalendarDetailResize from './hooks/useCalendarDetailResize';
import useCalendarDetailDragDrop from './hooks/useCalendarDetailDragDrop';
import useCalendarDetailPopoverState from './hooks/useCalendarDetailPopoverState';
import useCalendarDetailPopoverSave from './hooks/useCalendarDetailPopoverSave';
import useCalendarDetailCustomResources from './hooks/useCalendarDetailCustomResources';
import useCalendarDetailConflictCheck from './hooks/useCalendarDetailConflictCheck';
import useCalendarDetailActivityMeta from './hooks/useCalendarDetailActivityMeta';
import { CALENDAR_DETAIL_MESSAGES } from '../messages';
import { CALENDAR_ACTIVITY_TYPES } from '../constants';
import '../CalendarDetail.css';
import './styles.css';

const START_HOUR = 6;
const END_HOUR = 20;
const SLOT_MINUTES = 15;
const HEADER_HEIGHT = 30;
const SLOT_HEIGHT = 10;
const MIN_SLOT_HEIGHT = 8;
const SLOTS_PER_HOUR = Math.max(1, Math.round(60 / SLOT_MINUTES));

const DEFAULT_PLAN_DURATION = 2;
const MAX_FULL_DAYS = 9;
const DEFAULT_WINDOW_DAYS = 7;

const CalendarDetailWorkspace = ({
  groupData,
  schedules = [],
  onUpdate,
  onLogisticsUpdate,
  onPlanChange,
  onPushedToDesigner,
  onCustomResourcesChange,
  showResources = true,
  resourceWidth,
  loading = false
}) => {
  const [activities, setActivities] = useState(schedules);
  const [, setSaveStatus] = useState('saved');
  const saveTimeoutRef = useRef(null);
  const calendarRef = useRef(null);
  const scrollWrapperRef = useRef(null);
  const [slotHeight, setSlotHeight] = useState(SLOT_HEIGHT);

  const resourcePanelStyle = resourceWidth ? { width: resourceWidth } : undefined;
  const groupId = groupData?.id ?? null;
  const {
    itineraryPlans,
    locations,
    selectedPlanId,
    setSelectedPlanId
  } = useCalendarDetailReferenceData(groupData);

  const { canAccess } = useAuth();
  const canSyncDesigner = canAccess?.('designer', 'write');

  useEffect(() => {
    setActivities(schedules || []);
  }, [groupData?.id, schedules]);

  const isLocationSchedule = useCallback((schedule) => {
    const locationId = Number(schedule?.locationId ?? schedule?.location_id);
    return Number.isFinite(locationId) && locationId > 0;
  }, []);

  const handleResetSchedules = () => {
    Modal.confirm({
      title: CALENDAR_DETAIL_MESSAGES.resetTitle,
      content: CALENDAR_DETAIL_MESSAGES.resetContent,
      okText: CALENDAR_DETAIL_MESSAGES.resetOkText,
      cancelText: CALENDAR_DETAIL_MESSAGES.resetCancelText,
      okButtonProps: { danger: true },
      onOk: () => {
        setActivities([]);
        onUpdate?.([]);
        message.success(CALENDAR_DETAIL_MESSAGES.resetSuccess, 1);
      }
    });
  };

  const {
    designerSourceState,
    pullingFromDesigner,
    pushingToDesigner,
    pullFromDesigner: handlePullFromDesigner,
    pushToDesigner: handlePushToDesigner
  } = useCalendarDetailDesignerSync({
    groupId,
    canSyncDesigner,
    activities,
    setActivities,
    isLocationSchedule,
    onUpdate,
    onPushedToDesigner
  });

  const {
    planResources,
    availablePlanResources,
    setAvailablePlanResources
  } = useCalendarDetailMustVisitPool({
    selectedPlanId,
    itineraryPlans,
    designerSourceList: designerSourceState.list,
    manualMustVisitLocationIds: groupData?.manual_must_visit_location_ids,
    locations,
    activities,
    schedules
  });

  const activityTypes = CALENDAR_ACTIVITY_TYPES;

  const { resolveActivityColor, getActivityIdentity } = useCalendarDetailActivityMeta({ locations });

  const {
    days,
    timeSlots,
    viewSpan,
    hasPaging,
    maxViewStartIndex,
    windowStartIndex,
    visibleDays,
    setWindowToIncludeDate,
    handleJumpPrevDay,
    handleJumpNextDay,
    handleJumpPrevChunk,
    handleJumpNextChunk
  } = useCalendarWindowPaging({
    groupId: groupData?.id,
    startDate: groupData?.start_date,
    endDate: groupData?.end_date,
    startHour: START_HOUR,
    endHour: END_HOUR,
    slotMinutes: SLOT_MINUTES,
    defaultWindowDays: DEFAULT_WINDOW_DAYS,
    maxFullDays: MAX_FULL_DAYS
  });

  const shixingCardResources = useCalendarDetailShixingResources({ groupData, activities });
  const {
    buildShixingMealDrafts,
    buildShixingTransferDrafts,
    hasTransferDraftContent,
    buildTransferDescription,
    resolveTransferTypeForDate,
    applyMealDraftsToLogistics,
    applyTransferDraftToLogistics
  } = useCalendarDetailShixingSync({
    activities,
    logistics: groupData?.logistics,
    groupStartDate: groupData?.start_date,
    groupEndDate: groupData?.end_date,
    onLogisticsUpdate
  });

  const { availableCustomResources, handleDeleteCustomResource } = useCalendarDetailCustomResources({
    customResourcesInput: groupData?.customResources,
    activities,
    onCustomResourcesChange
  });

  useLayoutEffect(() => {
    const wrapper = scrollWrapperRef.current;
    if (!wrapper || !timeSlots.length) return;

    let frame = null;
    const updateSlotHeight = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = wrapper.clientHeight;
        if (!height) return;
        const available = Math.max(0, height - HEADER_HEIGHT);
        if (!available) return;
        const rawHeight = available / timeSlots.length;
        const nextHeight = Math.max(MIN_SLOT_HEIGHT, rawHeight);
        setSlotHeight(prev => (Math.abs(prev - nextHeight) < 0.1 ? prev : nextHeight));
      });
    };

    updateSlotHeight();

    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateSlotHeight);
      observer.observe(wrapper);
    }
    window.addEventListener('resize', updateSlotHeight);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateSlotHeight);
      if (observer) observer.disconnect();
    };
  }, [timeSlots.length]);

  const timeToGridRow = (time) => {
    const [hour, minute] = time.split(':').map(Number);
    const totalMinutes = (hour - START_HOUR) * 60 + minute;
    const slotIndex = Math.max(0, Math.round(totalMinutes / SLOT_MINUTES));
    return slotIndex + 2;
  };

  const gridRowToTime = (row) => {
    const totalMinutes = (row - 2) * SLOT_MINUTES;
    const hour = Math.floor(totalMinutes / 60) + START_HOUR;
    const minute = totalMinutes % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const {
    resizingActivity,
    isResizing,
    handleResizeStart
  } = useCalendarDetailResize({
    activities,
    setActivities,
    calendarRef,
    slotHeight,
    timeSlots,
    headerHeight: HEADER_HEIGHT,
    timeToGridRow,
    getActivityIdentity,
    onUpdate,
    setSaveStatus,
    saveTimeoutRef
  });

  const {
    draggedActivity,
    draggedResource,
    dropIndicator,
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleEventChipDragOver,
    handleEventChipDrop,
    handleResourceDrop,
    handleResourceDragStart,
    handleResourceDragEnd
  } = useCalendarDetailDragDrop({
    activities,
    setActivities,
    onUpdate,
    groupId: groupData?.id,
    timeSlots,
    slotMinutes: SLOT_MINUTES,
    slotHeight,
    headerHeight: HEADER_HEIGHT,
    calendarRef,
    visibleDays,
    timeToGridRow,
    gridRowToTime,
    getActivityIdentity,
    resolveActivityColor,
    planResources,
    setAvailablePlanResources,
    setSaveStatus,
    saveTimeoutRef
  });

  const {
    selectedSlot,
    popoverState,
    handleSlotClick,
    handleActivityClick,
    handleActivityContextMenu,
    closePopover
  } = useCalendarDetailPopoverState({
    isDragging,
    isResizing,
    buildShixingMealDrafts,
    buildShixingTransferDrafts
  });

  const { handleCheckConflicts } = useCalendarDetailConflictCheck({
    activities,
    timeToGridRow
  });

  const { handleSaveFromPopover } = useCalendarDetailPopoverSave({
    activities,
    setActivities,
    onUpdate,
    groupId: groupData?.id,
    selectedSlot,
    planResources,
    activityTypes,
    getActivityIdentity,
    timeToGridRow,
    resolveActivityColor,
    applyMealDraftsToLogistics,
    applyTransferDraftToLogistics,
    resolveTransferTypeForDate,
    hasTransferDraftContent,
    buildTransferDescription,
    saveTimeoutRef,
    setSaveStatus
  });

  const handleDeleteActivity = (activityId) => {
    const updatedActivities = activities.filter(activity => getActivityIdentity(activity) !== activityId);
    setActivities(updatedActivities);

    setSaveStatus('saving');
    onUpdate?.(updatedActivities);

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      message.success(CALENDAR_DETAIL_MESSAGES.activityDeletedAndSaved, 1);
    }, 500);
  };

  const renderActivity = (activity, dayIndex) => {
    const isDragged = getActivityIdentity(draggedActivity) === getActivityIdentity(activity);
    const activityColor = activity.color || resolveActivityColor({
      type: activity.type,
      locationId: activity.locationId,
      locationColor: activity.locationColor
    });

    const startRow = timeToGridRow(activity.startTime);
    const endRow = timeToGridRow(activity.endTime);

    const durationRows = Math.max(1, endRow - startRow);
    const style = {
      gridColumn: dayIndex + 2,
      gridRow: `${startRow} / ${endRow}`,
      zIndex: isDragged ? 1 : 20,
      '--activity-height': `${durationRows * slotHeight}px`,
      backgroundColor: activityColor
    };

    return (
      <CalendarDetailEventChip
        key={getActivityIdentity(activity)}
        activity={activity}
        style={style}
        isDragged={isDragged}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={(event) => handleEventChipDragOver(event, activity.date)}
        onDrop={(event) => handleEventChipDrop(event, activity.date, activity.startTime)}
        onClick={handleActivityClick}
        onContextMenu={handleActivityContextMenu}
        onResizeStart={handleResizeStart}
        isResizing={getActivityIdentity(resizingActivity) === getActivityIdentity(activity)}
      />
    );
  };

  const handleAutoPlan = () => {
    message.info(CALENDAR_DETAIL_MESSAGES.aiAutoPlanPending);
  };

  const handleOptimizeRoute = () => {
    message.info(CALENDAR_DETAIL_MESSAGES.aiOptimizePending);
  };

  const sidebarWidth = resourcePanelStyle?.width ?? 260;

  if (loading) {
    return (
      <CalendarDetailSkeleton
        showResources={showResources}
        resourceWidth={sidebarWidth}
      />
    );
  }

  const locationScheduleCount = (activities || []).filter(isLocationSchedule).length;

  const resourcePane = (
    <CalendarDetailResourceLibrary
      loading={loading}
      canSyncDesigner={canSyncDesigner}
      designerSourceState={designerSourceState}
      pullingFromDesigner={pullingFromDesigner}
      pushingToDesigner={pushingToDesigner}
      locationScheduleCount={locationScheduleCount}
      onPullFromDesigner={handlePullFromDesigner}
      onPushToDesigner={handlePushToDesigner}
      onResetSchedules={handleResetSchedules}
      availablePlanResources={availablePlanResources}
      shixingCardResources={shixingCardResources}
      availableCustomResources={availableCustomResources}
      activityTypes={activityTypes}
      onResourceDragStart={handleResourceDragStart}
      onResourceDragEnd={handleResourceDragEnd}
      onDeleteCustomResource={handleDeleteCustomResource}
    />
  );

  if (!groupData) {
    return <div className="calendar-empty">{CALENDAR_DETAIL_MESSAGES.emptyGroupHint}</div>;
  }

  const atWindowStart = hasPaging && windowStartIndex <= 0;
  const atWindowEnd = hasPaging && windowStartIndex >= maxViewStartIndex;
  const windowStartLabel = visibleDays[0]?.dateStr || '';
  const windowEndLabel = visibleDays[visibleDays.length - 1]?.dateStr || '';

  const startDay = groupData?.start_date ? dayjs(groupData.start_date) : null;
  const endDay = groupData?.end_date ? dayjs(groupData.end_date) : null;
  const disableJumpDate = (current) => {
    if (!current || !startDay || !endDay) return false;
    return current.isBefore(startDay.startOf('day')) || current.isAfter(endDay.endOf('day'));
  };

  return (
    <div
      className={`calendar-days-view calendar-workshop${showResources ? '' : ' calendar-only'}`}
      ref={calendarRef}
      style={{ '--slot-height': `${slotHeight}px` }}
    >
      <div className={`calendar-layout${showResources ? '' : ' calendar-only'}`}>
        <div className="calendar-container">
          <CalendarDetailRangeToolbar
            visible={hasPaging}
            atWindowStart={atWindowStart}
            atWindowEnd={atWindowEnd}
            windowStartLabel={windowStartLabel}
            windowEndLabel={windowEndLabel}
            windowStartIndex={windowStartIndex}
            visibleDaysCount={visibleDays.length}
            totalDays={days.length}
            onJumpPrevChunk={handleJumpPrevChunk}
            onJumpPrevDay={handleJumpPrevDay}
            onJumpNextDay={handleJumpNextDay}
            onJumpNextChunk={handleJumpNextChunk}
            disableJumpDate={disableJumpDate}
            onPickDate={setWindowToIncludeDate}
          />
          <div className="calendar-scroll-wrapper" ref={scrollWrapperRef}>
            <CalendarDetailTimeGrid
              days={visibleDays}
              timeSlots={timeSlots}
              slotHeight={slotHeight}
              slotsPerHour={SLOTS_PER_HOUR}
              activities={activities}
              onSlotClick={handleSlotClick}
              onSlotDrop={handleDrop}
              onSlotDragOver={handleDragOver}
              onSlotDragEnter={handleDragEnter}
              onSlotDragLeave={handleDragLeave}
              renderActivity={renderActivity}
              dropIndicator={dropIndicator}
              isDragging={isDragging}
            />
          </div>
        </div>

        <CalendarDetailSidebar
          width={sidebarWidth}
          resourcePane={resourcePane}
          aiProps={{
            onAutoPlan: handleAutoPlan,
            onOptimizeRoute: handleOptimizeRoute,
            onCheckConflicts: handleCheckConflicts,
            onClearPlan: handleResetSchedules,
            onSend: (text) => message.info(CALENDAR_DETAIL_MESSAGES.aiPromptReceived(text))
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={handleResourceDrop}
          show={showResources}
        />

        <CalendarDetailEventEditorPopover
          anchorRect={popoverState.anchorRect}
          isOpen={popoverState.isOpen}
          mode={popoverState.mode}
          activity={popoverState.activity}
          groupStartDate={groupData?.start_date}
          groupEndDate={groupData?.end_date}
          planItems={planResources}
          initialValues={popoverState.initialValues}
          onSave={(payload) => {
            const saved = handleSaveFromPopover(popoverState.activity, payload);
            if (saved) {
              closePopover();
            }
          }}
          onDelete={(activity) => {
            handleDeleteActivity(getActivityIdentity(activity));
            closePopover();
          }}
          onClose={closePopover}
        />
      </div>
    </div>
  );
};

export default CalendarDetailWorkspace;

