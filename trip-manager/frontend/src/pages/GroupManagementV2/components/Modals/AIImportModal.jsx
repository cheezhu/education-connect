import React from 'react';

const formatScheduleTime = (item) => {
  const start = item?.startTime || '--:--';
  const end = item?.endTime || '--:--';
  return `${start}-${end}`;
};

const summarizeLogisticsPatch = (patch) => {
  const lines = [];
  const meals = patch?.meals || {};
  ['breakfast', 'lunch', 'dinner'].forEach((key) => {
    const meal = meals[key];
    if (!meal) return;
    const label = key === 'breakfast' ? '早餐' : key === 'lunch' ? '午餐' : '晚餐';
    const arrangement = meal.arrangement || '';
    const place = meal.place || '';
    const time = meal.startTime && meal.endTime ? `${meal.startTime}-${meal.endTime}` : '';
    lines.push(`${label}${time ? `(${time})` : ''} ${arrangement}${place ? ` @${place}` : ''}`.trim());
  });

  ['pickup', 'dropoff'].forEach((key) => {
    const info = patch?.[key];
    if (!info || typeof info !== 'object') return;
    const label = key === 'pickup' ? '接站' : '送站';
    const time = info.time && info.endTime ? `${info.time}-${info.endTime}` : (info.time || '');
    const flight = info.flightNo ? `航班 ${info.flightNo}` : '';
    const location = info.location ? `@${info.location}` : '';
    const desc = [label, time, flight, location].filter(Boolean).join(' ');
    if (desc) lines.push(desc);
  });

  if (patch?.hotel) {
    lines.push(`酒店 ${patch.hotel}`);
  }

  return lines;
};

const AIImportModal = ({
  open,
  groupName,
  rawText,
  onRawTextChange,
  onClose,
  onParse,
  onApply,
  parsing = false,
  applying = false,
  result
}) => {
  return (
    <div className={`modal-overlay ${open ? 'visible' : ''}`}>
      <div className="modal-box ai-import-modal">
        <div className="modal-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>AI导入行程</span>
            <span className="ai-import-subtitle">{groupName ? `目标团组：${groupName}` : '请选择团组'}</span>
          </div>
          <span style={{ cursor: 'pointer' }} onClick={onClose}>X</span>
        </div>

        <div className="modal-body ai-import-body">
          <div className="ai-import-input-card">
            <div className="ai-import-label">粘贴行程文本</div>
            <textarea
              className="ai-import-textarea"
              placeholder="示例：&#10;2025-07-01 08:30-09:30 早餐 香港酒店&#10;2025-07-01 10:00-12:00 香港科学馆&#10;2025-07-01 14:00-16:00 香港警队博物馆&#10;2025-07-01 18:00-19:00 晚餐"
              value={rawText}
              onChange={(event) => onRawTextChange(event.target.value)}
              disabled={parsing || applying}
            />
            <div className="ai-import-actions-row">
              <button className="btn-delete" onClick={onClose} disabled={parsing || applying}>
                取消
              </button>
              <button className="btn-save" onClick={onParse} disabled={parsing || applying || !rawText?.trim()}>
                {parsing ? '解析中...' : '解析预览'}
              </button>
            </div>
          </div>

          {result ? (
            <div className="ai-import-preview-card">
              <div className="ai-import-summary">
                <span>行数 {result?.summary?.lineCount ?? 0}</span>
                <span>活动 {result?.summary?.scheduleCount ?? 0}</span>
                <span>每日卡片日期 {result?.summary?.logisticsDayCount ?? 0}</span>
                <span>警告 {result?.summary?.warningCount ?? 0}</span>
              </div>

              <div className="ai-import-section-title">活动候选</div>
              <div className="ai-import-table-wrap">
                <table className="bulk-table ai-import-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>时间</th>
                      <th>标题</th>
                      <th>地点</th>
                      <th>来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.scheduleCandidates || []).map((item, idx) => (
                      <tr key={`${item.date}-${item.startTime}-${idx}`}>
                        <td>{item.date}</td>
                        <td>{formatScheduleTime(item)}</td>
                        <td>{item.title || '-'}</td>
                        <td>{item.location || '-'}</td>
                        <td>{item.source || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ai-import-section-title">每日卡片补丁</div>
              <div className="ai-import-patch-list">
                {(result.logisticsPatches || []).map((patch) => (
                  <div key={patch.date} className="ai-import-patch-item">
                    <div className="ai-import-patch-date">{patch.date}</div>
                    <div className="ai-import-patch-lines">
                      {summarizeLogisticsPatch(patch).map((line, idx) => (
                        <div key={`${patch.date}-line-${idx}`}>{line}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {(result.warnings || []).length > 0 ? (
                <>
                  <div className="ai-import-section-title">解析警告</div>
                  <div className="ai-import-warning-list">
                    {(result.warnings || []).map((warn, idx) => (
                      <div key={`warn-${idx}`}>{warn}</div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="modal-header" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="ai-import-subtitle">确认后将自动写入日历详情与每日卡片</span>
          <button
            className="btn-save"
            onClick={onApply}
            disabled={applying || parsing || !result}
          >
            {applying ? '导入中...' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIImportModal;
