import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  getResourceId,
  isPlanResourceId,
  parseShixingResourceId,
  resolveResourceKind
} from '../../../../domain/resourceId';
import { resolveSourceMetaByKind } from '../../../../domain/resourceSource';
import { formatShixingResourceDetail } from '../../../../domain/shixingResource';
import {
  LEGACY_MEAL_TITLES,
  SHIXING_MEAL_DEFAULTS,
  SHIXING_MEAL_KEYS,
  SHIXING_MEAL_LABELS,
  SHIXING_TRANSFER_LABELS
} from '../../../../domain/shixingConfig';

const DEFAULT_WIDTH = 420;
const GAP = 10;
const PADDING = 16;
const COLOR_SWATCHES = [
  '#1890ff',
  '#52c41a',
  '#fa8c16',
  '#eb2f96',
  '#722ed1',
  '#13c2c2',
  '#f5222d',
  '#2f54eb',
  '#a0d911',
  '#8c8c8c'
];
const MEAL_DEFAULT_COLOR = '#52c41a';

const buildMealState = (drafts = {}) => {
  const result = {};
  SHIXING_MEAL_KEYS.forEach((key) => {
    const defaults = SHIXING_MEAL_DEFAULTS[key] || {};
    const draft = drafts[key] || {};
    result[key] = {
      disabled: Boolean(draft.disabled),
      plan: draft.plan || '',
      place: draft.place || '',
      startTime: draft.startTime || defaults.start || '',
      endTime: draft.endTime || defaults.end || ''
    };
  });
  return result;
};

const buildTransferState = (draft = {}) => ({
  disabled: Boolean(draft.disabled),
  startTime: draft.startTime || draft.time || '',
  endTime: draft.endTime || draft.end_time || '',
  location: draft.location || '',
  contact: draft.contact || '',
  flightNo: draft.flightNo || draft.flight_no || '',
  airline: draft.airline || '',
  terminal: draft.terminal || '',
  note: draft.note || draft.remark || ''
});

const buildTransferFlightSummary = (transfer = {}) => (
  [
    transfer.flightNo && `航班 ${transfer.flightNo}`,
    transfer.airline,
    transfer.terminal
  ].filter(Boolean).join(' / ')
);

const formatTransferDescription = (transfer = {}) => {
  const note = (transfer.note || '').trim();
  if (note) return note;
  return buildTransferFlightSummary(transfer);
};

const resolveMode = (mode) => (mode === 'edit' ? 'edit' : 'create');

const formatDateText = (value) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  return `${value} ${weekday}`;
};

const toMinutes = (value) => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

const addOneHour = (value) => {
  const minutes = toMinutes(value);
  if (!Number.isFinite(minutes)) return '';
  const next = (minutes + 60) % (24 * 60);
  const hour = String(Math.floor(next / 60)).padStart(2, '0');
  const minute = String(next % 60).padStart(2, '0');
  return `${hour}:${minute}`;
};

const resolveTransferTypeByDate = (date, startDate, endDate) => {
  if (!date) return null;
  const isStart = Boolean(startDate && date === startDate);
  const isEnd = Boolean(endDate && date === endDate);
  if (isStart && !isEnd) return 'pickup';
  if (isEnd && !isStart) return 'dropoff';
  if (isStart && isEnd) return 'pickup';
  return null;
};

