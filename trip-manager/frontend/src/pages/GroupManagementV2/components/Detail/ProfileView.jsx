import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import PropertyGrid from './PropertyGrid';

const weekdayLabel = (dateStr) => {
  const day = dayjs(dateStr).day();
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return labels[day] || '';
};

const resolveEventTitle = (event) => {
  return event?.title || event?.location || event?.description || '未命名活动';
};

const isItineraryItem = (item) => {
  const type = (item?.type || '').toString().toLowerCase();
  if (!type) return true;
  return !['meal', 'transport', 'rest', 'free'].includes(type);
};

const buildDateValue = (startDate, endDate) => {
  if (startDate && endDate) return `${startDate} → ${endDate}`;
  return startDate || endDate || '';
};

const isValidDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');

const isDraftValid = (value) => {
  if (!value) return false;
  if (!value.name || !String(value.name).trim()) return false;
  if (!value.type) return false;
  if (!isValidDateString(value.start_date) || !isValidDateString(value.end_date)) return false;
  const start = dayjs(value.start_date);
  const end = dayjs(value.end_date);
  if (!start.isValid() || !end.isValid() || end.isBefore(start, 'day')) return false;
  const duration = Number(value.duration);
  if (!Number.isFinite(duration) || duration <= 0) return false;
  return true;
};

const parseDateRangeInput = (value, fallbackEnd) => {
  const matches = String(value || '').match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (matches.length === 0) return { start: '', end: '' };
  if (matches.length === 1) return { start: matches[0], end: fallbackEnd || '' };
  return { start: matches[0], end: matches[1] };
};

const normalizeNotes = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  const trimmed = text.trim();
  if (!trimmed) return '';
  const cleaned = trimmed.replace(/[.。…]+/g, '');
  if (/^[?？]+$/.test(cleaned)) return '';
  return text;
};

const normalizeMustVisitMode = (value, fallback = 'plan') => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'plan' || mode === 'manual') {
    return mode;
  }
  return fallback;
};

const normalizeManualMustVisitLocationIds = (value) => {
  if (Array.isArray(value)) {
    return Array.from(new Set(
      value
        .map(item => Number(item))
        .filter(id => Number.isFinite(id) && id > 0)
    ));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeManualMustVisitLocationIds(parsed);
      }
    } catch (error) {
      // ignore parse error and fallback to split
    }
    return Array.from(new Set(
      trimmed
        .split(/[,\uFF0C\u3001;|]/)
        .map(item => Number(item.trim()))
        .filter(id => Number.isFinite(id) && id > 0)
    ));
  }
  return [];
};

const extractPlanLocationIds = (items = []) => (
  Array.from(new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => Number(item?.location_id))
      .filter((id) => Number.isFinite(id) && id > 0)
  ))
);

const buildBaseProperties = (group, hasMembers) => {
  const tagsValue = Array.isArray(group.tags) ? group.tags.join(', ') : (group.tags || '');
  const dateValue = buildDateValue(group.start_date, group.end_date);
  const totalCount = (group.student_count || 0) + (group.teacher_count || 0);
  const typeOptions = [
    { value: 'primary', label: '小学' },
    { value: 'secondary', label: '中学' }
  ];

  return [
    {
      id: 'dates',
      key: '日期范围',
      value: dateValue,
      type: 'date',
      icon: 'CAL',
      field: 'dates',
      placeholder: 'YYYY-MM-DD → YYYY-MM-DD'
    },
    {
      id: 'duration',
      key: '行程天数',
      value: group.duration || '',
      type: 'number',
      icon: '#',
      field: 'duration',
      readOnly: true
    },
    {
      id: 'type',
      key: '团组类型',
      value: group.type || '',
      type: 'select',
      icon: 'SCH',
      field: 'type',
      options: typeOptions
    },
    {
      id: 'students',
      key: '学生人数',
      value: group.student_count ?? '',
      type: 'number',
      icon: '#',
      field: 'student_count',
      readOnly: hasMembers,
      badge: hasMembers ? '自动' : ''
    },
    {
      id: 'teachers',
      key: '教师人数',
      value: group.teacher_count ?? '',
      type: 'number',
      icon: '#',
      field: 'teacher_count',
      readOnly: hasMembers,
      badge: hasMembers ? '自动' : ''
    },
    {
      id: 'total',
      key: '总人数',
      value: totalCount,
      type: 'number',
      icon: '#',
      field: 'total',
      readOnly: true
    },
    {
      id: 'accommodation',
      key: '住宿酒店',
      value: group.accommodation || '',
      type: 'text',
      icon: 'HOT',
      field: 'accommodation'
    },
    {
      id: 'color',
      key: '标识颜色',
      value: group.color || '#1890ff',
      type: 'color',
      icon: 'CLR',
      field: 'color'
    },
    {
      id: 'tags',
      key: '标签',
      value: tagsValue,
      type: 'text',
      icon: 'TAG',
      field: 'tags'
    },
    {
      id: 'contact_person',
      key: '联系人',
      value: group.contact_person || '',
      type: 'person',
      icon: '@',
      field: 'contact_person'
    },
    {
      id: 'contact_phone',
      key: '联系电话',
      value: group.contact_phone || '',
      type: 'text',
      icon: 'TEL',
      field: 'contact_phone'
    },
    {
      id: 'emergency_contact',
      key: '紧急联系人',
      value: group.emergency_contact || '',
      type: 'person',
      icon: '!',
      field: 'emergency_contact'
    },
    {
      id: 'emergency_phone',
      key: '紧急电话',
      value: group.emergency_phone || '',
      type: 'text',
      icon: 'TEL',
      field: 'emergency_phone'
    }
  ];
};

