import React from 'react';
import { EnvironmentOutlined } from '@ant-design/icons';

const safeText = (value) => (value === undefined || value === null ? '' : String(value));

const SOURCE_META = {
  plan: { label: '必去', className: 'plan' },
  daily: { label: '食行', className: '' },
  shixing: { label: '食行', className: '' },
  custom: { label: '其他', className: '' }
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
  const mainTitle = safeTitle || safeLoc || '未命名活动';

  const tooltipParts = [
    safeTime,
    safeTitle || safeLoc,
    safeLoc && safeLoc !== safeTitle ? `@ ${safeLoc}` : '',
    meta.label
  ].filter(Boolean);

  return (
    <div className="iti-row" title={tooltipParts.join(' ')}>
      <div className="col-time">{safeTime}</div>

      <div className="col-main">
        <div className="main-title">{mainTitle}</div>
        {safeLoc && safeLoc !== mainTitle ? (
          <div className="main-loc">
            <EnvironmentOutlined style={{ fontSize: 12 }} />
            <span>{safeLoc}</span>
          </div>
        ) : null}
      </div>

      <div className="col-meta">
        {metaItems.slice(0, 4).map((item, idx) => (
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

