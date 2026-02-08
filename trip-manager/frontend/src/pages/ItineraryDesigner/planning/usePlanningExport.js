import { Form, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';

import { triggerDownload } from './planningIO';
import { formatDateString } from '../shared/dates';
import { extractPlanLocationIds, normalizeManualMustVisitLocationIds } from '../shared/groupRules';
import { getRequestErrorMessage } from '../shared/messages';

const normalizeLocationIdArray = (value) => (
  Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map(item => Number(item))
      .filter(id => Number.isFinite(id) && id > 0)
  ))
);

export default function usePlanningExport({
  api,
  groups,
  setGroups,
  locations,
  itineraryPlanById,
  selectedGroups,
  dateRange
}) {
  const [planningForm] = Form.useForm();
  const mustVisitFixRef = useRef(null);

  const [planningExportVisible, setPlanningExportVisible] = useState(false);
  const [planningExportLoading, setPlanningExportLoading] = useState(false);
  const [planningMustVisitDraftByGroupId, setPlanningMustVisitDraftByGroupId] = useState({});

  const planningDateRange = Form.useWatch('dateRange', planningForm);
  const planningGroupIds = Form.useWatch('groupIds', planningForm);

  const filterGroupsByRange = (range) => {
    if (!Array.isArray(range) || range.length !== 2 || !range[0] || !range[1]) {
      return groups;
    }
    const [start, end] = range;
    return (Array.isArray(groups) ? groups : []).filter((group) => {
      if (!group?.start_date || !group?.end_date) return false;
      const groupStart = dayjs(group.start_date);
      const groupEnd = dayjs(group.end_date);
      return !groupStart.isAfter(end, 'day') && !groupEnd.isBefore(start, 'day');
    });
  };

  const planningAvailableGroups = useMemo(() => (
    (planningDateRange && planningDateRange.length === 2)
      ? filterGroupsByRange(planningDateRange)
      : []
  ), [planningDateRange, groups]);

  const planningSelectedGroupIds = useMemo(() => (
    (Array.isArray(planningGroupIds) ? planningGroupIds : [])
      .map(id => Number(id))
      .filter(Number.isFinite)
  ), [planningGroupIds]);

  const planningSelectedGroupIdSet = useMemo(() => (
    new Set(planningSelectedGroupIds)
  ), [planningSelectedGroupIds]);

  const activeLocations = useMemo(() => (
    (Array.isArray(locations) ? locations : [])
      .filter(location => Boolean(location?.is_active))
  ), [locations]);

  const activeLocationById = useMemo(() => (
    new Map(
      activeLocations
        .map(location => [Number(location.id), location])
        .filter(([locationId]) => Number.isFinite(locationId))
    )
  ), [activeLocations]);

  const planningMissingMustVisitGroupIds = useMemo(() => (
    new Set(
      planningAvailableGroups
        .filter(group => normalizeManualMustVisitLocationIds(group?.manual_must_visit_location_ids).length === 0)
        .map(group => Number(group.id))
        .filter(Number.isFinite)
    )
  ), [planningAvailableGroups]);

  const resolvePlanningMustVisitLocationIds = (group) => {
    const groupId = Number(group?.id);
    if (!Number.isFinite(groupId)) return [];
    if (Object.prototype.hasOwnProperty.call(planningMustVisitDraftByGroupId, groupId)) {
      return normalizeLocationIdArray(planningMustVisitDraftByGroupId[groupId]);
    }
    return normalizeManualMustVisitLocationIds(group?.manual_must_visit_location_ids);
  };

  const planningBlockingMustVisitGroups = useMemo(() => (
    planningAvailableGroups
      .filter(group => planningSelectedGroupIdSet.has(Number(group.id)))
      .filter((group) => {
        const effectiveIds = resolvePlanningMustVisitLocationIds(group);
        return !effectiveIds || effectiveIds.length === 0;
      })
  ), [planningAvailableGroups, planningSelectedGroupIdSet, planningMustVisitDraftByGroupId]);

  const planningMustVisitFixGroups = useMemo(() => (
    planningAvailableGroups
      .filter(group => planningSelectedGroupIdSet.has(Number(group.id)))
      .filter(group => planningMissingMustVisitGroupIds.has(Number(group.id)))
  ), [planningAvailableGroups, planningSelectedGroupIdSet, planningMissingMustVisitGroupIds]);

  useEffect(() => {
    if (!planningDateRange || planningDateRange.length !== 2) {
      planningForm.setFieldsValue({ groupIds: [] });
      return;
    }
    const availableGroups = filterGroupsByRange(planningDateRange);
    const allowedIds = new Set(availableGroups.map(group => group.id));
    const selected = planningForm.getFieldValue('groupIds') || [];
    const filtered = selected.filter(id => allowedIds.has(id));
    if (filtered.length !== selected.length) {
      planningForm.setFieldsValue({ groupIds: filtered });
    }
  }, [planningDateRange, groups]);

  const buildPlanningPayload = (values) => {
    const [start, end] = values.dateRange || [];
    return {
      groupIds: values.groupIds,
      startDate: start ? start.format('YYYY-MM-DD') : formatDateString(dateRange?.[0]),
      endDate: end ? end.format('YYYY-MM-DD') : formatDateString(dateRange?.[6]),
      includeExistingActivities: true,
      includeExistingSchedules: true,
      includePlanItemsByGroup: true
    };
  };

  const openPlanningExportModal = () => {
    const defaultRange = [dayjs(dateRange?.[0]), dayjs(dateRange?.[6])];
    const availableGroups = filterGroupsByRange(defaultRange);
    const availableGroupIds = new Set(availableGroups.map(group => group.id));
    const defaultGroupIds = (selectedGroups.length ? selectedGroups : groups.map(group => group.id))
      .filter(id => availableGroupIds.has(id));
    planningForm.setFieldsValue({
      dateRange: defaultRange,
      groupIds: defaultGroupIds
    });
    setPlanningMustVisitDraftByGroupId({});
    setPlanningExportVisible(true);
  };

  const closePlanningExportModal = () => {
    setPlanningExportVisible(false);
    setPlanningMustVisitDraftByGroupId({});
  };

  const updatePlanningMustVisitDraft = (groupId, nextIds) => {
    const normalizedGroupId = Number(groupId);
    if (!Number.isFinite(normalizedGroupId)) return;
    const nextValue = normalizeLocationIdArray(nextIds);
    setPlanningMustVisitDraftByGroupId(prev => ({
      ...prev,
      [normalizedGroupId]: nextValue
    }));
  };

  const fillPlanningMustVisitFromPlan = (groupId) => {
    const normalizedGroupId = Number(groupId);
    if (!Number.isFinite(normalizedGroupId)) return;
    const group = (Array.isArray(groups) ? groups : []).find(item => Number(item.id) === normalizedGroupId)
      || planningAvailableGroups.find(item => Number(item.id) === normalizedGroupId);
    if (!group) return;
    const planId = Number(group.itinerary_plan_id);
    if (!Number.isFinite(planId) || planId <= 0) {
      message.warning('该团组未绑定行程方案，无法一键填充');
      return;
    }
    const plan = itineraryPlanById.get(planId);
    const planLocationIds = extractPlanLocationIds(plan?.items);
    const activeIds = planLocationIds.filter(locationId => activeLocationById.has(Number(locationId)));
    if (!activeIds.length) {
      message.warning('该行程方案没有可用地点，无法一键填充');
      return;
    }
    updatePlanningMustVisitDraft(normalizedGroupId, activeIds);
  };

  const fillAllMissingMustVisitFromPlan = () => {
    if (!planningBlockingMustVisitGroups.length) return;
    let filledCount = 0;
    const nextDraft = { ...planningMustVisitDraftByGroupId };

    planningBlockingMustVisitGroups.forEach((group) => {
      const groupId = Number(group?.id);
      if (!Number.isFinite(groupId)) return;
      const planId = Number(group?.itinerary_plan_id);
      if (!Number.isFinite(planId) || planId <= 0) return;
      const plan = itineraryPlanById.get(planId);
      const planLocationIds = extractPlanLocationIds(plan?.items);
      const activeIds = planLocationIds.filter(locationId => activeLocationById.has(Number(locationId)));
      if (!activeIds.length) return;
      nextDraft[groupId] = normalizeLocationIdArray(activeIds);
      filledCount += 1;
    });

    if (!filledCount) {
      message.warning('没有可从方案填充的团组（可能未绑定方案或方案为空）');
      return;
    }

    setPlanningMustVisitDraftByGroupId(nextDraft);
    message.success(`已为 ${filledCount} 个团组从方案填充必去点`);
  };

  const ensurePlanningMustVisitBeforeExport = async (groupIds) => {
    const targetGroupIds = normalizeLocationIdArray(groupIds);
    const targetIdSet = new Set(targetGroupIds);
    const targetGroups = planningAvailableGroups
      .filter(group => targetIdSet.has(Number(group.id)));

    const missingGroups = targetGroups
      .filter(group => resolvePlanningMustVisitLocationIds(group).length === 0);

    if (missingGroups.length > 0) {
      const previewNames = missingGroups
        .slice(0, 3)
        .map(group => group.name || `#${group.id}`)
        .join('、');
      message.error(`请先勾选必去行程点：${previewNames}${missingGroups.length > 3 ? ' 等' : ''}`);
      setTimeout(() => {
        mustVisitFixRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      }, 0);
      return false;
    }

    const updates = targetGroups
      .map((group) => {
        const groupId = Number(group.id);
        if (!Number.isFinite(groupId)) return null;
        if (!Object.prototype.hasOwnProperty.call(planningMustVisitDraftByGroupId, groupId)) {
          return null;
        }
        const draftIds = normalizeLocationIdArray(planningMustVisitDraftByGroupId[groupId])
          .filter(locationId => activeLocationById.has(Number(locationId)));
        const currentIds = normalizeManualMustVisitLocationIds(group.manual_must_visit_location_ids);
        if (!draftIds.length) return null;
        if (draftIds.length === currentIds.length) {
          const currentSet = new Set(currentIds);
          const allMatch = draftIds.every(locationId => currentSet.has(locationId));
          if (allMatch) return null;
        }
        return { groupId, locationIds: draftIds };
      })
      .filter(Boolean);

    if (!updates.length) return true;

    try {
      await Promise.all(
        updates.map(item => api.put(`/groups/${item.groupId}`, {
          manual_must_visit_location_ids: item.locationIds
        }))
      );

      const updateMap = new Map(updates.map(item => [item.groupId, item.locationIds]));
      setGroups(prev => (
        (Array.isArray(prev) ? prev : []).map((group) => {
          const groupId = Number(group?.id);
          if (!Number.isFinite(groupId)) return group;
          const locationIds = updateMap.get(groupId);
          if (!locationIds) return group;
          return {
            ...group,
            manual_must_visit_location_ids: locationIds
          };
        })
      ));

      setPlanningMustVisitDraftByGroupId((prev) => {
        const next = { ...(prev || {}) };
        updates.forEach((item) => {
          delete next[item.groupId];
        });
        return next;
      });

      message.success('已保存必去行程点');
      return true;
    } catch (error) {
      message.error(getRequestErrorMessage(error) || '保存必去行程点失败');
      return false;
    }
  };

  const handlePlanningExport = async () => {
    try {
      const values = await planningForm.validateFields();
      setPlanningExportLoading(true);
      const mustVisitOk = await ensurePlanningMustVisitBeforeExport(values.groupIds);
      if (!mustVisitOk) return;
      const response = await api.post('/planning/export', buildPlanningPayload(values));
      const payload = typeof response.data === 'string'
        ? JSON.parse(response.data)
        : response.data;
      const snapshotId = String(
        payload?.meta?.snapshotId || payload?.snapshot_id || dayjs().toISOString()
      ).replace(/[:.]/g, '-');
      const filename = `planning_input_${snapshotId}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      triggerDownload(blob, filename);
      message.success('导出成功');
      setPlanningExportVisible(false);
    } catch (error) {
      const data = error?.response?.data;
      if (data && typeof data === 'object') {
        const details = Array.isArray(data.details) && data.details.length
          ? `：${data.details.slice(0, 3).join('；')}`
          : '';
        message.error(`${data.error || '导出失败'}${details}`);
      } else {
        message.error('导出失败');
      }
    } finally {
      setPlanningExportLoading(false);
    }
  };

  return {
    planningForm,
    mustVisitFixRef,
    activeLocations,
    activeLocationById,

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
  };
}
