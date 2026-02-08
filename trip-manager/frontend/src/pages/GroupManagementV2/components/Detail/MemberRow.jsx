import React from 'react';

const safeText = (value) => (value === undefined || value === null ? '' : String(value));

const pad2 = (value) => String(value).padStart(2, '0');

const normalizeGender = (value) => {
  const raw = safeText(value).trim();
  if (!raw) return '-';
  if (raw === '男' || raw.toLowerCase() === 'm' || raw.toLowerCase() === 'male') return '男';
  if (raw === '女' || raw.toLowerCase() === 'f' || raw.toLowerCase() === 'female') return '女';
  return raw;
};

const normalizeRole = (value) => {
  const raw = safeText(value).trim();
  if (!raw) return { key: 'OTHER', label: 'OTHER', className: 'role-other' };
  if (raw.includes('老师') || raw.toLowerCase().includes('teacher')) {
    return { key: 'TEACHER', label: 'TEACHER', className: 'role-teacher' };
  }
  if (raw.includes('学生') || raw.toLowerCase().includes('student')) {
    return { key: 'STUDENT', label: 'STUDENT', className: 'role-student' };
  }
  if (raw.includes('家长') || raw.toLowerCase().includes('parent')) {
    return { key: 'PARENT', label: 'PARENT', className: 'role-other' };
  }
  return { key: 'OTHER', label: raw.toUpperCase(), className: 'role-other' };
};

const truncate = (value, maxLen = 14) => {
  const text = safeText(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 3))}...`;
};

const detectAlert = (specialNeeds) => {
  const text = safeText(specialNeeds).trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  const isAllergy = text.includes('过敏') || lower.includes('allergy');
  const isMedical = isAllergy
    || text.includes('哮喘')
    || text.includes('癫痫')
    || text.includes('糖尿病')
    || text.includes('心脏')
    || text.includes('药')
    || text.includes('医疗')
    || text.includes('病')
    || lower.includes('medical');

  if (!isMedical) return '';
  return `⚠️ ${truncate(text, 16)}`;
};

const buildTags = (member) => {
  const tags = [];
  const alert = detectAlert(member?.special_needs);
  if (alert) tags.push({ type: 'danger', text: alert });

  const room = safeText(member?.room_number).trim();
  if (room) tags.push({ type: 'lite', text: `房间 ${truncate(room, 10)}` });

  // Keep neutral tags minimal to avoid visual noise.
  const specialNeeds = safeText(member?.special_needs).trim();
  if (!alert && specialNeeds) {
    tags.push({ type: 'lite', text: truncate(specialNeeds, 18) });
  }

  return tags.slice(0, 3);
};

const MemberRow = ({
  index,
  member,
  onEdit,
  onDelete
}) => {
  const name = safeText(member?.name).trim() || '未命名';
  const phone = safeText(member?.phone).trim() || '-';
  const gender = normalizeGender(member?.gender);
  const role = normalizeRole(member?.role);
  const tags = buildTags(member);

  return (
    <div className="member-row">
      <div className="col-id-index">{pad2(index + 1)}</div>
      <div className="col-name" title={name}>{name}</div>
      <div className="col-role">
        <span className={`role-pill ${role.className}`}>{role.label}</span>
      </div>
      <div className="col-gender">{gender}</div>
      <div className="col-phone">{phone}</div>
      <div className="col-tags">
        {tags.length === 0 ? (
          <span style={{ color: '#9ca3af', fontSize: 10 }}>-</span>
        ) : (
          tags.map((tag) => (
            <span
              key={`${tag.type}-${tag.text}`}
              className={tag.type === 'danger' ? 'tag-danger' : 'tag-lite'}
              title={tag.text}
            >
              {tag.text}
            </span>
          ))
        )}
      </div>
      <div className="col-actions">
        <span
          className="btn-icon"
          role="button"
          tabIndex={0}
          title="编辑"
          onClick={() => onEdit?.(member)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEdit?.(member);
          }}
        >
          ✎
        </span>
        <span
          className="btn-icon"
          role="button"
          tabIndex={0}
          title="删除"
          onClick={() => onDelete?.(member)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onDelete?.(member);
          }}
        >
          ✕
        </span>
      </div>
    </div>
  );
};

export default MemberRow;

