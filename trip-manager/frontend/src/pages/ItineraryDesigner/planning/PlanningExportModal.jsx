import React from 'react';
import { Button, DatePicker, Form, Modal, Select, Tooltip } from 'antd';

const { Option } = Select;

function PlanningExportModal({
  open,
  onClose,
  getContainer,
  overlayStyles,

  planningForm,
  planningAvailableGroups,
  planningDateRange,
  handlePlanningExport,
  planningExportLoading,

  locations,
  mustVisitFixRef,
  planningMissingMustVisitGroupIds,
  planningMissingMustVisitGroups,
  planningMustVisitFixGroups,
  planningMustVisitDraftByGroupId,
  updatePlanningMustVisitDraft,
  fillPlanningMustVisitFromPlan,
  fillAllMissingMustVisitFromPlan
}) {
  return (
    <Modal
      title="导出排程输入包(JSON)"
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
            未勾选必去行程点：{planningMissingMustVisitGroups.map(group => group.name).join('、')}（请在下方补齐后再导出）
          </div>
        ) : null}
      </Form>

      {planningMustVisitFixGroups.length > 0 ? (
        <div
          ref={mustVisitFixRef}
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid #f0f0f0',
            borderRadius: 10,
            background: '#fff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>
              补齐必去行程点（导出时会自动保存）
            </div>
            <Tooltip title={planningMissingMustVisitGroups.length ? '对仍为空的团组一键填充' : '当前没有需要填充的团组'}>
              <span>
                <Button
                  size="small"
                  onClick={fillAllMissingMustVisitFromPlan}
                  disabled={planningMissingMustVisitGroups.length === 0}
                >
                  对全部缺失：从方案填充
                </Button>
              </span>
            </Tooltip>
          </div>
          <div style={{ fontSize: 12, color: '#595959', marginBottom: 10 }}>
            说明：这里选择的必去点会写入团组信息；行程方案仅用于快捷点选（推荐列表）。
          </div>

          <div style={{ display: 'grid', gap: 10, maxHeight: 320, overflow: 'auto', paddingRight: 4 }}>
            {planningMustVisitFixGroups.map((group) => {
              const groupId = Number(group?.id);
              const hasDraft = Object.prototype.hasOwnProperty.call(planningMustVisitDraftByGroupId || {}, groupId);
              const value = hasDraft
                ? (planningMustVisitDraftByGroupId[groupId] || [])
                : (Array.isArray(group?.manual_must_visit_location_ids) ? group.manual_must_visit_location_ids : []);
              const hasPlan = Boolean(group?.itinerary_plan_id);
              return (
                <div
                  key={group.id}
                  style={{
                    border: '1px solid #f0f0f0',
                    borderRadius: 10,
                    padding: 10,
                    background: '#fafafa'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {group?.name || `#${groupId}`}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Tooltip title={hasPlan ? '从行程方案中一键勾选地点' : '该团组未绑定行程方案'}>
                        <span>
                          <Button
                            size="small"
                            onClick={() => fillPlanningMustVisitFromPlan(groupId)}
                            disabled={!hasPlan}
                          >
                            从方案填充
                          </Button>
                        </span>
                      </Tooltip>
                      <Button
                        size="small"
                        onClick={() => updatePlanningMustVisitDraft(groupId, [])}
                      >
                        清空
                      </Button>
                    </div>
                  </div>
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    maxTagCount="responsive"
                    placeholder="请选择必去行程点（至少 1 个）"
                    style={{ width: '100%' }}
                    value={value}
                    onChange={(next) => updatePlanningMustVisitDraft(groupId, next)}
                    options={(Array.isArray(locations) ? locations : []).map((location) => ({
                      value: location.id,
                      label: location.name
                    }))}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export default PlanningExportModal;
