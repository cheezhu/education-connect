import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';

const weekdayLabel = (dateStr) => {
  const day = dayjs(dateStr).day();
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return labels[day] || '';
};

const resolveEventTitle = (event) => {
  return event?.title || event?.location || event?.description || '未命名活动';
};

const ProfileView = ({ group, schedules, itineraryPlans = [], onUpdate, onDelete, hasMembers }) => {
  const [draft, setDraft] = useState(group || {});
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const containerRef = useRef(null);
  const resizeStateRef = useRef({ startX: 0, startWidth: 450 });
  const hydrateRef = useRef(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!group) {
      setDraft({});
      return;
    }
    hydrateRef.current = true;
    setDraft(group);
  }, [group?.id]);

  useEffect(() => {
    if (!group?.id || !onUpdate) return;
    if (hydrateRef.current) {
      hydrateRef.current = false;
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate(draft);
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [draft, group?.id, onUpdate]);

  const handleFieldChange = (field, value) => {
    setDraft((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'start_date' || field === 'end_date') {
        if (next.start_date && next.end_date) {
          next.duration = dayjs(next.end_date).diff(dayjs(next.start_date), 'day') + 1;
        }
      }
      return next;
    });
  };

  const handleCountChange = (field, value) => {
    const numeric = Number(value);
    handleFieldChange(field, Number.isFinite(numeric) ? numeric : 0);
  };

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

  if (!group) {
    return (
      <div className="profile-layout">
        <div className="profile-sidebar">
          <div className="empty-state">请选择团组以查看详情</div>
        </div>
        <div className="profile-main">
          <div className="empty-state">暂无时间轴数据</div>
        </div>
      </div>
    );
  }

  const totalCount = (draft.student_count || 0) + (draft.teacher_count || 0);
  const tagValue = Array.isArray(draft.tags) ? draft.tags.join(', ') : (draft.tags || '');

  const handleResizeStart = (event) => {
    event.preventDefault();
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth
    };

    const handleMouseMove = (moveEvent) => {
      if (!containerRef.current) return;
      const delta = moveEvent.clientX - resizeStateRef.current.startX;
      const containerWidth = containerRef.current.getBoundingClientRect().width;
      const minSidebar = 320;
      const minMain = 360;
      const maxSidebar = Math.max(minSidebar, containerWidth - minMain);
      const nextWidth = Math.min(
        Math.max(resizeStateRef.current.startWidth + delta, minSidebar),
        maxSidebar
      );
      setSidebarWidth(nextWidth);
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

  return (
    <div className="profile-layout" ref={containerRef}>
      <div className="profile-sidebar" style={{ width: sidebarWidth }}>
        <div className="prop-section">
          <div className="prop-section-title">基本信息</div>
          <div className="prop-grid">
            <div className="prop-label">团组名称</div>
            <input
              className="prop-input"
              value={draft.name || ''}
              onChange={(event) => handleFieldChange('name', event.target.value)}
            />

            <div className="prop-label">类型/状态</div>
            <div className="compact-row">
              <select
                className="prop-input"
                value={draft.type || ''}
                onChange={(event) => handleFieldChange('type', event.target.value)}
              >
                <option value="">类型</option>
                <option value="secondary">中学</option>
                <option value="primary">小学</option>
              </select>
              <select
                className="prop-input"
                value={draft.status || ''}
                onChange={(event) => handleFieldChange('status', event.target.value)}
              >
                <option value="">自动</option>
                <option value="准备中">准备中</option>
                <option value="进行中">进行中</option>
                <option value="已完成">已完成</option>
                <option value="已取消">已取消</option>
              </select>
            </div>

            <div className="prop-label">起止日期</div>
            <div className="compact-row">
              <input
                className="prop-input"
                type="date"
                value={draft.start_date || ''}
                onChange={(event) => handleFieldChange('start_date', event.target.value)}
              />
              <span>-</span>
              <input
                className="prop-input"
                type="date"
                value={draft.end_date || ''}
                onChange={(event) => handleFieldChange('end_date', event.target.value)}
              />
            </div>

            <div className="prop-label">颜色/天数</div>
            <div className="compact-row">
              <input
                className="prop-input color-input"
                type="color"
                value={draft.color || '#1890ff'}
                onChange={(event) => handleFieldChange('color', event.target.value)}
                style={{ maxWidth: 110, flex: '0 0 110px' }}
              />
              <input
                className="prop-input"
                value={draft.duration || ''}
                disabled
                style={{ maxWidth: 80, flex: '0 0 80px' }}
              />
            </div>

            <div className="prop-label">
              人数信息
              {hasMembers && (
                <span
                  className="sync-badge"
                  title="数据来源于人员名单，自动计算"
                >
                  🔗 Auto
                </span>
              )}
            </div>
            <div className="compact-row">
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  className="prop-input"
                  type="number"
                  value={draft.student_count ?? 0}
                  disabled={hasMembers}
                  onChange={(event) => handleCountChange('student_count', event.target.value)}
                  style={{ paddingLeft: 20 }}
                />
                <span style={{ position: 'absolute', left: 6, top: 5, color: '#999', fontSize: 10 }}>生</span>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  className="prop-input"
                  type="number"
                  value={draft.teacher_count ?? 0}
                  disabled={hasMembers}
                  onChange={(event) => handleCountChange('teacher_count', event.target.value)}
                  style={{ paddingLeft: 20 }}
                />
                <span style={{ position: 'absolute', left: 6, top: 5, color: '#999', fontSize: 10 }}>师</span>
              </div>
              <div style={{ width: 40, textAlign: 'right', fontWeight: 'bold', color: '#1890ff' }}>
                {totalCount}
              </div>
            </div>
          </div>
        </div>

        <div className="prop-section">
          <div className="prop-section-title">行程信息</div>
          <div className="prop-grid">
            <div className="prop-label">行程方案</div>
            <select
              className="prop-input"
              value={draft.itinerary_plan_id ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                handleFieldChange('itinerary_plan_id', value ? Number(value) : null);
              }}
            >
              <option value="">未选择</option>
              {(itineraryPlans || []).map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>

            <div className="prop-label">住宿安排</div>
            <input
              className="prop-input"
              value={draft.accommodation || ''}
              onChange={(event) => handleFieldChange('accommodation', event.target.value)}
            />

            <div className="prop-label">备注标签</div>
            <input
              className="prop-input"
              placeholder="逗号分隔"
              value={tagValue}
              onChange={(event) => handleFieldChange('tags', event.target.value)}
            />

            <div className="prop-label">备注</div>
            <textarea
              className="prop-input"
              rows={3}
              value={draft.notes || ''}
              onChange={(event) => handleFieldChange('notes', event.target.value)}
            />
          </div>
        </div>

        <div className="prop-section">
          <div className="prop-section-title">联系信息</div>
          <div className="prop-grid">
            <div className="prop-label">联系人</div>
            <input
              className="prop-input"
              value={draft.contact_person || ''}
              onChange={(event) => handleFieldChange('contact_person', event.target.value)}
            />
            <div className="prop-label">电话</div>
            <input
              className="prop-input"
              value={draft.contact_phone || ''}
              onChange={(event) => handleFieldChange('contact_phone', event.target.value)}
            />
            <div className="prop-label">紧急联系人</div>
            <input
              className="prop-input"
              value={draft.emergency_contact || ''}
              onChange={(event) => handleFieldChange('emergency_contact', event.target.value)}
            />
            <div className="prop-label">紧急电话</div>
            <input
              className="prop-input"
              value={draft.emergency_phone || ''}
              onChange={(event) => handleFieldChange('emergency_phone', event.target.value)}
            />
          </div>
        </div>

        <div className="btn-save-fixed">
          <button className="btn-delete" onClick={onDelete}>删除</button>
          <button className="btn-save" onClick={() => onUpdate?.(draft)}>保存修改</button>
        </div>
      </div>

      <div className="profile-resizer" onMouseDown={handleResizeStart} />

      <div className="profile-main">
        <div className="timeline-stream">
          {groupedSchedules.length === 0 && (
            <div className="empty-state">暂无日程安排</div>
          )}
          {groupedSchedules.map((day, index) => (
            <div className="day-block" key={day.date}>
              <div className="day-dot" style={index % 2 ? { borderColor: '#52c41a' } : undefined}></div>
              <div className="day-title">
                {dayjs(day.date).format('MM-DD')} {weekdayLabel(day.date)}
              </div>
              {day.items.map((item) => (
                <div className="event-item" key={`${day.date}-${item.id || item.startTime || item.start_time}`}
                >
                  <span className="event-time">{item.startTime || item.start_time || '--:--'}</span>
                  <span>{resolveEventTitle(item)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