const CalendarDetailEventEditorPopover = ({
  anchorRect,
  isOpen,
  mode = 'create',
  activity,
  groupStartDate,
  groupEndDate,
  planItems = [],
  initialValues,
  onSave,
  onDelete,
  onClose
}) => {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [formState, setFormState] = useState({
    title: '',
    type: 'visit',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    description: '',
    color: COLOR_SWATCHES[0],
    planItemId: ''
  });
  const [mealState, setMealState] = useState(() => buildMealState());
  const [transferState, setTransferState] = useState(() => buildTransferState());
  const [shixingTransferType, setShixingTransferType] = useState('pickup');
  const [sourceCategory, setSourceCategory] = useState('custom');

  const isEditMode = resolveMode(mode) === 'edit';
  const resourceId = getResourceId(activity);
  const resourceKind = resolveResourceKind(resourceId);
  const isShixing = resourceKind === 'shixing';
  const parsedShixing = parseShixingResourceId(resourceId);

  useEffect(() => {
    if (!activity || !isOpen) return;

    const derivedPlanId = activity.planItemId || (isPlanResourceId(resourceId) ? resourceId : '');
    const rawTitle = (activity.title || '').trim();
    const rawDescription = (activity.description || '').trim();
    const normalizedTitle = (
      activity.type === 'meal'
      && rawDescription
      && (!rawTitle || LEGACY_MEAL_TITLES.has(rawTitle))
    )
      ? rawDescription
      : (activity.title || '');

    setFormState({
      title: normalizedTitle,
      type: activity.type || 'visit',
      date: activity.date || '',
      startTime: activity.startTime || '',
      endTime: activity.endTime || '',
      location: activity.location || '',
      description: activity.description || '',
      color: activity.color || (activity.type === 'meal' ? MEAL_DEFAULT_COLOR : COLOR_SWATCHES[0]),
      planItemId: derivedPlanId || ''
    });

    const transferDrafts = initialValues?.transferDrafts || {};
    const nextMeals = buildMealState(initialValues?.mealDrafts || {});
    if (parsedShixing?.category === 'meal' && parsedShixing.key && nextMeals[parsedShixing.key]) {
      const key = parsedShixing.key;
      nextMeals[key] = {
        ...nextMeals[key],
        disabled: false,
        plan: normalizedTitle || rawDescription || nextMeals[key].plan || '',
        place: activity.location || nextMeals[key].place || '',
        startTime: activity.startTime || nextMeals[key].startTime || '',
        endTime: activity.endTime || nextMeals[key].endTime || ''
      };
    }
    setMealState(nextMeals);

    const parsedTransferType = (
      parsedShixing?.category === 'pickup' || parsedShixing?.category === 'dropoff'
    )
      ? parsedShixing.category
      : 'pickup';
    const nextCardType = parsedShixing?.category === 'meal' ? 'meal' : 'transfer';
    const baseTransferDraft = transferDrafts[parsedTransferType] || {};
    const transferDescription = (activity.description || '').trim();
    const transferNote = transferDescription && transferDescription !== buildTransferFlightSummary(baseTransferDraft)
      ? transferDescription
      : (baseTransferDraft.note || '');
    const nextTransfer = buildTransferState({
      ...baseTransferDraft,
      startTime: activity.startTime || baseTransferDraft.startTime || baseTransferDraft.time || '',
      endTime: activity.endTime || baseTransferDraft.endTime || baseTransferDraft.end_time || '',
      location: activity.location || baseTransferDraft.location || '',
      note: transferNote
    });
    setShixingTransferType(parsedTransferType);
    setTransferState(nextTransfer);

    if (resourceKind === 'shixing') {
      setSourceCategory(nextCardType);
    } else if (derivedPlanId || resourceKind === 'plan') {
      setSourceCategory('plan');
    } else {
      setSourceCategory('custom');
    }
  }, [activity, initialValues?.mealDrafts, initialValues?.transferDrafts, isOpen, parsedShixing?.category, parsedShixing?.key, resourceId, resourceKind]);

  useEffect(() => {
    if (!isOpen) return;
    if (activity) return;

    setFormState({
      title: initialValues?.title || '',
      type: initialValues?.type || 'visit',
      date: initialValues?.date || '',
      startTime: initialValues?.startTime || '',
      endTime: initialValues?.endTime || '',
      location: initialValues?.location || '',
      description: initialValues?.description || '',
      color: initialValues?.color || COLOR_SWATCHES[0],
      planItemId: initialValues?.planItemId || ''
    });

    setMealState(buildMealState(initialValues?.mealDrafts || {}));

    const nextTransferType = initialValues?.shixingTransferType === 'dropoff' ? 'dropoff' : 'pickup';
    setShixingTransferType(nextTransferType);
    const draftTransfer = buildTransferState(initialValues?.transferDrafts?.[nextTransferType] || {});
    const slotStart = initialValues?.startTime || '';
    const slotEnd = initialValues?.endTime || addOneHour(slotStart);
    const nextStart = slotStart || draftTransfer.startTime || '';
    const nextEndCandidate = draftTransfer.endTime || slotEnd || '';
    const nextStartMinutes = toMinutes(nextStart);
    const nextEndMinutes = toMinutes(nextEndCandidate);
    const nextEnd = (
      Number.isFinite(nextStartMinutes)
      && Number.isFinite(nextEndMinutes)
      && nextEndMinutes <= nextStartMinutes
    )
      ? addOneHour(nextStart)
      : nextEndCandidate;

    setTransferState({
      ...draftTransfer,
      startTime: nextStart,
      endTime: nextEnd
    });

    if (initialValues?.sourceCategory === 'meal' || initialValues?.sourceCategory === 'transfer') {
      setSourceCategory(initialValues.sourceCategory);
    } else if (initialValues?.planItemId) {
      setSourceCategory('plan');
    } else {
      setSourceCategory('custom');
    }
  }, [isOpen, activity, initialValues]);

  const resolvedPlanItems = useMemo(() => (Array.isArray(planItems) ? planItems : []), [planItems]);
  const selectedPlan = resolvedPlanItems.find((item) => String(item.id) === String(formState.planItemId));

  const isStartDate = Boolean(groupStartDate && formState.date === groupStartDate);
  const isEndDate = Boolean(groupEndDate && formState.date === groupEndDate);
  const parsedTransferType = (
    parsedShixing?.category === 'pickup' || parsedShixing?.category === 'dropoff'
  )
    ? parsedShixing.category
    : null;
  const inferredTransferType = parsedTransferType || resolveTransferTypeByDate(formState.date, groupStartDate, groupEndDate);
  const canUseTransferByDate = Boolean(inferredTransferType);

  useEffect(() => {
    if (!inferredTransferType) return;
    if (shixingTransferType !== inferredTransferType) {
      setShixingTransferType(inferredTransferType);
    }
  }, [inferredTransferType, shixingTransferType]);

  const sourceMeta = useMemo(() => {
    if (isShixing || sourceCategory === 'meal' || sourceCategory === 'transfer') {
      const base = resolveSourceMetaByKind('shixing');
      const detail = parsedShixing
        ? formatShixingResourceDetail(resourceId)
        : (
          sourceCategory === 'transfer'
            ? (SHIXING_TRANSFER_LABELS[inferredTransferType || shixingTransferType] || '接送站')
            : '三餐'
        );
      return { kind: base.kind, label: base.title, detail };
    }

    const kind = sourceCategory === 'plan' ? 'plan' : 'custom';
    const base = resolveSourceMetaByKind(kind);
    return { kind: base.kind, label: kind === 'plan' ? base.title : '自定义' };
  }, [inferredTransferType, isShixing, parsedShixing, resourceId, shixingTransferType, sourceCategory]);

  const linkMode = formState.planItemId ? 'linked' : 'manual';

  useEffect(() => {
    if (!formState.planItemId || !selectedPlan) return;
    setFormState((prev) => ({
      ...prev,
      title: selectedPlan.title || prev.title,
      location: selectedPlan.location || prev.location
    }));
  }, [formState.planItemId, selectedPlan]);

  useEffect(() => {
    if (isShixing) return;
    if (formState.planItemId) {
      setSourceCategory('plan');
    }
  }, [formState.planItemId, isShixing]);

  const handleSourceToggle = (category) => {
    if (category === 'meal' || category === 'transfer') {
      if (category === 'meal' && formState.color === COLOR_SWATCHES[0]) {
        updateField('color', MEAL_DEFAULT_COLOR);
      }
      if (category === 'transfer') {
        setTransferState((prev) => {
          const nextStart = prev.startTime || formState.startTime || '';
          const nextEndCandidate = prev.endTime || formState.endTime || addOneHour(nextStart);
          const nextStartMinutes = toMinutes(nextStart);
          const nextEndMinutes = toMinutes(nextEndCandidate);
          const nextEnd = (
            Number.isFinite(nextStartMinutes)
            && Number.isFinite(nextEndMinutes)
            && nextEndMinutes <= nextStartMinutes
          )
            ? addOneHour(nextStart)
            : nextEndCandidate;
          return { ...prev, startTime: nextStart, endTime: nextEnd };
        });
      }
      setSourceCategory(category);
      updateField('planItemId', '');
      return;
    }

    if (isShixing) return;

    if (category === 'plan') {
      setSourceCategory('plan');
      return;
    }

    setSourceCategory('custom');
    updateField('planItemId', '');
  };

  useLayoutEffect(() => {
    if (!isOpen || !anchorRect || !popoverRef.current) return;

    const positionPopover = () => {
      const pop = popoverRef.current;
      const maxHeight = Math.max(260, window.innerHeight - PADDING * 2);
      pop.style.maxHeight = `${maxHeight}px`;
      const popWidth = pop.offsetWidth || DEFAULT_WIDTH;
      const popHeight = pop.offsetHeight || 0;

      let left = anchorRect.right + GAP;
      if (left + popWidth > window.innerWidth - PADDING) {
        left = anchorRect.left - GAP - popWidth;
      }
      left = Math.max(PADDING, Math.min(left, window.innerWidth - popWidth - PADDING));

      let top = anchorRect.top;
      top = Math.max(PADDING, Math.min(top, window.innerHeight - popHeight - PADDING));

      setPosition((prev) => (prev.top === top && prev.left === left ? prev : { top, left }));
    };

    const raf = requestAnimationFrame(positionPopover);
    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(positionPopover);
      observer.observe(popoverRef.current);
    }
    window.addEventListener('resize', positionPopover);
    window.addEventListener('scroll', positionPopover, true);

    return () => {
      cancelAnimationFrame(raf);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', positionPopover);
      window.removeEventListener('scroll', positionPopover, true);
    };
  }, [isOpen, anchorRect, sourceCategory, linkMode, isEditMode]);

  const updateField = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const updateMealField = (mealKey, field, value) => {
    setMealState((prev) => ({
      ...prev,
      [mealKey]: {
        ...prev[mealKey],
        [field]: value
      }
    }));
  };

  const toggleMealDisabled = (mealKey) => {
    setMealState((prev) => {
      const current = prev[mealKey] || {};
      return {
        ...prev,
        [mealKey]: {
          ...current,
          disabled: !current.disabled
        }
      };
    });
  };

  const updateTransferField = (field, value) => {
    setTransferState((prev) => ({ ...prev, [field]: value }));
  };

  const toggleTransferDisabled = () => {
    setTransferState((prev) => ({ ...prev, disabled: !prev.disabled }));
  };

  const isShixingMode = sourceCategory === 'meal' || sourceCategory === 'transfer' || isShixing;
  const isMealMode = sourceCategory === 'meal' || (isShixing && parsedShixing?.category === 'meal');
  const isTransferMode = sourceCategory === 'transfer' || (isShixing && parsedShixing?.category !== 'meal');
  const isSaveDisabled = isTransferMode && !canUseTransferByDate;

  const handleSave = () => {
    if (isMealMode) {
      onSave?.({
        ...formState,
        sourceCategory: 'meal',
        shixingMeals: mealState,
        linkMode: 'manual'
      });
      return;
    }

    if (isTransferMode) {
      const transferType = inferredTransferType || shixingTransferType;
      const transferLabel = SHIXING_TRANSFER_LABELS[transferType] || '接送站';
      const transferPayload = {
        ...transferState,
        note: (transferState.note || '').trim()
      };
      const transferDescription = formatTransferDescription(transferPayload);
      onSave?.({
        ...formState,
        sourceCategory: 'transfer',
        type: 'transport',
        title: transferLabel,
        location: transferPayload.location || transferLabel,
        description: transferDescription || '',
        startTime: transferPayload.startTime || formState.startTime,
        endTime: transferPayload.endTime || formState.endTime,
        shixingTransferType: transferType,
        shixingTransfer: transferPayload,
        linkMode: 'manual'
      });
      return;
    }

    onSave?.({
      ...formState,
      sourceCategory,
      linkMode
    });
  };

  const handleDelete = () => {
    onDelete?.(activity);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={popoverRef}
      className={`g-popover ${isOpen ? 'visible' : ''} ${linkMode === 'linked' ? 'mode-linked' : 'mode-manual'}`}
      style={{ left: position.left, top: position.top }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="pop-header">
        <div className="header-palette">
          {COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              className={`color-swatch ${formState.color === color ? 'active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => updateField('color', color)}
              title={`选择颜色 ${color}`}
            />
          ))}
        </div>
        <div className="header-actions">
          {isEditMode && (
            <button className="icon-btn danger" title="删除" onClick={handleDelete}>删</button>
          )}
          <button className="icon-btn" title="关闭" onClick={onClose}>X</button>
        </div>
      </div>

      <div className="pop-body">
        <div className="link-section link-section-compact">
          <div className="source-toggle source-toggle-compact">
            <button
              type="button"
              className={`source-toggle-btn source-toggle-btn-compact ${sourceCategory === 'plan' ? 'active' : ''}`}
              onClick={() => handleSourceToggle('plan')}
              disabled={isShixing}
            >
              行程点
            </button>
            <button
              type="button"
              className={`source-toggle-btn source-toggle-btn-compact ${sourceCategory === 'meal' ? 'active' : ''}`}
              onClick={() => handleSourceToggle('meal')}
            >
              每日卡-餐饮
            </button>
            <button
              type="button"
              className={`source-toggle-btn source-toggle-btn-compact ${sourceCategory === 'transfer' ? 'active' : ''}`}
              onClick={() => handleSourceToggle('transfer')}
              disabled={!canUseTransferByDate && sourceCategory !== 'transfer'}
            >
              每日卡-接送
            </button>
            <button
              type="button"
              className={`source-toggle-btn source-toggle-btn-compact ${sourceCategory === 'custom' ? 'active' : ''}`}
              onClick={() => handleSourceToggle('custom')}
              disabled={isShixing}
            >
              自定义
            </button>
          </div>

          {isShixingMode ? (
            <div className="source-readonly">
              {sourceCategory === 'transfer' && !canUseTransferByDate
                ? '接送站仅支持首日和末日。首日自动为接站，末日自动为送站。'
                : `将同步每日卡片（${sourceMeta.detail || '每日卡片'}），删除日历活动会同步清空对应记录。`}
            </div>
          ) : sourceCategory === 'plan' ? (
            <select
              className="plan-select"
              value={formState.planItemId}
              onChange={(event) => updateField('planItemId', event.target.value)}
            >
              <option value="">
                {resolvedPlanItems.length > 0 ? '选择必去行程点' : '暂无可用必去行程点'}
              </option>
              {resolvedPlanItems.map((item) => (
                <option key={item.id} value={item.id}>{item.title || item.name}</option>
              ))}
            </select>
          ) : null}
        </div>

        {isShixingMode ? (
          <>
            <div className="field-row">
              <div className="field-label">日期</div>
              <input
                className="mini-input mini-input-readonly"
                placeholder="日期"
                value={formatDateText(formState.date)}
                readOnly
              />
            </div>

            {isMealMode ? (
              <div className="meal-editor-grid">
                {SHIXING_MEAL_KEYS.map((mealKey) => {
                  const row = mealState[mealKey] || {};
                  const disabled = Boolean(row.disabled);
                  return (
                    <div className={`meal-editor-row ${disabled ? 'is-disabled' : ''}`} key={mealKey}>
                      <div className="meal-editor-title meal-editor-title-inline">
                        <span className="meal-editor-label">{SHIXING_MEAL_LABELS[mealKey]}</span>
                        <div className="meal-editor-time-inline">
                          <span className="meal-editor-time-label">时间</span>
                          <input
                            className="mini-input meal-editor-time-input"
                            placeholder="开始"
                            disabled={disabled}
                            value={row.startTime || ''}
                            onChange={(event) => updateMealField(mealKey, 'startTime', event.target.value)}
                          />
                          <input
                            className="mini-input meal-editor-time-input"
                            placeholder="结束"
                            disabled={disabled}
                            value={row.endTime || ''}
                            onChange={(event) => updateMealField(mealKey, 'endTime', event.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className={`meal-editor-toggle ${disabled ? 'is-off' : ''}`}
                          onClick={() => toggleMealDisabled(mealKey)}
                        >
                          {disabled ? '未安排' : '不安排'}
                        </button>
                      </div>

                      <div className="meal-editor-fields">
                        <input
                          className="mini-input"
                          placeholder="餐厅名"
                          disabled={disabled}
                          value={row.plan || ''}
                          onChange={(event) => updateMealField(mealKey, 'plan', event.target.value)}
                        />
                        <input
                          className="mini-input"
                          placeholder="地址"
                          disabled={disabled}
                          value={row.place || ''}
                          onChange={(event) => updateMealField(mealKey, 'place', event.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`meal-editor-row ${transferState.disabled ? 'is-disabled' : ''}`}>
                <div className="meal-editor-title">
                  <span>
                    {SHIXING_TRANSFER_LABELS[inferredTransferType || shixingTransferType] || '接送站'}
                    {' '}
                    {isStartDate ? '（首日）' : ''}
                    {isEndDate && !isStartDate ? '（末日）' : ''}
                  </span>
                  <button
                    type="button"
                    className={`meal-editor-toggle ${transferState.disabled ? 'is-off' : ''}`}
                    onClick={toggleTransferDisabled}
                    disabled={!canUseTransferByDate}
                  >
                    {transferState.disabled ? '未安排' : '不安排'}
                  </button>
                </div>

                <div className="meal-editor-time">
                  <input
                    className="mini-input"
                    placeholder="开始"
                    disabled={transferState.disabled}
                    value={transferState.startTime || ''}
                    onChange={(event) => updateTransferField('startTime', event.target.value)}
                  />
                  <input
                    className="mini-input"
                    placeholder="结束"
                    disabled={transferState.disabled}
                    value={transferState.endTime || ''}
                    onChange={(event) => updateTransferField('endTime', event.target.value)}
                  />
                </div>

                <div className="meal-editor-fields">
                  <input
                    className="mini-input"
                    placeholder="地址"
                    disabled={transferState.disabled}
                    value={transferState.location || ''}
                    onChange={(event) => updateTransferField('location', event.target.value)}
                  />
                  <input
                    className="mini-input"
                    placeholder="联系人"
                    disabled={transferState.disabled}
                    value={transferState.contact || ''}
                    onChange={(event) => updateTransferField('contact', event.target.value)}
                  />
                </div>

                <div className="meal-editor-fields">
                  <input
                    className="mini-input"
                    placeholder="航班号"
                    disabled={transferState.disabled}
                    value={transferState.flightNo || ''}
                    onChange={(event) => updateTransferField('flightNo', event.target.value)}
                  />
                  <input
                    className="mini-input"
                    placeholder="航空公司"
                    disabled={transferState.disabled}
                    value={transferState.airline || ''}
                    onChange={(event) => updateTransferField('airline', event.target.value)}
                  />
                </div>

                <div className="meal-editor-fields">
                  <input
                    className="mini-input"
                    placeholder="航站楼"
                    disabled={transferState.disabled}
                    value={transferState.terminal || ''}
                    onChange={(event) => updateTransferField('terminal', event.target.value)}
                  />
                  <input
                    className="mini-input"
                    placeholder="备注（可选）"
                    disabled={transferState.disabled}
                    value={transferState.note || ''}
                    onChange={(event) => updateTransferField('note', event.target.value)}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <input
              className="title-input"
              placeholder="添加标题"
              value={formState.title}
              readOnly={linkMode === 'linked'}
              onChange={(event) => updateField('title', event.target.value)}
            />

            <div className="field-row">
              <div className="field-label">时间</div>
              <div className="field-stack">
                <input
                  className="mini-input mini-input-readonly"
                  placeholder="日期"
                  value={formatDateText(formState.date)}
                  readOnly
                />
                <div className="time-range-row">
                  <input
                    className="mini-input"
                    placeholder="开始"
                    value={formState.startTime}
                    onChange={(event) => updateField('startTime', event.target.value)}
                  />
                  <input
                    className="mini-input"
                    placeholder="结束"
                    value={formState.endTime}
                    onChange={(event) => updateField('endTime', event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="field-row">
              <div className="field-label">地址</div>
              <input
                className="mini-input"
                placeholder="地址"
                value={formState.location}
                readOnly={linkMode === 'linked'}
                onChange={(event) => updateField('location', event.target.value)}
              />
            </div>

            <div className="field-row">
              <div className="field-label">备注</div>
              <textarea
                className="mini-input note-textarea"
                placeholder="添加备注（可选）"
                value={formState.description}
                rows={2}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className="pop-footer">
        {isEditMode && (
          <button className="btn-text-danger" onClick={handleDelete}>
            删除活动
          </button>
        )}
        <button className="btn-save" onClick={handleSave} disabled={isSaveDisabled}>保存</button>
      </div>
    </div>
  );
};

export default CalendarDetailEventEditorPopover;
