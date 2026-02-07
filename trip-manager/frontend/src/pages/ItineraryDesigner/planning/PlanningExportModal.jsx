import React from 'react';
import { Button, DatePicker, Form, Modal, Select } from 'antd';

const { Option } = Select;

function PlanningExportModal({
  open,
  onClose,
  getContainer,
  overlayStyles,

  planningForm,
  planningAvailableGroups,
  planningDateRange,
  handlePlanningExportCsv,
  planningExportCsvLoading,
  handlePlanningExport,
  planningExportLoading,

  planningMissingMustVisitGroupIds,
  planningMissingMustVisitGroups
}) {
  return (
    <Modal
      title="导出排程输入包(JSON/CSV)"
      open={open}
      onCancel={onClose}
      wrapClassName="itinerary-modal-wrap"
      getContainer={getContainer}
      styles={overlayStyles}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="export-csv"
          onClick={handlePlanningExportCsv}
          loading={planningExportCsvLoading}
        >
          导出人工模板(CSV)
        </Button>,
        <Button
          key="export"
          type="primary"
          onClick={handlePlanningExport}
          loading={planningExportLoading}
        >
          导出
        </Button>
      ]}
      destroyOnClose
    >
      <Form form={planningForm} layout="vertical">
        <Form.Item
          name="dateRange"
          label="日期范围"
          rules={[{ required: true, message: '请选择日期范围' }]}
        >
          <DatePicker.RangePicker getPopupContainer={getContainer} />
        </Form.Item>

        <Form.Item
          name="groupIds"
          label="选择团组"
          rules={[{ required: true, message: '请选择团组' }]}
        >
          <Select
            mode="multiple"
            placeholder={planningAvailableGroups.length ? '选择需要导出的团组' : '请先选择日期范围'}
            disabled={!planningDateRange || planningDateRange.length !== 2}
            dropdownRender={(menu) => (
              <>
                <div style={{ padding: '8px', display: 'flex', gap: '8px' }}>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.preventDefault();
                      planningForm.setFieldsValue({
                        groupIds: planningAvailableGroups.map(group => group.id)
                      });
                    }}
                    disabled={planningAvailableGroups.length === 0}
                  >
                    全选
                  </Button>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.preventDefault();
                      planningForm.setFieldsValue({ groupIds: [] });
                    }}
                  >
                    全不选
                  </Button>
                </div>
                {menu}
              </>
            )}
          >
            {planningAvailableGroups.map(group => (
              <Option key={group.id} value={group.id}>
                <span style={planningMissingMustVisitGroupIds.has(Number(group.id)) ? { color: '#cf1322', fontWeight: 600 } : undefined}>
                  {group.name}
                </span>
              </Option>
            ))}
          </Select>
        </Form.Item>
        {planningMissingMustVisitGroups.length > 0 ? (
          <div style={{ marginTop: -8, marginBottom: 8, color: '#cf1322', fontSize: 12 }}>
            未设置必去行程点：{planningMissingMustVisitGroups.map(group => group.name).join('、')}
          </div>
        ) : null}
      </Form>
    </Modal>
  );
}

export default PlanningExportModal;

