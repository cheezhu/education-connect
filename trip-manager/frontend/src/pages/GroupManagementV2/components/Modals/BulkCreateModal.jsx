import React from 'react';

const BulkCreateModal = ({
  open,
  rows,
  errors,
  onChangeRow,
  onAddRow,
  onRemoveRow,
  onClose,
  onSubmit,
  submitting
}) => {
  return (
    <div className={`modal-overlay ${open ? 'visible' : ''}`}>
      <div className="modal-box">
        <div className="modal-header">
          <span>批量创建团组</span>
          <span style={{ cursor: 'pointer' }} onClick={onClose}>✕</span>
        </div>
        <div className="modal-body">
          <table className="bulk-table">
            <thead>
              <tr>
                <th>#</th>
                <th>团组名称</th>
                <th>类型</th>
                <th>日期</th>
                <th>人数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const rowErrors = errors[row.id] || {};
                return (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        className={`bulk-input ${rowErrors.name ? 'error' : ''}`}
                        value={row.name}
                        onChange={(event) => onChangeRow(row.id, { name: event.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className={`bulk-input ${rowErrors.type ? 'error' : ''}`}
                        value={row.type || ''}
                        onChange={(event) => onChangeRow(row.id, { type: event.target.value })}
                      >
                        <option value="">请选择</option>
                        <option value="vip">VIP</option>
                        <option value="secondary">中学</option>
                        <option value="primary">小学</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className={`bulk-input ${rowErrors.start_date ? 'error' : ''}`}
                          type="date"
                          value={row.start_date || ''}
                          onChange={(event) => onChangeRow(row.id, { start_date: event.target.value })}
                        />
                        <input
                          className={`bulk-input ${rowErrors.end_date ? 'error' : ''}`}
                          type="date"
                          value={row.end_date || ''}
                          onChange={(event) => onChangeRow(row.id, { end_date: event.target.value })}
                        />
                      </div>
                    </td>
                    <td>
                      <input
                        className={`bulk-input ${rowErrors.participant_count ? 'error' : ''}`}
                        type="number"
                        value={row.participant_count}
                        onChange={(event) => onChangeRow(row.id, { participant_count: event.target.value })}
                      />
                    </td>
                    <td>
                      <button
                        className="btn-delete"
                        style={{ padding: '4px 8px' }}
                        onClick={() => onRemoveRow(row.id)}
                        disabled={rows.length === 1}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="modal-header" style={{ borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-bulk" onClick={onAddRow}>
              新增一行
            </button>
            <span style={{ color: '#666', fontSize: 11 }}>{`共 ${rows.length} 行`}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-delete" onClick={onClose}>
              取消
            </button>
            <button className="btn-save" onClick={onSubmit} disabled={submitting}>
              {submitting ? '创建中...' : '开始创建'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkCreateModal;
