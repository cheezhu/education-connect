import React, { useMemo } from 'react';
import { isCustomResourceId } from '../../../../domain/resourceId';
import { PROFILE_TEXT } from '../../constants';

const toLocationNameMap = (locations = []) => {
  const map = new Map();
  locations.forEach((item) => {
    const id = Number(item?.id);
    if (!Number.isFinite(id)) return;
    map.set(id, item?.name || `#${id}`);
  });
  return map;
};

const normalizeMustVisitIds = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));
  }
  return [];
};

const resolveCustomCards = (group, schedules = []) => {
  const fromGroup = Array.isArray(group?.customResources) ? group.customResources : [];
  if (fromGroup.length > 0) return fromGroup;

  const seen = new Set();
  const fromSchedules = [];
  (schedules || []).forEach((item) => {
    const rid = item?.resourceId || item?.resource_id;
    if (!isCustomResourceId(rid) || seen.has(rid)) return;
    seen.add(rid);
    fromSchedules.push({
      id: rid,
      title: item?.title || item?.location || '未命名卡片',
      type: item?.type || 'custom'
    });
  });
  return fromSchedules;
};

const PointCardsView = ({ group, locations = [], schedules = [], onNavigateTab }) => {
  const locationMap = useMemo(() => toLocationNameMap(locations), [locations]);
  const mustVisitCards = useMemo(() => {
    const ids = normalizeMustVisitIds(group?.manual_must_visit_location_ids);
    return ids.map((id) => ({
      id,
      name: locationMap.get(id) || `#${id}`
    }));
  }, [group?.manual_must_visit_location_ids, locationMap]);

  const otherCards = useMemo(
    () => resolveCustomCards(group, schedules),
    [group, schedules]
  );

  if (!group) {
    return (
      <div className="profile-layout profile-doc">
        <div className="profile-center">
          <div className="empty-state">{PROFILE_TEXT.emptyState}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="points-view">
      <div className="points-header">
        <div className="points-title">行程点资源</div>
        <button
          type="button"
          className="points-link-btn"
          onClick={() => onNavigateTab?.('schedule')}
        >
          去日历规划拖拽排程
        </button>
      </div>

      <div className="points-grid">
        <div className="points-panel">
          <div className="points-panel-title">必去行程点</div>
          {mustVisitCards.length === 0 ? (
            <div className="points-empty">未配置必去行程点</div>
          ) : (
            <div className="points-card-list">
              {mustVisitCards.map((card) => (
                <div className="points-card must" key={`must-${card.id}`}>
                  <span className="points-card-tag">必去</span>
                  <span className="points-card-name">{card.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="points-panel">
          <div className="points-panel-title">其他行程</div>
          {otherCards.length === 0 ? (
            <div className="points-empty">暂无其他行程卡片</div>
          ) : (
            <div className="points-card-list">
              {otherCards.map((card, index) => (
                <div className="points-card other" key={card.id || `${index}-${card.title}`}>
                  <span className="points-card-tag">其他</span>
                  <span className="points-card-name">{card.title || '未命名卡片'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="points-note">
        该页用于查看行程卡片分类，具体时间排程请在“日历规划”中完成。
      </div>
    </div>
  );
};

export default PointCardsView;

