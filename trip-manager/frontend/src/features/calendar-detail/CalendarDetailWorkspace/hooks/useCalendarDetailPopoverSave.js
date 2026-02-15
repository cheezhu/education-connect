import { useCallback } from 'react';
import message from 'antd/es/message';
import dayjs from 'dayjs';
import { buildClientId } from '../utils/clientId';
import { hashString } from '../utils/hash';
import { calcDurationMinutes } from '../utils/time';
import {
  buildShixingResourceId,
  getResourceId,
  isCustomResourceId,
  isPlanResourceId,
  isShixingResourceId
} from '../../../../domain/resourceId';
import {
  SHIXING_MEAL_DEFAULTS,
  SHIXING_MEAL_KEYS,
  SHIXING_MEAL_LABELS,
  SHIXING_TRANSFER_LABELS
} from '../../../../domain/shixingConfig';
import { CALENDAR_DETAIL_MESSAGES } from '../../messages';

const useCalendarDetailPopoverSave = ({
  activities,
  setActivities,
  onUpdate,
  groupId,
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
}) => {
  const resolveStartEndTimes = useCallback((payload) => {
    const fallbackStart = selectedSlot?.time || '09:00';
    const normalizedStart = payload.startTime || fallbackStart;
    const normalizedEnd = payload.endTime || dayjs(`2025-01-01 ${normalizedStart}`, 'YYYY-MM-DD HH:mm')
      .add(1, 'hour')
      .format('HH:mm');

    return { startTime: normalizedStart, endTime: normalizedEnd };
  }, [selectedSlot?.time]);

  const handleSaveFromPopover = useCallback((baseActivity, payload) => {
    if (!payload) return false;

    const targetDate = baseActivity?.date || selectedSlot?.date;
    if (!targetDate) {
      message.error(CALENDAR_DETAIL_MESSAGES.selectDateFirst);
      return false;
    }

    const { startTime, endTime } = resolveStartEndTimes(payload);

    if (timeToGridRow(endTime) <= timeToGridRow(startTime)) {
      message.error(CALENDAR_DETAIL_MESSAGES.endBeforeStart);
      return false;
    }

    if (payload.sourceCategory === 'meal' && payload.shixingMeals) {
      const effectiveDate = payload.date || targetDate;
      if (!effectiveDate) {
        message.error(CALENDAR_DETAIL_MESSAGES.selectDate);
        return false;
      }

      const mealResourceIds = SHIXING_MEAL_KEYS.map((key) => (
        buildShixingResourceId(effectiveDate, 'meal', key)
      ));
      const existingMealsByResource = new Map(
        (activities || [])
          .filter((activity) => mealResourceIds.includes(getResourceId(activity)))
          .map((activity) => [getResourceId(activity), activity])
      );
      const baseActivityIdentity = getActivityIdentity(baseActivity);
      const baseActivities = (activities || []).filter((activity) => {
        const identity = getActivityIdentity(activity);
        if (baseActivityIdentity && identity === baseActivityIdentity) return false;
        return !mealResourceIds.includes(getResourceId(activity));
      });

      const createdMeals = [];
      for (const key of SHIXING_MEAL_KEYS) {
        const draft = payload.shixingMeals[key] || {};
        const isDisabled = Boolean(draft.disabled);
        const plan = (draft.plan || '').trim();
        const place = (draft.place || '').trim();
        if (isDisabled || (!plan && !place)) {
          continue;
        }
        const defaults = SHIXING_MEAL_DEFAULTS[key] || {};
        const rowStart = draft.startTime || defaults.start;
        const rowEnd = draft.endTime || defaults.end;
        if (!rowStart || !rowEnd || timeToGridRow(rowEnd) <= timeToGridRow(rowStart)) {
          message.error(CALENDAR_DETAIL_MESSAGES.mealRangeInvalid(SHIXING_MEAL_LABELS[key]));
          return false;
        }
        const resourceId = buildShixingResourceId(effectiveDate, 'meal', key);
        const existingMeal = existingMealsByResource.get(resourceId);
        createdMeals.push({
          ...existingMeal,
          id: existingMeal?.id ?? null,
          clientId: existingMeal?.clientId ?? buildClientId(),
          groupId,
          date: effectiveDate,
          startTime: rowStart,
          endTime: rowEnd,
          type: 'meal',
          title: plan || SHIXING_MEAL_LABELS[key],
          location: place,
          description: '',
          locationId: null,
          locationColor: null,
          color: payload.color || activityTypes.meal?.color || '#52c41a',
          resourceId,
          planItemId: null,
          isFromResource: true
        });
      }

      const updatedActivities = [...baseActivities, ...createdMeals];
      setActivities(updatedActivities);
      setSaveStatus('saving');
      onUpdate?.(updatedActivities);
      applyMealDraftsToLogistics(effectiveDate, payload.shixingMeals);

      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saved');
        message.success(CALENDAR_DETAIL_MESSAGES.mealsSynced, 1);
      }, 500);
      return true;
    }

    if (payload.sourceCategory === 'transfer' && payload.shixingTransfer) {
      const effectiveDate = payload.date || targetDate;
      if (!effectiveDate) {
        message.error(CALENDAR_DETAIL_MESSAGES.selectDate);
        return false;
      }
      const requestedType = payload.shixingTransferType === 'dropoff' ? 'dropoff' : 'pickup';
      const transferType = resolveTransferTypeForDate(effectiveDate, requestedType);
      if (!transferType) {
        message.warning(CALENDAR_DETAIL_MESSAGES.transferDateRestricted);
        return false;
      }
      const transferLabel = SHIXING_TRANSFER_LABELS[transferType];
      const transferDraft = payload.shixingTransfer || {};
      const resourceId = buildShixingResourceId(effectiveDate, transferType);
      const baseActivityIdentity = getActivityIdentity(baseActivity);
      const start = transferDraft.startTime || transferDraft.time || '';
      let end = transferDraft.endTime || transferDraft.end_time || '';
      if (start && !end) {
        end = dayjs(`2025-01-01 ${start}`, 'YYYY-MM-DD HH:mm').add(1, 'hour').format('HH:mm');
      }
      if (!transferDraft.disabled && start && end && timeToGridRow(end) <= timeToGridRow(start)) {
        message.error(CALENDAR_DETAIL_MESSAGES.endBeforeStart);
        return false;
      }

      const baseActivities = (activities || []).filter((item) => {
        if (getResourceId(item) === resourceId) return false;
        if (baseActivityIdentity && getActivityIdentity(item) === baseActivityIdentity) return false;
        return true;
      });

      let updatedActivities = baseActivities;
      if (!transferDraft.disabled && hasTransferDraftContent(transferDraft)) {
        const transferDescription = buildTransferDescription(transferDraft);
        const nextActivity = {
          ...baseActivity,
          id: baseActivity?.id ?? null,
          clientId: baseActivity?.clientId ?? buildClientId(),
          groupId,
          date: effectiveDate,
          startTime: start || selectedSlot?.time || '09:00',
          endTime: end || dayjs(`2025-01-01 ${start || '09:00'}`, 'YYYY-MM-DD HH:mm').add(1, 'hour').format('HH:mm'),
          type: 'transport',
          title: transferLabel,
          location: transferDraft.location || transferLabel,
          description: transferDescription || '',
          locationId: null,
          locationColor: null,
          color: payload.color || baseActivity?.color || activityTypes.transport?.color || '#fa8c16',
          resourceId,
          planItemId: null,
          isFromResource: true
        };
        updatedActivities = [...baseActivities, nextActivity];
      }

      setActivities(updatedActivities);
      setSaveStatus('saving');
      onUpdate?.(updatedActivities);
      applyTransferDraftToLogistics(effectiveDate, transferType, {
        ...transferDraft,
        startTime: start,
        endTime: end
      });

      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saved');
        message.success(CALENDAR_DETAIL_MESSAGES.transferSynced(transferLabel), 1);
      }, 500);
      return true;
    }

    let resolvedTitle = payload.title || baseActivity?.title || '';
    let resolvedLocation = payload.location || baseActivity?.location || '';
    let resolvedDescription = payload.description ?? baseActivity?.description ?? '';
    let resolvedColor = payload.color || baseActivity?.color || '';
    let resolvedLocationId = baseActivity?.locationId ?? null;
    let resolvedLocationColor = baseActivity?.locationColor ?? null;
    let resolvedResourceId = baseActivity?.resourceId ?? baseActivity?.resource_id ?? null;
    let resolvedPlanItemId = baseActivity?.planItemId ?? null;
    let isFromResource = baseActivity?.isFromResource ?? false;

    if (payload.planItemId) {
      const planResource = planResources.find(
        (resource) => String(resource.id) === String(payload.planItemId)
      );
      if (!planResource) {
        message.error(CALENDAR_DETAIL_MESSAGES.selectPlanPoint);
        return false;
      }
      resolvedTitle = planResource.title || resolvedTitle;
      resolvedLocation = planResource.locationName || planResource.title || resolvedLocation;
      resolvedLocationId = planResource.locationId || null;
      resolvedLocationColor = planResource.locationColor || null;
      resolvedResourceId = planResource.id;
      resolvedPlanItemId = planResource.id;
      isFromResource = true;
    } else if (isPlanResourceId(resolvedResourceId)) {
      resolvedResourceId = null;
      resolvedPlanItemId = null;
      isFromResource = false;
    }

    const resourceIdStr = typeof resolvedResourceId === 'string' ? resolvedResourceId : '';
    const isShixingResource = isShixingResourceId(resourceIdStr);
    const isPlanResource = isPlanResourceId(resourceIdStr);
    const isCustomResource = isCustomResourceId(resourceIdStr);
    if (!isShixingResource && !isPlanResource) {
      if (!resourceIdStr) {
        const typeKey = payload.type || baseActivity?.type || 'activity';
        const durationMinutes = calcDurationMinutes(startTime, endTime, 60);
        const titleKey = resolvedTitle || resolvedLocation || 'Custom Activity';
        const hash = hashString(`${typeKey}|${titleKey}|${durationMinutes}`);
        resolvedResourceId = `custom:${hash}`;
        isFromResource = true;
      } else if (isCustomResource) {
        isFromResource = true;
      }
    }

    const computedColor = resolveActivityColor({
      type: payload.type || baseActivity?.type || 'visit',
      locationId: resolvedLocationId,
      locationColor: resolvedLocationColor
    });
    if (!resolvedColor) {
      resolvedColor = computedColor;
    }

    const activityData = {
      ...baseActivity,
      id: baseActivity?.id ?? null,
      clientId: baseActivity?.clientId ?? buildClientId(),
      groupId,
      date: targetDate,
      startTime,
      endTime,
      type: payload.type || baseActivity?.type || 'visit',
      title: resolvedTitle,
      location: resolvedLocation,
      description: resolvedDescription,
      locationId: resolvedLocationId,
      locationColor: resolvedLocationColor,
      color: resolvedColor,
      resourceId: resolvedResourceId,
      planItemId: resolvedPlanItemId,
      isFromResource
    };

    let updatedActivities;
    if (baseActivity) {
      updatedActivities = activities.map((activity) =>
        getActivityIdentity(activity) === getActivityIdentity(baseActivity) ? activityData : activity
      );
    } else {
      updatedActivities = [...activities, activityData];
    }

    setActivities(updatedActivities);
    setSaveStatus('saving');
    onUpdate?.(updatedActivities);

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      message.success(CALENDAR_DETAIL_MESSAGES.saveActivityResult(Boolean(baseActivity)), 1);
    }, 500);
    return true;
  }, [
    selectedSlot?.date,
    selectedSlot?.time,
    resolveStartEndTimes,
    timeToGridRow,
    activities,
    getActivityIdentity,
    groupId,
    setActivities,
    setSaveStatus,
    onUpdate,
    applyMealDraftsToLogistics,
    saveTimeoutRef,
    resolveTransferTypeForDate,
    hasTransferDraftContent,
    buildTransferDescription,
    activityTypes.meal,
    activityTypes.transport,
    applyTransferDraftToLogistics,
    planResources,
    resolveActivityColor
  ]);

  return {
    handleSaveFromPopover
  };
};

export default useCalendarDetailPopoverSave;

