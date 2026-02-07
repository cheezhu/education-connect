import React from 'react';
import { Button, Modal } from 'antd';
import { getPlanningConflictHandlingTip, getPlanningConflictReasonLabel } from './conflictLabels';

function SlotConflictModal({
  conflictInfo,
  onClose,
  getContainer,
  overlayStyles,
  getTimeSlotLabel,
  onOpenEdit,
  canOpenEdit
}) {
  return (
    <Modal
      title={`时段冲突详情 - ${conflictInfo?.date || ''} ${conflictInfo?.timeSlot ? getTimeSlotLabel(conflictInfo.timeSlot) : ''}`}
      open={Boolean(conflictInfo)}
      onCancel={onClose}
      width={760}
      wrapClassName="itinerary-modal-wrap"
      getContainer={getContainer}
      styles={overlayStyles}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button
          key="edit"
          type="primary"
          onClick={onOpenEdit}
          disabled={!canOpenEdit}
        >
          继续编辑该时段
        </Button>
      ]}
    >
      <div
        style={{
          marginBottom: 12,
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid #ffccc7',
          background: '#fff1f0',
          color: '#7a0014'
        }}
      >
        当前时段检测到 {conflictInfo?.conflicts?.length || 0} 项冲突，请先处理冲突再做排程调整。
      </div>
      <div style={{ maxHeight: 420, overflow: 'auto', display: 'grid', gap: 10 }}>
        {(conflictInfo?.conflicts || []).map((conflict, index) => (
          <div
            key={`${conflict.type || 'conflict'}-${conflict.groupId || 'g'}-${conflict.locationId || 'l'}-${index}`}
            style={{
              border: '1px solid #ffd8bf',
              borderRadius: 8,
              padding: '10px 12px',
              background: '#fff7e6'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <strong style={{ color: '#d46b08' }}>
                {getPlanningConflictReasonLabel(conflict.type)}
              </strong>
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                {conflict.groupName || '未指定团组'}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#262626', marginBottom: 6 }}>
              {conflict.message}
            </div>
            <div style={{ fontSize: 12, color: '#595959' }}>
              建议处理: {getPlanningConflictHandlingTip(conflict.type)}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default SlotConflictModal;

