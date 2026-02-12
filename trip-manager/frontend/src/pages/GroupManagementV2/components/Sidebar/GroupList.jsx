import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import SidebarFooter from './SidebarFooter';
import { getGroupTypeLabel } from '../../../../domain/group';

const GroupList = ({
  groups,
  totalCount,
  activeGroupId,
  onSelectGroup,
  onCreateGroup,
  onBulkCreate,
  filters,
  onSearchChange,
  onToggleStatus,
  isCollapsed
}) => {
  const [filterOpen, setFilterOpen] = useState(false);

  const statusOptions = useMemo(() => (
    [
      { value: '准备中', label: '准备中' },
      { value: '进行中', label: '进行中' },
      { value: '已完成', label: '已完成' },
      { value: '已取消', label: '已取消' }
    ]
  ), []);

  const resolvedTotal = Number.isFinite(totalCount) ? totalCount : groups.length;

  const renderMeta = (group) => {
    const start = group.start_date ? dayjs(group.start_date).format('YYYY-MM-DD') : '未设置日期';
    const total = (group.student_count || 0) + (group.teacher_count || 0);
    const typeLabel = getGroupTypeLabel(group.type) || '未设置类型';
    const code = group.group_code ? `#${group.group_code}` : '#未生成';
    return `${code} • ${typeLabel} • ${start} • ${total}人`;
  };

  return (
    <div className={`group-list ${isCollapsed ? 'collapsed' : ''}`} id="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">GROUPS ({resolvedTotal})</span>
        <div className="btn-icon-add" onClick={onCreateGroup}>＋</div>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          className="search-input"
          placeholder="Search..."
          value={filters.searchText}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <div className="btn-filter" onClick={() => setFilterOpen(prev => !prev)}>
          ▼
        </div>
      </div>

      <div className={`filter-popover ${filterOpen ? 'visible' : ''}`}>
        {statusOptions.map(option => (
          <label key={option.value} style={{ display: 'block', padding: '4px' }}>
            <input
              type="checkbox"
              checked={filters.statusFilters.includes(option.value)}
              onChange={() => onToggleStatus(option.value)}
            />{' '}
            {option.label}
          </label>
        ))}
      </div>

      <div className="list-content">
        {groups.map((group) => (
          <div
            key={group.id}
            className={`list-item ${group.id === activeGroupId ? 'active' : ''}`}
            onClick={() => onSelectGroup(group.id)}
          >
            <div className="item-name">{group.name || '未命名团组'}</div>
            <div className="item-meta">{renderMeta(group)}</div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="empty-state">暂无匹配团组</div>
        )}
      </div>

      <SidebarFooter onBulkCreate={onBulkCreate} />
    </div>
  );
};

export default GroupList;
