import React from 'react';
import dayjs from 'dayjs';

const GroupInfoSimple = ({ groupData, onUpdate, handleAutoSave, isNew }) => {
  return (
    <div className="unified-info-view">
      {/* 卡片容器 */}
      <div className="info-card">
        <div className="card-header">
          <span className="card-title">团组信息</span>
          {groupData.status && (
            <span className={`status-badge status-${groupData.status}`}>
              {groupData.status}
            </span>
          )}
        </div>

        <div className="card-body">
          {/* 第一行：名称、类型、颜色 */}
          <div className="info-row">
            <div className="info-item flex-2">
              <label>团组名称</label>
              <input
                type="text"
                value={groupData.name || ''}
                onChange={(e) => {
                  onUpdate('name', e.target.value);
                  handleAutoSave();
                }}
                placeholder="输入团组名称"
              />
            </div>
            <div className="info-item">
              <label>类型</label>
              <select
                value={groupData.type || 'primary'}
                onChange={(e) => {
                  onUpdate('type', e.target.value);
                  handleAutoSave();
                }}
              >
                <option value="primary">小学</option>
                <option value="secondary">中学</option>
              </select>
            </div>
            <div className="info-item color-picker">
              <label>颜色</label>
              <input
                type="color"
                value={groupData.color || '#1890ff'}
                onChange={(e) => {
                  onUpdate('color', e.target.value);
                  handleAutoSave();
                }}
              />
            </div>
          </div>

          {/* 第二行：日期范围 */}
          <div className="info-row">
            <div className="info-item">
              <label>开始日期</label>
              <input
                type="date"
                value={groupData.start_date || ''}
                onChange={(e) => {
                  onUpdate('start_date', e.target.value);
                  handleAutoSave();
                }}
              />
            </div>
            <div className="info-item">
              <label>结束日期</label>
              <input
                type="date"
                value={groupData.end_date || ''}
                onChange={(e) => {
                  onUpdate('end_date', e.target.value);
                  handleAutoSave();
                }}
              />
            </div>
            <div className="info-item">
              <label>行程天数</label>
              <div className="duration-display">
                <span className="duration-number">{groupData.duration || 0}</span> 天
              </div>
            </div>
          </div>

          {/* 第三行：备注 */}
          <div className="info-row">
            <div className="info-item full-width">
              <label>备注</label>
              <textarea
                value={groupData.notes || ''}
                onChange={(e) => {
                  onUpdate('notes', e.target.value);
                  handleAutoSave();
                }}
                placeholder="特殊要求、注意事项等"
                rows={2}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 团员信息卡片 - 只在非新建模式下显示 */}
      {!isNew && (
        <div className="info-card">
          <div className="card-header">
            <span className="card-title">团员信息</span>
            <div className="member-stats">
              <span className="stat-item">
                学生 {groupData.student_count || 0}
              </span>
              <span className="stat-divider">|</span>
              <span className="stat-item">老师 {groupData.teacher_count || 0}</span>
              <span className="stat-divider">|</span>
              <span className="stat-item total">总计 {(groupData.student_count || 0) + (groupData.teacher_count || 0)}</span>
            </div>
          </div>

          <div className="card-body">
            {groupData.members && groupData.members.length > 0 ? (
              <div className="member-grid">
                {groupData.members.map((member, index) => (
                  <span key={member.id || index} className="member-tag">
                    {member.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="empty-members">
                暂无团员信息
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupInfoSimple;