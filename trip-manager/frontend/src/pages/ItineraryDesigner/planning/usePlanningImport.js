import { Form, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import {
  buildPlanningImportValidationKey,
  extractPlanningAssignments,
  extractPlanningGroupIds,
  extractPlanningRange
} from './planningIO';
import {
  getPlanningConflictHandlingTip,
  getPlanningConflictReasonLabel,
  isPlanningConflictManualRequired
} from '../conflicts/conflictLabels';

const TIME_SLOT_LABELS = {
  MORNING: '上午',
  AFTERNOON: '下午',
  EVENING: '晚上'
};

const getTimeSlotLabel = (slotKey) => {
  const normalized = String(slotKey || '').toUpperCase();
  return TIME_SLOT_LABELS[normalized] || slotKey || '未知时段';
};

export default function usePlanningImport({
  api,
  groups,
  locations,
  selectedGroups,
  refreshData
}) {
  const [planningImportForm] = Form.useForm();
  const planningImportOnlySelected = Form.useWatch('onlySelectedGroups', planningImportForm);
  const planningImportGroupIds = Form.useWatch('groupIds', planningImportForm);

  const [planningImportVisible, setPlanningImportVisible] = useState(false);
  const [planningImportLoading, setPlanningImportLoading] = useState(false);
  const [planningImportValidating, setPlanningImportValidating] = useState(false);
  const [planningImportPayload, setPlanningImportPayload] = useState(null);
  const [planningImportFileList, setPlanningImportFileList] = useState([]);
  const [planningImportResult, setPlanningImportResult] = useState(null);
  const [planningImportValidatedKey, setPlanningImportValidatedKey] = useState('');
  const [planningImportSnapshotToken, setPlanningImportSnapshotToken] = useState('');
  const [planningImportRollbackLoading, setPlanningImportRollbackLoading] = useState(false);

  const [planningConflictActiveReason, setPlanningConflictActiveReason] = useState('ALL');
  const [planningConflictManualOnly, setPlanningConflictManualOnly] = useState(false);
  const [planningConflictTodayOnly, setPlanningConflictTodayOnly] = useState(false);
  const [planningConflictSortBy, setPlanningConflictSortBy] = useState('DATE_ASC');

  useEffect(() => {
    setPlanningConflictActiveReason('ALL');
    setPlanningConflictManualOnly(false);
    setPlanningConflictTodayOnly(false);
    setPlanningConflictSortBy('DATE_ASC');
  }, [planningImportResult, planningImportVisible]);

  const resetPlanningImportState = () => {
    setPlanningImportPayload(null);
    setPlanningImportFileList([]);
    setPlanningImportResult(null);
    setPlanningImportValidatedKey('');
    setPlanningImportSnapshotToken('');
    planningImportForm.resetFields();
    planningImportForm.setFieldsValue({
      replaceExisting: false,
      skipConflicts: true,
      onlySelectedGroups: true,
      groupIds: [],
      importDateRange: []
    });
  };

  const openPlanningImportModal = () => {
    resetPlanningImportState();
    setPlanningImportVisible(true);
  };

  const closePlanningImportModal = () => {
    setPlanningImportVisible(false);
  };

  const handlePlanningImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = event.target?.result || '';
        const parsed = JSON.parse(rawText);
        const payload = parsed?.payload && parsed.payload.schema ? parsed.payload : parsed;
        if (!payload || payload.schema !== 'ec-planning-result@1') {
          message.error('文件格式不正确（schema不匹配）');
          setPlanningImportPayload(null);
          setPlanningImportResult(null);
          setPlanningImportFileList([]);
          setPlanningImportValidatedKey('');
          setPlanningImportSnapshotToken('');
          return;
        }
        setPlanningImportPayload(payload);
        setPlanningImportResult(null);
        setPlanningImportValidatedKey('');
        setPlanningImportSnapshotToken('');
        const payloadGroupIds = extractPlanningGroupIds(payload);
        const payloadRange = extractPlanningRange(payload);
        planningImportForm.setFieldsValue({
          replaceExisting: payload.mode === 'replaceExisting',
          skipConflicts: true,
          onlySelectedGroups: true,
          groupIds: payloadGroupIds,
          importDateRange: payloadRange
            ? [dayjs(payloadRange.start), dayjs(payloadRange.end)]
            : []
        });
      } catch (error) {
        message.error(error?.message || '文件解析失败');
        setPlanningImportPayload(null);
        setPlanningImportResult(null);
        setPlanningImportFileList([]);
        setPlanningImportValidatedKey('');
        setPlanningImportSnapshotToken('');
      }
    };
    reader.readAsText(file);
    setPlanningImportFileList([file]);
    return false;
  };

  const handlePlanningImportRemove = () => {
    setPlanningImportPayload(null);
    setPlanningImportFileList([]);
    setPlanningImportResult(null);
    setPlanningImportValidatedKey('');
    setPlanningImportSnapshotToken('');
  };

  const resolvePlanningImportGroupIds = (values) => {
    const payloadGroupIds = extractPlanningGroupIds(planningImportPayload);
    let targetGroupIds = values.onlySelectedGroups
      ? selectedGroups
      : (values.groupIds || []);
    targetGroupIds = targetGroupIds
      .map(id => Number(id))
      .filter(Number.isFinite);
    if (payloadGroupIds.length > 0) {
      const payloadSet = new Set(payloadGroupIds);
      targetGroupIds = targetGroupIds.filter(id => payloadSet.has(id));
    }
    return Array.from(new Set(targetGroupIds));
  };

  const buildPlanningImportOptions = (values, dryRun) => {
    const groupIds = resolvePlanningImportGroupIds(values);
    const [rangeStart, rangeEnd] = values.importDateRange || [];
    const fallbackRange = extractPlanningRange(planningImportPayload);
    const startDate = rangeStart
      ? rangeStart.format('YYYY-MM-DD')
      : (fallbackRange?.start || null);
    const endDate = rangeEnd
      ? rangeEnd.format('YYYY-MM-DD')
      : (fallbackRange?.end || null);

    return {
      groupIds,
      replaceExisting: values.replaceExisting !== false,
      skipConflicts: values.skipConflicts !== false,
      startDate,
      endDate,
      dryRun
    };
  };

  const runPlanningImport = async (dryRun) => {
    if (!planningImportPayload) {
      message.error('请先上传 planning_result.json');
      return;
    }

    try {
      const values = await planningImportForm.validateFields();
      const options = buildPlanningImportOptions(values, dryRun);
      if ((options.groupIds || []).length === 0) {
        message.error('未选择可导入的团组');
        return;
      }
      if (!options.startDate || !options.endDate) {
        message.error('请先确认导入日期范围');
        return;
      }

      const validationKey = buildPlanningImportValidationKey(planningImportPayload, {
        ...options,
        dryRun: false
      });
      if (!dryRun && planningImportValidatedKey !== validationKey) {
        message.warning('请先执行校验，校验通过后再导入');
        return;
      }

      const request = {
        payload: planningImportPayload,
        options
      };

      if (dryRun) {
        setPlanningImportValidatedKey('');
        setPlanningImportValidating(true);
      } else {
        setPlanningImportLoading(true);
      }

      const response = await api.post('/planning/import', request);
      setPlanningImportResult(response.data);
      if (dryRun) {
        setPlanningImportValidatedKey(validationKey);
        message.success('校验完成');
      } else {
        setPlanningImportValidatedKey('');
        setPlanningImportSnapshotToken(response.data?.snapshotToken || '');
        message.success(`导入完成，成功 ${response.data?.summary?.inserted || 0} 条`);
        refreshData();
      }
    } catch (error) {
      const data = error.response?.data;
      if (data?.conflicts) {
        setPlanningImportResult(data);
      }
      if (dryRun) {
        setPlanningImportValidatedKey('');
      }
      message.error(data?.error || (dryRun ? '校验失败' : '导入失败'));
    } finally {
      setPlanningImportValidating(false);
      setPlanningImportLoading(false);
    }
  };

  const handlePlanningImportValidate = () => runPlanningImport(true);
  const handlePlanningImportApply = () => runPlanningImport(false);

  const handlePlanningImportRollback = async () => {
    if (!planningImportSnapshotToken) {
      message.warning('当前没有可回滚的导入快照');
      return;
    }
    try {
      setPlanningImportRollbackLoading(true);
      await api.post('/planning/import/rollback', {
        snapshotToken: planningImportSnapshotToken
      });
      setPlanningImportSnapshotToken('');
      setPlanningImportValidatedKey('');
      message.success('已回滚最近一次导入');
      refreshData();
    } catch (error) {
      const data = error.response?.data;
      message.error(data?.error || '回滚失败');
    } finally {
      setPlanningImportRollbackLoading(false);
    }
  };

  const planningImportPayloadGroupIds = planningImportPayload
    ? extractPlanningGroupIds(planningImportPayload)
    : [];
  const planningImportRange = planningImportPayload
    ? extractPlanningRange(planningImportPayload)
    : null;
  const planningImportAssignmentsCount = planningImportPayload
    ? extractPlanningAssignments(planningImportPayload).length
    : 0;
  const planningImportOnlySelectedValue = planningImportOnlySelected !== false;
  const planningImportSelectedGroupIds = planningImportOnlySelectedValue
    ? selectedGroups.filter(id => planningImportPayloadGroupIds.includes(id))
    : (planningImportGroupIds || []).filter(id => planningImportPayloadGroupIds.includes(id));
  const planningImportSummary = planningImportResult?.summary || null;
  const planningImportConflicts = planningImportResult?.conflicts || [];
  const planningConflictTodayDate = dayjs().format('YYYY-MM-DD');
  const planningSlotOrder = {
    MORNING: 0,
    AFTERNOON: 1,
    EVENING: 2
  };

  const planningConflictRows = useMemo(() => (
    planningImportConflicts.map((item, index) => {
      const rawReasons = Array.isArray(item.reasons) && item.reasons.length
        ? item.reasons
        : [item.reason].filter(Boolean);
      const reasonCode = String(rawReasons[0] || '').trim() || 'UNKNOWN';
      const groupId = Number(item.groupId ?? item.group_id);
      const locationId = Number(item.locationId ?? item.location_id);
      const groupLabel = item.groupName
        || item.group_name
        || (groups.find(g => g.id === groupId)?.name || (Number.isFinite(groupId) ? `#${groupId}` : '未知团组'));
      const locationLabel = item.locationName
        || item.location_name
        || (Number.isFinite(locationId) ? (locations.find(loc => loc.id === locationId)?.name || `#${locationId}`) : '未指定地点');
      const slotKey = item.timeSlot ?? item.time_slot ?? '';
      const slotLabel = slotKey ? getTimeSlotLabel(slotKey) : '未知时段';
      const reasonLabel = item.reasonMessage || getPlanningConflictReasonLabel(reasonCode);
      const manualRequired = rawReasons.some(isPlanningConflictManualRequired);
      const suggestion = getPlanningConflictHandlingTip(reasonCode);
      const dateText = item.date || '-';
      const dateValue = dayjs(dateText).isValid() ? dayjs(dateText).valueOf() : Number.MAX_SAFE_INTEGER;
      return {
        key: `${groupId || 'g'}-${item.date || 'd'}-${slotKey || 's'}-${locationId || 'l'}-${reasonCode}-${index}`,
        date: dateText,
        dateValue,
        groupId: Number.isFinite(groupId) ? groupId : null,
        groupLabel,
        locationId: Number.isFinite(locationId) ? locationId : null,
        locationLabel,
        slotKey,
        slotLabel,
        reasonCode,
        reasonLabel,
        manualRequired,
        suggestion
      };
    })
  ), [planningImportConflicts, groups, locations]);

  const planningConflictBuckets = useMemo(() => {
    const bucketMap = new Map();
    planningConflictRows.forEach((row) => {
      const key = row.reasonCode || 'UNKNOWN';
      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          reasonCode: key,
          reasonLabel: getPlanningConflictReasonLabel(key),
          count: 0,
          manualRequiredCount: 0
        });
      }
      const bucket = bucketMap.get(key);
      bucket.count += 1;
      if (row.manualRequired) bucket.manualRequiredCount += 1;
    });
    return Array.from(bucketMap.values()).sort((a, b) => b.count - a.count);
  }, [planningConflictRows]);

  const planningConflictFilteredRows = useMemo(() => {
    const filtered = planningConflictRows.filter((row) => {
      if (planningConflictManualOnly && !row.manualRequired) return false;
      if (planningConflictActiveReason !== 'ALL' && row.reasonCode !== planningConflictActiveReason) return false;
      if (planningConflictTodayOnly && row.date !== planningConflictTodayDate) return false;
      return true;
    });
    return filtered.sort((left, right) => {
      if (planningConflictSortBy === 'GROUP_ASC') {
        if (left.groupLabel !== right.groupLabel) {
          return String(left.groupLabel).localeCompare(String(right.groupLabel), 'zh-CN');
        }
        if (left.dateValue !== right.dateValue) return left.dateValue - right.dateValue;
        return (planningSlotOrder[left.slotKey] ?? 99) - (planningSlotOrder[right.slotKey] ?? 99);
      }
      if (planningConflictSortBy === 'DATE_DESC') {
        if (left.dateValue !== right.dateValue) return right.dateValue - left.dateValue;
        if ((planningSlotOrder[left.slotKey] ?? 99) !== (planningSlotOrder[right.slotKey] ?? 99)) {
          return (planningSlotOrder[right.slotKey] ?? 99) - (planningSlotOrder[left.slotKey] ?? 99);
        }
        return String(left.groupLabel).localeCompare(String(right.groupLabel), 'zh-CN');
      }
      if (left.dateValue !== right.dateValue) return left.dateValue - right.dateValue;
      if ((planningSlotOrder[left.slotKey] ?? 99) !== (planningSlotOrder[right.slotKey] ?? 99)) {
        return (planningSlotOrder[left.slotKey] ?? 99) - (planningSlotOrder[right.slotKey] ?? 99);
      }
      return String(left.groupLabel).localeCompare(String(right.groupLabel), 'zh-CN');
    });
  }, [
    planningConflictRows,
    planningConflictManualOnly,
    planningConflictActiveReason,
    planningConflictTodayOnly,
    planningConflictTodayDate,
    planningConflictSortBy
  ]);

  const planningConflictTodayCount = useMemo(() => (
    planningConflictRows.filter((row) => row.date === planningConflictTodayDate).length
  ), [planningConflictRows, planningConflictTodayDate]);

  const planningImportFile = planningImportFileList[0];

  return {
    planningImportVisible,
    setPlanningImportVisible,
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
  };
}
