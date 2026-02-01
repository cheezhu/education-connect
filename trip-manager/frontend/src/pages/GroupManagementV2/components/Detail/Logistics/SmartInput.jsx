import React, { useEffect, useId, useRef, useState } from 'react';

const SmartInput = ({
  value,
  onChange,
  placeholder,
  className = '',
  type = 'text',
  options = [],
  listId,
  readOnly = false,
  disabled = false,
  style,
  onBlur,
  onFocus
}) => {
  const reactId = useId();
  const dataListId = options.length ? (listId || `smart-input-${reactId}`) : undefined;
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);
  const displayValue = value ?? '';
  const isEmpty = displayValue === '';

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [editing]);

  const handleActivate = () => {
    if (readOnly || disabled) return;
    setEditing(true);
  };

  if (!editing && !readOnly && !disabled) {
    return (
      <div
        className={`smart-input smart-input-display ${isEmpty ? 'is-empty' : ''} ${className}`}
        onClick={handleActivate}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handleActivate();
          }
        }}
        role="button"
        tabIndex={0}
        style={style}
      >
        {isEmpty ? (placeholder || '点击填写') : displayValue}
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        className={`smart-input ${className}`}
        type={type}
        value={displayValue}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        onFocus={onFocus}
        onBlur={(event) => {
          setEditing(false);
          onBlur?.(event);
        }}
        list={dataListId}
        style={style}
      />
      {dataListId && (
        <datalist id={dataListId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </>
  );
};

export default SmartInput;

