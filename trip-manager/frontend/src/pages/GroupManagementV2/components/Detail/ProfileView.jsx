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

const buildBaseProperties = (group, itineraryPlans, hasMembers) => {
  const tagsValue = Array.isArray(group.tags) ? group.tags.join(', ') : (group.tags || '');
  const dateValue = buildDateValue(group.start_date, group.end_date);
  const totalCount = (group.student_count || 0) + (group.teacher_count || 0);
  const planOptions = (itineraryPlans || []).map((plan) => ({
    value: String(plan.id),
    label: plan.name
  }));
  const typeOptions = [
    { value: 'primary', label: '小学' },
    { value: 'secondary', label: '中学' }
  ];

  return [
    {
      id: 'dates',
      key: 'Dates',
      value: dateValue,
      type: 'date',
      icon: 'CAL',
      field: 'dates',
      placeholder: 'YYYY-MM-DD → YYYY-MM-DD'
    },
    {
      id: 'duration',
      key: 'Duration',
      value: group.duration || '',
      type: 'number',
      icon: '#',
      field: 'duration',
      readOnly: true
    },
    {
      id: 'type',
      key: 'Type',
      value: group.type || '',
      type: 'select',
      icon: 'SCH',
      field: 'type',
      options: typeOptions
    },
    {
      id: 'students',
      key: 'Students',
      value: group.student_count ?? '',
      type: 'number',
      icon: '#',
      field: 'student_count',
      readOnly: hasMembers,
      badge: hasMembers ? 'Auto' : ''
    },
    {
      id: 'teachers',
      key: 'Teachers',
      value: group.teacher_count ?? '',
      type: 'number',
      icon: '#',
      field: 'teacher_count',
      readOnly: hasMembers,
      badge: hasMembers ? 'Auto' : ''
    },
    {
      id: 'total',
      key: 'Total',
      value: totalCount,
      type: 'number',
      icon: '#',
      field: 'total',
      readOnly: true
    },
    {
      id: 'plan',
      key: 'Plan',
      value: group.itinerary_plan_id ? String(group.itinerary_plan_id) : '',
      type: 'select',
      icon: 'v',
      field: 'itinerary_plan_id',
      options: planOptions
    },
    {
      id: 'accommodation',
      key: 'Accommodation',
      value: group.accommodation || '',
      type: 'text',
      icon: 'HOT',
      field: 'accommodation'
    },
    {
      id: 'color',
      key: 'Color',
      value: group.color || '#1890ff',
      type: 'color',
      icon: 'CLR',
      field: 'color'
    },
    {
      id: 'tags',
      key: 'Tags',
      value: tagsValue,
      type: 'text',
      icon: 'TAG',
      field: 'tags'
    },
    {
      id: 'contact_person',
      key: 'Main Contact',
      value: group.contact_person || '',
      type: 'person',
      icon: '@',
      field: 'contact_person'
    },
    {
      id: 'contact_phone',
      key: 'Contact Phone',
      value: group.contact_phone || '',
      type: 'text',
      icon: 'TEL',
      field: 'contact_phone'
    },
    {
      id: 'emergency_contact',
      key: 'Emergency Contact',
      value: group.emergency_contact || '',
      type: 'person',
      icon: '!',
      field: 'emergency_contact'
    },
    {
      id: 'emergency_phone',
      key: 'Emergency Phone',
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

const ProfileView = ({
  group,
  schedules,
  itineraryPlans = [],
  onUpdate,
  hasMembers,
  rightPanelWidth = 260,
  onResizeRightPanel
}) => {
  const [draft, setDraft] = useState(group || null);
  const [properties, setProperties] = useState([]);
  const containerRef = useRef(null);
  const resizeStateRef = useRef({ startX: 0, startWidth: 260, containerWidth: 0 });
  const resizerWidth = 6;
  const minCenter = 420;
  const minRightPanel = 220;
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
    setDraft({ ...group });
    const base = buildBaseProperties(group, itineraryPlans, hasMembers);
    setProperties(mergeCustomProperties(base, group.properties));
  }, [group?.id, itineraryPlans, hasMembers]);

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

  const groupedSchedules = useMemo(() => {
    const map = new Map();
    (schedules || []).forEach((item) => {
      const date = item.activity_date || item.date;
      if (!date) return;
      if (!map.has(date)) map.set(date, []);
      map.get(date).push(item);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, items]) => {
        const sortedItems = items
          .slice()
          .sort((a, b) => {
            const aTime = a.startTime || a.start_time || '';
            const bTime = b.startTime || b.start_time || '';
            return aTime.localeCompare(bTime);
          });
        return { date, items: sortedItems };
      });
  }, [schedules]);

  if (!group || !draft) {
    return (
      <div className="profile-layout">
        <div className="profile-center">
          <div className="empty-state">请选择团组以查看详情</div>
        </div>
        <div className="profile-resizer" />
        <div className="profile-right">
          <div className="empty-state">暂无时间轴数据</div>
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
          if (updated.field === 'itinerary_plan_id') {
            nextDraft.itinerary_plan_id = updates.value ? Number(updates.value) : null;
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
    const newProp = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      key: typeMeta.label,
      value: '',
      type: typeMeta.type,
      icon: typeMeta.icon,
      isCustom: true
    };
    setProperties((prev) => [...prev, newProp]);
    return newProp.id;
  };

  const handleResizeStart = (event) => {
    event.preventDefault();
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: rightPanelWidth,
      containerWidth: containerRef.current?.getBoundingClientRect().width || 0
    };

    const handleMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - resizeStateRef.current.startX;
      const containerWidth = resizeStateRef.current.containerWidth;
      if (!containerWidth) return;
      const maxRight = Math.max(minRightPanel, containerWidth - minCenter - resizerWidth);
      const nextRightWidth = Math.min(
        Math.max(resizeStateRef.current.startWidth - delta, minRightPanel),
        maxRight
      );
      onResizeRightPanel?.(Math.round(nextRightWidth));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const statusOptions = [
    { value: null, label: '自动' },
    { value: '准备中', label: '准备中' },
    { value: '进行中', label: '进行中' },
    { value: '已完成', label: '已完成' },
    { value: '已取消', label: '已取消' }
  ];

  return (
    <div className="profile-layout" ref={containerRef}>
      <div className="profile-center">
        <div className="identity-header">
          <input
            className="id-input"
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

        <div className="doc-body">
          <div className="doc-title">备注说明</div>
          <textarea
            className="doc-textarea"
            rows={5}
            placeholder="点击输入详细备注..."
            value={draft.notes || ''}
            onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </div>
      </div>

      <div className="profile-resizer" onMouseDown={handleResizeStart} />

      <div
        className="profile-right"
        style={{
          width: rightPanelWidth,
          flex: `0 0 ${typeof rightPanelWidth === 'number' ? `${rightPanelWidth}px` : rightPanelWidth}`
        }}
      >
        <div className="timeline-title">TIMELINE</div>
        {groupedSchedules.length === 0 && (
          <div className="empty-state">暂无日程安排</div>
        )}
        {groupedSchedules.map((day, index) => (
          <div className="mini-day" key={day.date}>
            <div className="mini-day-title">
              {dayjs(day.date).format('MM-DD')} {weekdayLabel(day.date)}
            </div>
            {day.items.map((item) => (
              <div
                className="mini-event"
                key={`${day.date}-${item.id || item.startTime || item.start_time}`}
                style={index % 2 ? { borderLeftColor: '#10b981' } : undefined}
              >
                <div className="mini-time">{item.startTime || item.start_time || '--:--'}</div>
                <div className="mini-title">{resolveEventTitle(item)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileView;

