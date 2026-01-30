import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_WIDTH = 420;
const GAP = 10;
const PADDING = 16;

const resolveMode = (mode) => (mode === 'edit' ? 'edit' : 'create');

const ActivityPopover = ({
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
    startTime: '',
    endTime: '',
    location: '',
    planItemId: ''
  });

  const isEditMode = resolveMode(mode) === 'edit';

  useEffect(() => {
    if (!activity || !isOpen) return;
    const derivedPlanId = activity.planItemId
      || (typeof activity.resourceId === 'string' && activity.resourceId.startsWith('plan-')
        ? activity.resourceId
        : '');
    setFormState({
      title: activity.title || '',
      type: activity.type || 'visit',
      startTime: activity.startTime || '',
      endTime: activity.endTime || '',
      location: activity.location || '',
      planItemId: derivedPlanId || ''
    });
  }, [activity, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!activity) {
      setFormState({
        title: initialValues?.title || '',
        type: initialValues?.type || 'visit',
        startTime: initialValues?.startTime || '',
        endTime: initialValues?.endTime || '',
        location: initialValues?.location || '',
        planItemId: initialValues?.planItemId || ''
      });
    }
  }, [isOpen, activity, initialValues]);

  const resolvedPlanItems = useMemo(() => (
    Array.isArray(planItems) ? planItems : []
  ), [planItems]);

  const selectedPlan = resolvedPlanItems.find((item) => String(item.id) === String(formState.planItemId));

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
        {isEditMode && (
          <button className="icon-btn danger" title="删除" onClick={handleDelete}>删</button>
        )}
        <button className="icon-btn" title="关闭" onClick={onClose}>X</button>
      </div>

      <div className="pop-body">
        <input
          className="title-input"
          placeholder="添加标题"
          value={formState.title}
          readOnly={linkMode === 'linked'}
          onChange={(event) => updateField('title', event.target.value)}
        />

        <div className="link-section">
          <div className="link-header">
            <span>数据来源</span>
          </div>
          <select
            className="plan-select"
            value={formState.planItemId}
            onChange={(event) => updateField('planItemId', event.target.value)}
          >
            <option value="">自定义活动</option>
            {resolvedPlanItems.map((item) => (
              <option key={item.id} value={item.id}>{item.title || item.name}</option>
            ))}
          </select>
          {!formState.planItemId && (
            <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
              未选择行程点，将保存为自定义项目
            </div>
          )}
        </div>

        <div className="field-row">
          时间
          <div className="mini-input" style={{ display: 'flex', gap: 8 }}>
            <input
              className="mini-input"
              style={{ flex: 1 }}
              placeholder="开始"
              value={formState.startTime}
              onChange={(event) => updateField('startTime', event.target.value)}
            />
            <input
              className="mini-input"
              style={{ flex: 1 }}
              placeholder="结束"
              value={formState.endTime}
              onChange={(event) => updateField('endTime', event.target.value)}
            />
          </div>
        </div>

        {isEditMode && (
          <div className="field-row">
            地点
            <input
              className="mini-input"
              placeholder="地点"
              value={formState.location}
              readOnly={linkMode === 'linked'}
              onChange={(event) => updateField('location', event.target.value)}
            />
          </div>
        )}
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

export default ActivityPopover;
