import React from 'react';
import { EnvironmentOutlined } from '@ant-design/icons';

const safeText = (value) => (value === undefined || value === null ? '' : String(value));

const SOURCE_META = {
  plan: { label: '\u884c\u7a0b\u70b9', className: 'plan' },
  daily: { label: '\u6bcf\u65e5\u5361', className: '' },
  shixing: { label: '\u6bcf\u65e5\u5361', className: '' },
  custom: { label: '\u81ea\u5b9a\u4e49', className: '' }
};

const ItineraryEventRow = ({
  time,
  title,
  location,
  sourceType,
  metaItems = []
}) => {
  const meta = SOURCE_META[sourceType] ?? SOURCE_META.custom;
  const safeTime = safeText(time).trim() || '--:--';
  const safeTitle = safeText(title).trim();
  const safeLoc = safeText(location).trim();
  const mainTitle = safeTitle || safeLoc || '\u672a\u547d\u540d\u6d3b\u52a8';
  const metaRows = (Array.isArray(metaItems) && metaItems.length > 0)
    ? metaItems.slice(0, 4)
    : ['\u5907\u6ce8: -'];

  const tooltipParts = [
    safeTime,
    safeTitle || safeLoc,
    safeLoc ? `@ ${safeLoc}` : '',
    meta.label
  ].filter(Boolean);

  return (
    <div className="iti-row" title={tooltipParts.join(' ')}>
      <div className="col-time">{safeTime}</div>

      <div className="col-main">
        <div className="main-title">{mainTitle}</div>
        <div className="main-loc">
          <EnvironmentOutlined style={{ fontSize: 12 }} />
          <span>{`\u5730\u5740: ${safeLoc || '-'}`}</span>
        </div>
      </div>

      <div className="col-meta">
        {metaRows.map((item, idx) => (
          <div className="meta-item" key={`${item}-${idx}`}>
            {safeText(item)}
          </div>
        ))}
      </div>

      <div className="col-tag">
        <span className={`source-pill${meta.className ? ` ${meta.className}` : ''}`}>
          {meta.label}
        </span>
      </div>
    </div>
  );
};

export default ItineraryEventRow;
