import React, { useEffect, useRef, useState } from 'react';

const PROPERTY_TYPES = [
  { type: 'text', label: '文本', icon: 'Aa' },
  { type: 'number', label: '数字', icon: '#' },
  { type: 'select', label: '选择', icon: 'v' },
  { type: 'date', label: '日期', icon: 'CAL' },
  { type: 'person', label: '人员', icon: '@' }
];

const PropertyRow = ({
  property,
  onChangeKey,
  onChangeValue,
  shouldFocus,
  onFocusHandled
}) => {
  const keyRef = useRef(null);
  const parseDateRange = (value) => {
    const matches = String(value || '').match(/\d{4}-\d{2}-\d{2}/g) || [];
    if (matches.length === 0) return { start: '', end: '' };
    if (matches.length === 1) return { start: matches[0], end: '' };
    return { start: matches[0], end: matches[1] };
  };

  useEffect(() => {
    if (!shouldFocus) return;
    if (keyRef.current) {
      keyRef.current.focus();
      keyRef.current.select();
    }
    onFocusHandled?.();
  }, [shouldFocus, onFocusHandled]);

  const renderValueInput = () => {
    const commonProps = {
      className: 'prop-input',
      value: property.value ?? '',
      placeholder: property.placeholder || '未填写',
      readOnly: property.readOnly,
      disabled: property.readOnly,
      onChange: (event) => onChangeValue?.(event.target.value)
    };

    if (property.type === 'date') {
      const { start, end } = parseDateRange(property.value);
      return (
        <div className="date-range">
          <input
            className="prop-input date-input"
            type="date"
            value={start}
            onChange={(event) => {
              const next = `${event.target.value}${end ? ` → ${end}` : ''}`;
              onChangeValue?.(next);
            }}
          />
          <span className="date-sep">→</span>
          <input
            className="prop-input date-input"
            type="date"
            value={end}
            onChange={(event) => {
              const next = `${start}${event.target.value ? ` → ${event.target.value}` : ''}`;
              onChangeValue?.(next);
            }}
          />
        </div>
      );
    }

    if (property.type === 'select' && Array.isArray(property.options)) {
      return (
        <select
          className="prop-input"
          value={property.value ?? ''}
          onChange={(event) => onChangeValue?.(event.target.value)}
          disabled={property.readOnly}
        >
          <option value="">未选择</option>
          {property.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (property.type === 'number') {
      return <input type="number" {...commonProps} />;
    }

    if (property.type === 'color') {
      return <input type="color" {...commonProps} />;
    }

    return <input type="text" {...commonProps} />;
  };

  return (
    <div className="prop-row">
      <div className="prop-key-area">
        <span className="prop-handle">::</span>
        <span className="prop-icon">{property.icon || 'Aa'}</span>
        <input
          ref={keyRef}
          className="prop-key-label"
          value={property.key || ''}
          placeholder="属性名"
          onChange={(event) => onChangeKey?.(event.target.value)}
        />
      </div>
      <div className="prop-val-area">
        {renderValueInput()}
        {property.badge ? <span className="prop-badge">{property.badge}</span> : null}
      </div>
    </div>
  );
};

const PropertyGrid = ({ properties = [], onChangeProperty, onAddProperty, showAdd = true }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingFocusId, setPendingFocusId] = useState(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleAdd = (typeMeta) => {
    const newId = onAddProperty?.(typeMeta);
    if (newId) {
      setPendingFocusId(newId);
    }
    setMenuOpen(false);
  };

  return (
    <div className="prop-grid">
      {properties.map((prop) => (
        <PropertyRow
          key={prop.id}
          property={prop}
          onChangeKey={(value) => onChangeProperty?.(prop.id, { key: value })}
          onChangeValue={(value) => onChangeProperty?.(prop.id, { value })}
          shouldFocus={pendingFocusId === prop.id}
          onFocusHandled={() => setPendingFocusId(null)}
        />
      ))}

      {showAdd && (
        <div className="add-prop-wrapper" ref={wrapperRef}>
          <div className="add-prop-btn" onClick={() => setMenuOpen((prev) => !prev)}>
            + 添加字段
          </div>
          <div className={`type-menu ${menuOpen ? 'visible' : ''}`}>
            {PROPERTY_TYPES.map((typeMeta) => (
              <div
                className="type-item"
                key={typeMeta.type}
                onClick={() => handleAdd(typeMeta)}
              >
                <span>{typeMeta.icon}</span>
                {typeMeta.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyGrid;

