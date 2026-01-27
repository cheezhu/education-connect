import React, { useState } from 'react';

const GroupInfoSimple = ({ groupData, itineraryPlans, onUpdate, handleAutoSave, isNew }) => {
  const [tagInput, setTagInput] = useState('');
  const tags = Array.isArray(groupData.tags) ? groupData.tags : [];

  const handleAddTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag) return;
    if (tags.includes(nextTag)) {
      setTagInput('');
      return;
    }
    const nextTags = [...tags, nextTag];
    onUpdate('tags', nextTags);
    handleAutoSave();
    setTagInput('');
  };

  const handleRemoveTag = (tag) => {
    const nextTags = tags.filter(item => item !== tag);
    onUpdate('tags', nextTags);
    handleAutoSave();
  };

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

          {/* 行程方案 */}
          <div className="info-row">
            <div className="info-item full-width">
              <label>行程方案</label>
              <select
                value={groupData.itinerary_plan_id ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  onUpdate('itinerary_plan_id', value ? Number(value) : null);
                  handleAutoSave();
                }}
              >
                <option value="">未选择</option>
                {(itineraryPlans || []).map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 第三行：人数信息 */}
          <div className="info-row">
            <div className="info-item">
              <label>学生人数</label>
              <input
                type="number"
                value={groupData.student_count || 0}
                onChange={(e) => {
                  onUpdate('student_count', parseInt(e.target.value) || 0);
                  handleAutoSave();
                }}
                min="0"
                placeholder="0"
              />
            </div>
            <div className="info-item">
              <label>老师人数</label>
              <input
                type="number"
                value={groupData.teacher_count || 0}
                onChange={(e) => {
                  onUpdate('teacher_count', parseInt(e.target.value) || 0);
                  handleAutoSave();
                }}
                min="0"
                placeholder="0"
              />
            </div>
            <div className="info-item">
              <label>总人数</label>
              <div className="duration-display">
                <span className="duration-number">{(groupData.student_count || 0) + (groupData.teacher_count || 0)}</span> 人
              </div>
            </div>
          </div>

          {/* 第四行：联系人信息 */}
          <div className="info-row">
            <div className="info-item">
              <label>联系人</label>
              <input
                type="text"
                value={groupData.contact_person || ''}
                onChange={(e) => {
                  onUpdate('contact_person', e.target.value);
                  handleAutoSave();
                }}
                placeholder="联系人姓名"
              />
            </div>
            <div className="info-item">
              <label>联系电话</label>
              <input
                type="tel"
                value={groupData.contact_phone || ''}
                onChange={(e) => {
                  onUpdate('contact_phone', e.target.value);
                  handleAutoSave();
                }}
                placeholder="联系电话"
              />
            </div>
            <div className="info-item">
              <label>紧急联系人</label>
              <input
                type="text"
                value={groupData.emergency_contact || ''}
                onChange={(e) => {
                  onUpdate('emergency_contact', e.target.value);
                  handleAutoSave();
                }}
                placeholder="紧急联系人"
              />
            </div>
          </div>

          {/* 住宿安排 */}
          <div className="info-row">
            <div className="info-item full-width">
              <label>住宿安排</label>
              <input
                type="text"
                value={groupData.accommodation || ''}
                onChange={(e) => {
                  onUpdate('accommodation', e.target.value);
                  handleAutoSave();
                }}
                placeholder="住宿酒店或安排说明"
              />
            </div>
          </div>

          {/* 备注标签 */}
          <div className="info-row">
            <div className="info-item full-width">
              <label>备注标签</label>
              <div className="group-tag-input">
                <div className="group-tag-list">
                  {tags.length ? (
                    tags.map(tag => (
                      <span key={tag} className="group-tag-pill">
                        {tag}
                        <button type="button" onClick={() => handleRemoveTag(tag)}>×</button>
                      </span>
                    ))
                  ) : (
                    <span className="group-tag-empty">暂无标签</span>
                  )}
                </div>
                <div className="group-tag-controls">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="输入标签后回车"
                  />
                  <button
                    type="button"
                    className="tag-add-btn"
                    onClick={handleAddTag}
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 备注 */}
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