const mergeCustomProperties = (baseProperties, groupProperties) => {
  if (!Array.isArray(groupProperties)) return baseProperties;
  const baseIds = new Set(baseProperties.map((prop) => prop.id));
  const custom = groupProperties.filter((prop) => prop && !baseIds.has(prop.id));
  return [...baseProperties, ...custom];
};

const isTextFilled = (value) => {
  if (value === null || value === undefined) return false;
  return String(value).trim() !== '' && String(value).trim() !== '[object Object]';
};

const isMealComplete = (meals = {}, fallbackDisabled = false) => {
  if (fallbackDisabled || meals.disabled || meals.all_disabled) return true;
  return ['breakfast', 'lunch', 'dinner'].every((key) => (
    meals[`${key}_disabled`] || isTextFilled(meals[key]) || isTextFilled(meals[`${key}_place`])
  ));
};

const isTransferComplete = (transfer = {}, fallbackDisabled = false) => (
  transfer.disabled
  || fallbackDisabled
  || isTextFilled(transfer.time)
  || isTextFilled(transfer.end_time)
  || isTextFilled(transfer.location)
  || isTextFilled(transfer.contact)
  || isTextFilled(transfer.flight_no)
  || isTextFilled(transfer.airline)
  || isTextFilled(transfer.terminal)
);

const buildCompletionStats = (logistics = [], group) => {
  if (!Array.isArray(logistics) || logistics.length === 0) {
    return { percent: 0, modules: [] };
  }

  const startDate = group?.start_date || '';
  const endDate = group?.end_date || '';
  const moduleKeys = [
    { key: 'hotel', label: '住宿酒店', color: '#2d9d78' },
    { key: 'vehicle', label: '车辆调度', color: '#2383e2' },
    { key: 'guide', label: '随团导游', color: '#d9730d' },
    { key: 'security', label: '安保人员', color: '#7b1fa2' },
    { key: 'meals', label: '餐饮安排', color: '#2d9d78' },
    { key: 'pickup', label: '接站', color: '#2383e2' },
    { key: 'dropoff', label: '送站', color: '#2383e2' }
  ];

  const moduleTotals = Object.fromEntries(moduleKeys.map(item => [item.key, { total: 0, done: 0 }]));

  let totalCount = 0;
  let doneCount = 0;

  logistics.forEach((row) => {
    const isStart = startDate && row.date === startDate;
    const isEnd = endDate && row.date === endDate;

    const hotelDone = row.hotel_disabled || isTextFilled(row.hotel) || isTextFilled(row.hotel_address);
    const vehicleDone = row.vehicle_disabled
      || isTextFilled(row.vehicle?.plate)
      || isTextFilled(row.vehicle?.driver)
      || isTextFilled(row.vehicle?.phone)
      || isTextFilled(row.vehicle?.name);
    const guideDone = row.guide_disabled || isTextFilled(row.guide?.name) || isTextFilled(row.guide?.phone);
    const securityDone = row.security_disabled || isTextFilled(row.security?.name) || isTextFilled(row.security?.phone);
    const mealsDone = isMealComplete(row.meals || {}, row.meals_disabled);

    const modules = [
      { key: 'hotel', done: hotelDone },
      { key: 'vehicle', done: vehicleDone },
      { key: 'guide', done: guideDone },
      { key: 'security', done: securityDone },
      { key: 'meals', done: mealsDone }
    ];

    modules.forEach((module) => {
      moduleTotals[module.key].total += 1;
      if (module.done) moduleTotals[module.key].done += 1;
      totalCount += 1;
      if (module.done) doneCount += 1;
    });

    if (isStart) {
      moduleTotals.pickup.total += 1;
      if (isTransferComplete(row.pickup || {}, row.pickup_disabled)) moduleTotals.pickup.done += 1;
      totalCount += 1;
      if (isTransferComplete(row.pickup || {}, row.pickup_disabled)) doneCount += 1;
    }
    if (isEnd) {
      moduleTotals.dropoff.total += 1;
      if (isTransferComplete(row.dropoff || {}, row.dropoff_disabled)) moduleTotals.dropoff.done += 1;
      totalCount += 1;
      if (isTransferComplete(row.dropoff || {}, row.dropoff_disabled)) doneCount += 1;
    }
  });

  const percent = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  const modules = moduleKeys
    .filter((module) => moduleTotals[module.key].total > 0)
    .map((module) => {
      const { total, done } = moduleTotals[module.key];
      const ratio = total ? Math.round((done / total) * 100) : 0;
      return {
        ...module,
        ratio
      };
    })
    .filter((module) => module.ratio > 0 || module.key === 'hotel' || module.key === 'vehicle');

  return { percent, modules };
};

