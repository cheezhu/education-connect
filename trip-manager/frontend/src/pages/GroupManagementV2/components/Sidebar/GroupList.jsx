import React from 'react';
import dayjs from 'dayjs';
import SidebarFooter from './SidebarFooter';
import { getGroupTypeLabel } from '../../../../domain/group';
import { UNNAMED_GROUP_NAME } from '../../constants';

const GroupList = ({
  groups,
  totalCount,
  activeGroupId,
  onSelectGroup,
  onCreateGroup,
  onBulkCreate,
  isCollapsed
}) => {
  const toGroupIdKey = (value) => String(value ?? '');
  const isSameGroupId = (left, right) => toGroupIdKey(left) !== '' && toGroupIdKey(left) === toGroupIdKey(right);
  const resolvedTotal = Number.isFinite(totalCount) ? totalCount : groups.length;
  const visibleCount = groups.length;

  const renderMeta = (group) => {
    const start = group.start_date ? dayjs(group.start_date).format('YYYY-MM-DD') : '未设置日期';
    const total = (group.student_count || 0) + (group.teacher_count || 0);
    const typeLabel = getGroupTypeLabel(group.type) || '未设置类型';
    return `${typeLabel} • ${start} • ${total}人`;
  };

  const resolveDisplayName = (group) => {
    const value = String(group?.name || '').trim();
    return value || UNNAMED_GROUP_NAME;
  };

  return (
    <div className={`group-list ${isCollapsed ? 'collapsed' : ''}`} id="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">
          GROUPS ({visibleCount}{resolvedTotal !== visibleCount ? `/${resolvedTotal}` : ''})
        </span>
        <div className="btn-icon-add" onClick={onCreateGroup}>＋</div>
      </div>

      <div className="list-content">
        {groups.map((group) => (
          <div
            key={group.id}
            className={`list-item ${isSameGroupId(group.id, activeGroupId) ? 'active' : ''}`}
            onClick={() => onSelectGroup(group.id)}
          >
            <div className="item-name">{resolveDisplayName(group)}</div>
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
