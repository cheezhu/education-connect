import { useCallback } from 'react';
import { getResourceId, parseShixingResourceId } from '../../../../domain/resourceId';
import {
  LEGACY_MEAL_TITLES,
  SHIXING_MEAL_DEFAULTS,
  SHIXING_MEAL_KEYS
} from '../../../../domain/shixingConfig';

const useCalendarDetailShixingSync = ({
  activities,
  logistics,
  groupStartDate,
  groupEndDate,
  onLogisticsUpdate
}) => {
  const buildShixingMealDrafts = useCallback((targetDate) => {
    const drafts = {};
    const logisticsRows = Array.isArray(logistics) ? logistics : [];
    const logisticsRow = logisticsRows.find((row) => row?.date === targetDate) || null;
    const meals = logisticsRow?.meals || {};

    const activityByMealKey = new Map();
    (activities || []).forEach((activity) => {
      const parsed = parseShixingResourceId(getResourceId(activity));
      if (!parsed || parsed.category !== 'meal' || !parsed.key) return;
      if (parsed.date !== targetDate) return;
      activityByMealKey.set(parsed.key, activity);
    });

    SHIXING_MEAL_KEYS.forEach((key) => {
      const matchedActivity = activityByMealKey.get(key);
      const defaults = SHIXING_MEAL_DEFAULTS[key] || {};
      const title = matchedActivity?.title || '';
      const description = matchedActivity?.description || '';
      const normalizedTitle = typeof title === 'string' ? title.trim() : '';
      const normalizedDescription = typeof description === 'string' ? description.trim() : '';
      const planText = (
        normalizedTitle && !LEGACY_MEAL_TITLES.has(normalizedTitle)
      )
        ? normalizedTitle
        : (normalizedDescription || normalizedTitle || meals[key] || '');
      drafts[key] = {
        disabled: matchedActivity ? false : Boolean(meals[`${key}_disabled`]),
        plan: planText,
        place: matchedActivity?.location || meals[`${key}_place`] || '',
        startTime: matchedActivity?.startTime || meals[`${key}_time`] || defaults.start || '',
        endTime: matchedActivity?.endTime || meals[`${key}_end`] || defaults.end || ''
      };
    });

    return drafts;
  }, [activities, logistics]);

  const buildShixingTransferDrafts = useCallback((targetDate) => {
    const logisticsRows = Array.isArray(logistics) ? logistics : [];
    const logisticsRow = logisticsRows.find((row) => row?.date === targetDate) || null;
    const pickup = logisticsRow?.pickup || {};
    const dropoff = logisticsRow?.dropoff || {};
    const activityByCategory = new Map();

    (activities || []).forEach((item) => {
      const parsed = parseShixingResourceId(getResourceId(item));
      if (!parsed) return;
      if ((parsed.category !== 'pickup' && parsed.category !== 'dropoff') || parsed.date !== targetDate) return;
      activityByCategory.set(parsed.category, item);
    });

    const buildDraft = (category, base) => {
      const event = activityByCategory.get(category);
      const fallbackFlightSummary = [
        base?.flight_no && `航班 ${base.flight_no}`,
        base?.airline,
        base?.terminal
      ].filter(Boolean).join(' / ');
      const eventDescription = (event?.description || '').trim();
      const note = event
        ? (eventDescription && eventDescription !== fallbackFlightSummary ? eventDescription : (base?.note || ''))
        : (base?.note || '');
      return {
        disabled: Boolean(base?.disabled),
        startTime: event?.startTime || base?.time || '',
        endTime: event?.endTime || base?.end_time || '',
        location: event?.location || base?.location || '',
        contact: base?.contact || '',
        flightNo: base?.flight_no || '',
        airline: base?.airline || '',
        terminal: base?.terminal || '',
        note
      };
    };

    return {
      pickup: buildDraft('pickup', pickup),
      dropoff: buildDraft('dropoff', dropoff)
    };
  }, [activities, logistics]);

  const hasTransferDraftContent = useCallback((transfer = {}) => (
    Boolean(
      transfer.location
      || transfer.contact
      || transfer.flightNo
      || transfer.flight_no
      || transfer.airline
      || transfer.terminal
      || transfer.startTime
      || transfer.time
      || transfer.endTime
      || transfer.end_time
    )
  ), []);

  const buildTransferDescription = useCallback((transfer = {}) => {
    const note = (transfer.note || transfer.remark || '').trim();
    if (note) return note;
    return [
      transfer.flightNo && `航班 ${transfer.flightNo}`,
      transfer.airline,
      transfer.terminal
    ].filter(Boolean).join(' / ');
  }, []);

  const resolveTransferTypeForDate = useCallback((date, fallback = 'pickup') => {
    if (!date) return null;
    const isStart = Boolean(groupStartDate && date === groupStartDate);
    const isEnd = Boolean(groupEndDate && date === groupEndDate);
    if (isStart && !isEnd) return 'pickup';
    if (isEnd && !isStart) return 'dropoff';
    if (isStart && isEnd) {
      return fallback === 'dropoff' ? 'dropoff' : 'pickup';
    }
    return null;
  }, [groupStartDate, groupEndDate]);

  const applyMealDraftsToLogistics = useCallback((targetDate, mealDrafts) => {
    if (!targetDate || !mealDrafts || typeof mealDrafts !== 'object') return;
    const logisticsRows = Array.isArray(logistics) ? logistics : [];
    const existingIndex = logisticsRows.findIndex((row) => row?.date === targetDate);
    const baseRow = existingIndex >= 0 ? logisticsRows[existingIndex] : { date: targetDate };
    const nextMeals = { ...(baseRow.meals || {}) };

    SHIXING_MEAL_KEYS.forEach((key) => {
      const row = mealDrafts[key] || {};
      const defaults = SHIXING_MEAL_DEFAULTS[key] || {};
      const disabled = Boolean(row.disabled);
      const plan = (row.plan || '').trim();
      const place = (row.place || '').trim();
      nextMeals[key] = disabled ? '' : plan;
      nextMeals[`${key}_place`] = disabled ? '' : place;
      nextMeals[`${key}_disabled`] = disabled;
      nextMeals[`${key}_time`] = disabled ? '' : (row.startTime || defaults.start || '');
      nextMeals[`${key}_end`] = disabled ? '' : (row.endTime || defaults.end || '');
      nextMeals[`${key}_detached`] = false;
    });

    const nextRow = {
      ...baseRow,
      date: targetDate,
      meals: nextMeals
    };
    const nextLogistics = [...logisticsRows];
    if (existingIndex >= 0) {
      nextLogistics[existingIndex] = nextRow;
    } else {
      nextLogistics.push(nextRow);
    }
    onLogisticsUpdate?.(nextLogistics);
  }, [logistics, onLogisticsUpdate]);

  const applyTransferDraftToLogistics = useCallback((targetDate, transferType, transferDraft) => {
    if (!targetDate || !transferType || !transferDraft) return;
    const key = transferType === 'dropoff' ? 'dropoff' : 'pickup';
    const logisticsRows = Array.isArray(logistics) ? logistics : [];
    const existingIndex = logisticsRows.findIndex((row) => row?.date === targetDate);
    const baseRow = existingIndex >= 0 ? logisticsRows[existingIndex] : { date: targetDate };
    const current = baseRow[key] || {};
    const nextTransfer = {
      ...current,
      time: transferDraft.startTime || '',
      end_time: transferDraft.endTime || '',
      location: transferDraft.location || '',
      contact: transferDraft.contact || '',
      flight_no: transferDraft.flightNo || '',
      airline: transferDraft.airline || '',
      terminal: transferDraft.terminal || '',
      note: transferDraft.note || '',
      disabled: Boolean(transferDraft.disabled),
      detached: false
    };

    const nextRow = {
      ...baseRow,
      date: targetDate,
      [key]: nextTransfer
    };

    const nextLogistics = [...logisticsRows];
    if (existingIndex >= 0) {
      nextLogistics[existingIndex] = nextRow;
    } else {
      nextLogistics.push(nextRow);
    }
    onLogisticsUpdate?.(nextLogistics);
  }, [logistics, onLogisticsUpdate]);

  return {
    buildShixingMealDrafts,
    buildShixingTransferDrafts,
    hasTransferDraftContent,
    buildTransferDescription,
    resolveTransferTypeForDate,
    applyMealDraftsToLogistics,
    applyTransferDraftToLogistics
  };
};

export default useCalendarDetailShixingSync;
