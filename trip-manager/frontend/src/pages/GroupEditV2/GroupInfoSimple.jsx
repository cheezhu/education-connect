import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const GroupInfoSimple = ({ groupData, onUpdate, handleAutoSave, isNew }) => {
  const [themePackages, setThemePackages] = useState([]);

  // 模拟获取主题包数据
  useEffect(() => {
    const mockPackages = [
      { id: 'theme_001', name: '科技探索之旅', resourceCount: 3 },
      { id: 'theme_002', name: '文化深度游', resourceCount: 2 },
      { id: 'theme_003', name: '自然生态探索', resourceCount: 2 },
      { id: 'theme_004', name: '学术交流体验', resourceCount: 1 }
    ];
    setThemePackages(mockPackages);
  }, []);

  // 获取当前选中主题包的资源数量
  const getCurrentPackageResourceCount = () => {
    if (!groupData.themePackageId) return 0;
    const currentPackage = themePackages.find(pkg => pkg.id === groupData.themePackageId);
    return currentPackage?.resourceCount || 0;
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
                value={groupData.startDate || ''}
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
                value={groupData.endDate || ''}
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

          {/* 第三行：人数信息 */}
          <div className="info-row">
            <div className="info-item">
              <label>学生人数</label>
              <input
                type="number"
                value={groupData.studentCount || 0}
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
                value={groupData.teacherCount || 0}
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
                <span className="duration-number">{(groupData.studentCount || 0) + (groupData.teacherCount || 0)}</span> 人
              </div>
            </div>
          </div>

          {/* 第四行：联系人信息 */}
          <div className="info-row">
            <div className="info-item">
              <label>联系人</label>
              <input
                type="text"
                value={groupData.contactPerson || ''}
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
                value={groupData.contactPhone || ''}
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

          {/* 第五行：主题包选择 */}
          <div className="info-row">
            <div className="info-item flex-2">
              <label>教育主题包</label>
              <select
                value={groupData.themePackageId || ''}
                onChange={(e) => {
                  onUpdate('themePackageId', e.target.value);
                  handleAutoSave();
                }}
              >
                <option value="">请选择主题包</option>
                {themePackages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="info-item">
              <label>包含资源</label>
              <div className="duration-display">
                <span className="duration-number">
                  {getCurrentPackageResourceCount()}
                </span> 个
              </div>
            </div>
          </div>

          {/* 第六行：备注 */}
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
                学生 {groupData.studentCount || 0}
              </span>
              <span className="stat-divider">|</span>
              <span className="stat-item">老师 {groupData.teacherCount || 0}</span>
              <span className="stat-divider">|</span>
              <span className="stat-item total">总计 {(groupData.studentCount || 0) + (groupData.teacherCount || 0)}</span>
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