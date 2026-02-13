import React, { useMemo } from 'react';
import { PROFILE_TEXT } from '../../../constants';
import {
  extractPlanLocationIds,
  normalizeManualMustVisitLocationIds
} from '../profileUtils';

const MustVisitSection = ({
  draft,
  itineraryPlans = [],
  locations = [],
  setDraft
}) => {
  const locationMap = useMemo(
    () => new Map((locations || []).map((location) => [Number(location.id), location])),
    [locations]
  );

  const manualMustVisitIds = normalizeManualMustVisitLocationIds(draft?.manual_must_visit_location_ids);
  const selectedMustVisitIds = manualMustVisitIds;
  const mustVisitConfigured = manualMustVisitIds.length > 0;

  const resolvedMustVisit = selectedMustVisitIds.map((locationId, index) => {
    const location = locationMap.get(locationId);
    return {
      location_id: locationId,
      location_name: location?.name || ('#' + locationId),
      sort_order: index,
      source: 'manual'
    };
  });

  const handleMustVisitPlanChange = (value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const planId = value ? Number(value) : null;
      return {
        ...prev,
        itinerary_plan_id: Number.isFinite(planId) ? planId : null
      };
    });
  };

  const handleApplyCurrentPlan = () => {
    if (manualMustVisitIds.length > 0) {
      const confirmed = window.confirm(PROFILE_TEXT.replaceMustVisitConfirm);
      if (!confirmed) return;
    }
    setDraft((prev) => {
      if (!prev) return prev;
      const planId = Number(prev.itinerary_plan_id);
      if (!Number.isFinite(planId)) return prev;
      const plan = (itineraryPlans || []).find((item) => Number(item.id) === planId);
      const nextIds = extractPlanLocationIds(plan?.items || []);
      if (!nextIds.length) return prev;
      return {
        ...prev,
        manual_must_visit_location_ids: nextIds
      };
    });
  };

  const handleToggleManualMustVisit = (locationId) => {
    const normalizedLocationId = Number(locationId);
    if (!Number.isFinite(normalizedLocationId) || normalizedLocationId <= 0) {
      return;
    }
    setDraft((prev) => {
      if (!prev) return prev;
      const currentIds = normalizeManualMustVisitLocationIds(prev.manual_must_visit_location_ids);
      const nextSet = new Set(currentIds);
      if (nextSet.has(normalizedLocationId)) {
        nextSet.delete(normalizedLocationId);
      } else {
        nextSet.add(normalizedLocationId);
      }
      return {
        ...prev,
        manual_must_visit_location_ids: Array.from(nextSet)
      };
    });
  };

  const handleClearManualMustVisit = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        manual_must_visit_location_ids: []
      };
    });
  };

  return (
    <div className="must-visit-module">
      <div className="must-visit-head">
        <div className="must-visit-title">{'必去行程点配置'}</div>
        <span className={'must-visit-badge ' + (mustVisitConfigured ? 'ok' : 'warn')}>
          {mustVisitConfigured ? (`已配置 ${resolvedMustVisit.length} 项`) : '未配置'}
        </span>
      </div>

      <div className="must-visit-edit-row">
        <label className="must-visit-label">{'快捷方案'}</label>
        <div className="must-visit-plan-row">
          <div className="must-visit-plan-actions">
            <select
              className="prop-input"
              value={draft?.itinerary_plan_id ? String(draft.itinerary_plan_id) : ''}
              onChange={(event) => handleMustVisitPlanChange(event.target.value)}
            >
              <option value="">
                {'不使用方案（仅手动）'}
              </option>
              {(itineraryPlans || []).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="must-visit-link-btn"
              onClick={handleApplyCurrentPlan}
              disabled={!draft?.itinerary_plan_id}
            >
              {'套用当前方案'}
            </button>
          </div>
          <span className="must-visit-tip">
            {
              '方案仅用于快捷点选；点击“套用当前方案”后，才会把方案地点填充到必去点，之后可继续手动微调。'
            }
          </span>
        </div>
      </div>

      <div className="must-visit-edit-row">
        <label className="must-visit-label">{'手动必去行程点'}</label>
        <div className="must-visit-manual-panel">
          <div className="must-visit-manual-tools">
            <span className="must-visit-tip">
              {'点击卡片即可多选，无需按住 Ctrl'}
            </span>
            <button
              type="button"
              className="must-visit-link-btn"
              onClick={handleClearManualMustVisit}
              disabled={selectedMustVisitIds.length === 0}
            >
              {'清空'}
            </button>
          </div>
          <div className="must-visit-option-grid">
            {(locations || []).length === 0 && (
              <span className="muted">{'暂无可选地点'}</span>
            )}
            {(locations || []).map((location) => {
              const locationId = Number(location.id);
              const isSelected = selectedMustVisitIds.includes(locationId);
              return (
                <button
                  key={location.id}
                  type="button"
                  className={'must-visit-option ' + (isSelected ? 'active' : '')}
                  onClick={() => handleToggleManualMustVisit(locationId)}
                >
                  <span className="must-visit-option-check">{isSelected ? '✓' : '+'}</span>
                  <span className="must-visit-option-name">{location.name || ('#' + location.id)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="must-visit-list">
        {resolvedMustVisit.length === 0 ? (
          <span className="muted">
            {
              '未配置必去行程点，行程设计器导出会被拦截。'
            }
          </span>
        ) : (
          resolvedMustVisit.map((item, index) => (
            <span className="schedule-chip" key={item.location_id + '-' + index}>
              {item.location_name}
            </span>
          ))
        )}
      </div>
    </div>
  );
};

export default MustVisitSection;