const ProfileView = ({
  group,
  schedules,
  itineraryPlans = [],
  locations = [],
  onUpdate,
  hasMembers,
  onNavigateTab
}) => {
  const [draft, setDraft] = useState(group || null);
  const [properties, setProperties] = useState([]);
  const hydrateRef = useRef(false);
  const debounceRef = useRef(null);
  const lastDraftRef = useRef(null);

  useEffect(() => {
    if (!group) {
      setDraft(null);
      setProperties([]);
      return;
    }
    hydrateRef.current = true;
    setDraft({ ...group, notes: normalizeNotes(group.notes) });
    const base = buildBaseProperties(group, hasMembers);
    setProperties(mergeCustomProperties(base, group.properties));
  }, [group?.id, hasMembers]);

  useEffect(() => {
    if (!group?.id || !onUpdate) return;
    if (hydrateRef.current) {
      hydrateRef.current = false;
      lastDraftRef.current = draft;
      return;
    }
    if (lastDraftRef.current === draft) {
      return;
    }
    if (!isDraftValid(draft)) {
      return;
    }
    clearTimeout(debounceRef.current);
    lastDraftRef.current = draft;
    debounceRef.current = setTimeout(() => {
      onUpdate({ ...draft, properties });
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [draft, group?.id, onUpdate, properties]);

  const logistics = useMemo(() => (
    Array.isArray(group?.logistics) ? group.logistics : []
  ), [group?.logistics]);

  const completionStats = useMemo(() => (
    buildCompletionStats(logistics, group)
  ), [logistics, group?.start_date, group?.end_date]);

  const daysToStart = useMemo(() => (
    group?.start_date ? dayjs(group.start_date).diff(dayjs(), 'day') : null
  ), [group?.start_date]);

  const scheduleSummary = useMemo(() => {
    const map = new Map();
    (schedules || []).forEach((item) => {
      const date = item.activity_date || item.date;
      if (!date) return;
      if (!map.has(date)) map.set(date, []);
      map.get(date).push(item);
    });
    map.forEach((items) => {
      items.sort((a, b) => {
        const aTime = a.startTime || a.start_time || '';
        const bTime = b.startTime || b.start_time || '';
        return aTime.localeCompare(bTime);
      });
    });
    return map;
  }, [schedules]);

  const previewDays = useMemo(() => logistics, [logistics]);

  if (!group || !draft) {
    return (
      <div className="profile-layout profile-doc">
        <div className="profile-center">
          <div className="empty-state">请选择团组以查看详情</div>
        </div>
      </div>
    );
  }

  const handleNameChange = (value) => {
    setDraft((prev) => ({ ...prev, name: value }));
  };

  const handleStatusChange = (value) => {
    setDraft((prev) => ({ ...prev, status: value || null }));
  };

  const handlePropertyUpdate = (id, updates) => {
    setProperties((prev) => {
      let next = prev.map((prop) => (prop.id === id ? { ...prop, ...updates } : prop));
      const updated = next.find((prop) => prop.id === id);
      if (!updated) return next;

      if (updates.value !== undefined) {
        setDraft((prevDraft) => {
          if (!prevDraft) return prevDraft;
          const nextDraft = { ...prevDraft };
          if (updated.field === 'dates') {
            const parsed = parseDateRangeInput(updates.value, prevDraft.end_date);
            const hasRange = parsed.start && parsed.end;
            if (hasRange) {
              nextDraft.start_date = parsed.start;
              nextDraft.end_date = parsed.end;
              const duration = dayjs(parsed.end).diff(dayjs(parsed.start), 'day') + 1;
              nextDraft.duration = Number.isFinite(duration) && duration > 0 ? duration : nextDraft.duration;
            }
            return nextDraft;
          }
          if (updated.field === 'student_count' || updated.field === 'teacher_count') {
            const numeric = Number(updates.value);
            nextDraft[updated.field] = Number.isFinite(numeric) ? numeric : 0;
            return nextDraft;
          }
          if (updated.field === 'tags') {
            nextDraft.tags = updates.value;
            return nextDraft;
          }
          if (updated.field && updated.field !== 'total' && updated.field !== 'duration') {
            nextDraft[updated.field] = updates.value;
          }
          return nextDraft;
        });
      }

      if (updated.field === 'dates') {
        const parsed = parseDateRangeInput(updated.value, draft?.end_date);
        const hasRange = parsed.start && parsed.end;
        if (hasRange) {
          const normalized = buildDateValue(parsed.start, parsed.end);
          next = next.map((prop) => (prop.id === 'dates' ? { ...prop, value: normalized } : prop));
          const durationValue = dayjs(parsed.end).diff(dayjs(parsed.start), 'day') + 1;
          next = next.map((prop) => (prop.id === 'duration' ? { ...prop, value: durationValue } : prop));
        }
      }

      if (updated.field === 'student_count' || updated.field === 'teacher_count') {
        const studentProp = next.find((prop) => prop.id === 'students');
        const teacherProp = next.find((prop) => prop.id === 'teachers');
        const studentVal = Number(studentProp?.value) || 0;
        const teacherVal = Number(teacherProp?.value) || 0;
        next = next.map((prop) => (prop.id === 'total' ? { ...prop, value: studentVal + teacherVal } : prop));
      }

      return next;
    });
  };

  const handleAddProperty = (typeMeta) => {
    const fallbackType = typeMeta?.type || 'text';
    const newId = `prop-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const label = typeMeta?.label || '文本';
    const nextProp = {
      id: newId,
      key: label,
      value: '',
      type: fallbackType,
      icon: typeMeta?.icon || 'Aa',
      placeholder: fallbackType === 'date' ? 'YYYY-MM-DD → YYYY-MM-DD' : '未填写'
    };
    setProperties((prev) => [...prev, nextProp]);
    return newId;
  };

  const statusOptions = [
    { value: null, label: '自动' },
    { value: '准备中', label: '准备中' },
    { value: '进行中', label: '进行中' },
    { value: '已完成', label: '已完成' },
    { value: '已取消', label: '已取消' }
  ];

  const locationMap = new Map(
    (locations || []).map((location) => [Number(location.id), location])
  );
  const manualMustVisitIds = normalizeManualMustVisitLocationIds(draft.manual_must_visit_location_ids);
  const activePlan = (itineraryPlans || []).find(
    (plan) => Number(plan.id) === Number(draft.itinerary_plan_id)
  ) || null;
  const planMustVisitIds = extractPlanLocationIds(activePlan?.items || []);
  const selectedMustVisitIds = manualMustVisitIds;
  const resolvedMustVisit = selectedMustVisitIds.map((locationId, index) => {
    const location = locationMap.get(locationId);
    return {
      location_id: locationId,
      location_name: location?.name || `#${locationId}`,
      sort_order: index,
      source: 'manual'
    };
  });
  const mustVisitConfigured = manualMustVisitIds.length > 0;

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
      const confirmed = window.confirm('将使用方案地点替换当前必去点，是否继续？');
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
    <div className="profile-layout profile-doc">
      <div className="profile-center doc-container">
        <div className="doc-content">
          <div>
            <div className="doc-icon">🗂️</div>
            <input
              className="doc-title"
              value={draft.name || ''}
              placeholder="输入团组名称"
              onChange={(event) => handleNameChange(event.target.value)}
            />
            <div className="status-tags">
              {statusOptions.map((option) => (
                <span
                  key={option.label}
                  className={`status-tag ${draft.status === option.value || (!draft.status && option.value === null) ? 'active' : ''}`}
                  onClick={() => handleStatusChange(option.value)}
                >
                  {option.label}
                </span>
              ))}
            </div>
          </div>

          <PropertyGrid
            properties={properties}
            onChangeProperty={handlePropertyUpdate}
            onAddProperty={handleAddProperty}
          />

          <div className="must-visit-module">
            <div className="must-visit-head">
              <div className="must-visit-title">必去行程点配置</div>
              <span className={`must-visit-badge ${mustVisitConfigured ? 'ok' : 'warn'}`}>
                {mustVisitConfigured ? `已配置 ${resolvedMustVisit.length} 项` : '未配置'}
              </span>
            </div>

            <div className="must-visit-edit-row">
              <label className="must-visit-label">快捷方案</label>
              <div className="must-visit-plan-row">
                <div className="must-visit-plan-actions">
                  <select
                    className="prop-input"
                    value={draft.itinerary_plan_id ? String(draft.itinerary_plan_id) : ''}
                    onChange={(event) => handleMustVisitPlanChange(event.target.value)}
                  >
                    <option value="">不使用方案（仅手动）</option>
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
                    disabled={!draft.itinerary_plan_id}
                  >
                    套用当前方案
                  </button>
                </div>
                <span className="must-visit-tip">
                  方案仅用于快捷点选；点击“套用当前方案”才会把方案地点填充到必去点，之后可继续手动微调。
                </span>
              </div>
            </div>

            <div className="must-visit-edit-row">
              <label className="must-visit-label">手动必去行程点</label>
              <div className="must-visit-manual-panel">
                <div className="must-visit-manual-tools">
                  <span className="must-visit-tip">点击卡片即可多选，无需按住 Ctrl</span>
                  <button
                    type="button"
                    className="must-visit-link-btn"
                    onClick={handleClearManualMustVisit}
                    disabled={selectedMustVisitIds.length === 0}
                  >
                    清空
                  </button>
                </div>
                <div className="must-visit-option-grid">
                  {(locations || []).length === 0 && (
                    <span className="muted">暂无可选地点</span>
                  )}
                  {(locations || []).map((location) => {
                    const locationId = Number(location.id);
                    const isSelected = selectedMustVisitIds.includes(locationId);
                    return (
                      <button
                        key={location.id}
                        type="button"
                        className={`must-visit-option ${isSelected ? 'active' : ''}`}
                        onClick={() => handleToggleManualMustVisit(locationId)}
                      >
                        <span className="must-visit-option-check">{isSelected ? '✓' : '+'}</span>
                        <span className="must-visit-option-name">{location.name || `#${location.id}`}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="must-visit-list">
              {resolvedMustVisit.length === 0 ? (
                <span className="muted">未配置必去行程点，行程设计器导出会被拦截。</span>
              ) : (
                resolvedMustVisit.map((item, index) => (
                  <span className="schedule-chip" key={`${item.location_id}-${index}`}>
                    {item.location_name}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="dashboard-section">
            <div className="dash-header">
              <div className="dash-title">准备进度概览</div>
              <button className="dash-btn" type="button">导出报表</button>
            </div>
            <div className="dash-grid">
              <div className="progress-card">
                <div className="ring-container">
                  <svg width="100" height="100">
                    <circle className="ring-bg" cx="50" cy="50" r="40"></circle>
                    <circle
                      className="ring-val"
                      cx="50"
                      cy="50"
                      r="40"
                      style={{
                        strokeDasharray: 251,
                        strokeDashoffset: Math.max(0, 251 - (completionStats.percent / 100) * 251)
                      }}
                    ></circle>
                  </svg>
                  <div className="ring-text">{completionStats.percent}%</div>
                </div>
                <div className="ring-title">整体完成度</div>
                <div className="ring-sub">
                  {daysToStart !== null ? `预计 ${Math.max(daysToStart, 0)} 天后出发` : '未设置出发日期'}
                </div>
              </div>

              <div className="staff-list">
                {completionStats.modules.map((module) => (
                  <div className="staff-row" key={module.key}>
                    <div className="avatar" style={{ background: '#f1f5f9', color: module.color }}>
                      {module.label.slice(0, 1)}
                    </div>
                    <div className="staff-info">
                    <div className="staff-name">{module.label}</div>
                    <div className="staff-role">按食行卡片填写完成度统计</div>
                  </div>
                  <div className="task-bar">
                    <div className="task-fill" style={{ width: `${module.ratio}%`, background: module.color }}></div>
                    </div>
                    <div className="task-stat" style={{ color: module.color }}>{module.ratio}%</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="day-block">
            <div className="day-header">
              <div className="day-title">食行卡片预览</div>
              <button
                type="button"
                className="day-action"
                onClick={() => onNavigateTab?.('logistics')}
              >
                查看全部
              </button>
            </div>

            {previewDays.length === 0 && (
              <div className="empty-state">暂无食行卡片数据</div>
            )}

            {previewDays.map((day, index) => {
              const dayMeals = day.meals || {};
              const scheduleItems = (scheduleSummary.get(day.date) || []).filter(isItineraryItem);
              const hotelDone = day.hotel_disabled || isTextFilled(day.hotel) || isTextFilled(day.hotel_address);
              const vehicleDone = day.vehicle_disabled
                || isTextFilled(day.vehicle?.plate)
                || isTextFilled(day.vehicle?.driver)
                || isTextFilled(day.vehicle?.phone)
                || isTextFilled(day.vehicle?.name);
              const guideDone = day.guide_disabled || isTextFilled(day.guide?.name) || isTextFilled(day.guide?.phone);
              const securityDone = day.security_disabled || isTextFilled(day.security?.name) || isTextFilled(day.security?.phone);
              const mealsDone = isMealComplete(dayMeals, day.meals_disabled);
              const statusItems = [
                { key: 'hotel', label: '住宿', done: hotelDone },
                { key: 'vehicle', label: '车辆', done: vehicleDone },
                { key: 'guide', label: '导游', done: guideDone },
                { key: 'security', label: '安保', done: securityDone },
                { key: 'meals', label: '餐饮', done: mealsDone }
              ];
              const mealEntries = [
                {
                  key: 'breakfast',
                  label: '早餐',
                  place: dayMeals.breakfast_place,
                  plan: dayMeals.breakfast,
                  disabled: dayMeals.breakfast_disabled
                },
                {
                  key: 'lunch',
                  label: '午餐',
                  place: dayMeals.lunch_place,
                  plan: dayMeals.lunch,
                  disabled: dayMeals.lunch_disabled
                },
                {
                  key: 'dinner',
                  label: '晚餐',
                  place: dayMeals.dinner_place,
                  plan: dayMeals.dinner,
                  disabled: dayMeals.dinner_disabled
                }
              ];
              const visibleMeals = mealEntries.filter((meal) => !meal.disabled);
              return (
                <div className="shixing-card" key={`${day.date}-${index}`}>
                  <div className="card-row">
                    <div className="card-label">日期</div>
                    <div className="card-content">
                      <strong>{dayjs(day.date).format('MM-DD')}</strong>
                      <span className="muted">{weekdayLabel(day.date)}</span>
                    </div>
                  </div>
                  <div className="card-row">
                    <div className="card-label">录入状态</div>
                    <div className="card-content">
                      {statusItems.map((item) => (
                        <span
                          key={`${day.date}-${item.key}`}
                          className={`status-badge ${item.done ? 'done' : 'pending'}`}
                        >
                          {item.label}{item.done ? '已填' : '未填'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="card-row">
                    <div className="card-label">餐饮安排</div>
                    <div className="card-content">
                      {visibleMeals.length === 0 && (
                        <span className="muted">无用餐安排</span>
                      )}
                      {visibleMeals.map((meal) => {
                        const text = [meal.place, meal.plan].filter(Boolean).join(' · ') || '未填写';
                        return (
                          <span className="schedule-chip" key={`${day.date}-${meal.key}`}>
                            {meal.label}：{text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="card-row">
                    <div className="card-label">行程安排</div>
                    <div className="card-content">
                      {scheduleItems.length === 0 && (
                        <span className="muted">暂无行程安排</span>
                      )}
                      {scheduleItems.map((item) => (
                        <span className="schedule-chip" key={`${day.date}-${item.id || item.startTime}`}>
                          {(item.startTime || item.start_time || '--:--')} {resolveEventTitle(item)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="doc-body">
            <div className="doc-section-title">备注说明</div>
            <textarea
              className="doc-textarea"
              rows={5}
              placeholder="点击输入详细备注..."
              value={draft.notes || ''}
              onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default ProfileView;

