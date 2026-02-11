import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  getResourceId,
  isPlanResourceId,
  resolveResourceKind
} from '../../../../domain/resourceId';
import { resolveSourceMetaByKind } from '../../../../domain/resourceSource';
import { formatShixingResourceDetail } from '../../../../domain/shixingResource';

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
const LEGACY_MEAL_TITLES = new Set(['早餐', '午餐', '晚餐', '早饭', '午饭', '晚饭']);

const resolveMode = (mode) => (mode === 'edit' ? 'edit' : 'create');
const formatDateText = (value) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  return `${value} ${weekday}`;
};

const CalendarDetailEventEditorPopover = ({
  anchorRect,
  isOpen,
  mode = 'create',
  activity,
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
  const [sourceCategory, setSourceCategory] = useState('custom');

  const isEditMode = resolveMode(mode) === 'edit';
  const resourceId = getResourceId(activity);
  const resourceKind = resolveResourceKind(resourceId);
  const isShixing = resourceKind === 'shixing';

  useEffect(() => {
    if (!activity || !isOpen) return;
    const derivedPlanId = activity.planItemId
      || (isPlanResourceId(resourceId) ? resourceId : '');
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
      color: activity.color || COLOR_SWATCHES[0],
      planItemId: derivedPlanId || ''
    });
    if (resourceKind === 'shixing') {
      setSourceCategory('shixing');
    } else if (derivedPlanId || resourceKind === 'plan') {
      setSourceCategory('plan');
    } else {
      setSourceCategory('custom');
    }
  }, [activity, isOpen, resourceId, resourceKind]);

  useEffect(() => {
    if (!isOpen) return;
    if (!activity) {
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
      if (initialValues?.planItemId) {
        setSourceCategory('plan');
      } else {
        setSourceCategory('custom');
      }
    }
  }, [isOpen, activity, initialValues]);

  const resolvedPlanItems = useMemo(() => (
    Array.isArray(planItems) ? planItems : []
  ), [planItems]);

  const selectedPlan = resolvedPlanItems.find((item) => String(item.id) === String(formState.planItemId));

  const sourceMeta = useMemo(() => {
    if (isShixing || sourceCategory === 'shixing') {
      const base = resolveSourceMetaByKind('shixing');
      return {
        kind: base.kind,
        label: base.title,
        detail: formatShixingResourceDetail(resourceId)
      };
    }
    const kind = sourceCategory === 'plan' ? 'plan' : 'custom';
    const base = resolveSourceMetaByKind(kind);
    return {
      kind: base.kind,
      label: kind === 'plan' ? base.title : '自定义'
    };
  }, [isShixing, resourceId, sourceCategory]);

  const linkMode = formState.planItemId ? 'linked' : 'manual';

  useEffect(() => {
    if (!formState.planItemId) return;
    if (!selectedPlan) return;
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
    if (category === 'shixing') {
      if (isShixing) {
        setSourceCategory('shixing');
      }
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
      const popWidth = pop.offsetWidth || DEFAULT_WIDTH;
      const popHeight = pop.offsetHeight || 0;
      let left = anchorRect.right + GAP;
      if (left + popWidth > window.innerWidth - PADDING) {
        left = anchorRect.left - GAP - popWidth;
      }
      left = Math.max(PADDING, Math.min(left, window.innerWidth - popWidth - PADDING));

      let top = anchorRect.top;
      top = Math.max(PADDING, Math.min(top, window.innerHeight - popHeight - PADDING));

      setPosition({ top, left });
    };

    const raf = requestAnimationFrame(positionPopover);
    window.addEventListener('resize', positionPopover);
    window.addEventListener('scroll', positionPopover, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', positionPopover);
      window.removeEventListener('scroll', positionPopover, true);
    };
  }, [isOpen, anchorRect, formState.title, formState.location, linkMode, isEditMode]);

  const updateField = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave?.({
      ...formState,
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

        {isEditMode && (
          <div className="field-row">
            <div className="field-label">地点</div>
            <input
              className="mini-input"
              placeholder="地点"
              value={formState.location}
              readOnly={linkMode === 'linked'}
              onChange={(event) => updateField('location', event.target.value)}
            />
          </div>
        )}

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

        <div className="link-section link-section-compact">
          <div className="source-toggle source-toggle-compact">
            <button
              type="button"
              className={`source-toggle-btn source-toggle-btn-compact ${sourceCategory === 'plan' ? 'active' : ''}`}
              onClick={() => handleSourceToggle('plan')}
              disabled={isShixing}
            >
              必去行程
            </button>
            <button
              type="button"
              className={`source-toggle-btn source-toggle-btn-compact ${sourceCategory === 'shixing' || isShixing ? 'active' : ''} ${!isShixing ? 'disabled' : ''}`}
              onClick={() => handleSourceToggle('shixing')}
              disabled={!isShixing}
            >
              食行卡片
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
          {sourceMeta.kind === 'shixing' ? (
            <div className="source-readonly">
              该活动来自食行卡片，类型已锁定为 {sourceMeta.detail || '食行卡片'}。
            </div>
          ) : sourceCategory === 'plan' ? (
            <select
              className="plan-select"
              value={formState.planItemId}
              onChange={(event) => updateField('planItemId', event.target.value)}
            >
              <option value="">选择必去行程点</option>
              {resolvedPlanItems.map((item) => (
                <option key={item.id} value={item.id}>{item.title || item.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="pop-footer">
        {isEditMode && (
          <button className="btn-text-danger" onClick={handleDelete}>
            删除活动
          </button>
        )}
        <button className="btn-save" onClick={handleSave}>保存</button>
      </div>
    </div>
  );
};

export default CalendarDetailEventEditorPopover;
