import React from 'react';
import { Button, Checkbox, DatePicker, Form, Modal, Select, Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const { Option } = Select;

function PlanningImportModal({
  open,
  onClose,
  getContainer,
  overlayStyles,

  planningImportFileList,
  handlePlanningImportFile,
  handlePlanningImportRemove,

  planningImportPayload,
  planningImportFile,
  planningImportRange,
  planningImportAssignmentsCount,
  planningImportPayloadGroupIds,

  planningImportForm,
  setPlanningImportValidatedKey,
  planningImportOnlySelectedValue,
  planningImportSelectedGroupIds,
  groups,

  handlePlanningImportRollback,
  planningImportRollbackLoading,
  planningImportSnapshotToken,
  handlePlanningImportValidate,
  planningImportValidating,
  handlePlanningImportApply,
  planningImportLoading,
  planningImportValidatedKey,

  planningImportResult,
  planningImportSummary,
  planningImportConflicts,

  planningConflictActiveReason,
  setPlanningConflictActiveReason,
  planningConflictRows,
  planningConflictBuckets,
  planningConflictManualOnly,
  setPlanningConflictManualOnly,
  planningConflictTodayOnly,
  setPlanningConflictTodayOnly,
  planningConflictTodayCount,
  planningConflictSortBy,
  setPlanningConflictSortBy,
  planningConflictTodayDate,
  planningConflictFilteredRows
}) {
  return (
    <Modal
      title="导入排程结果(JSON)"
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
          key="rollback"
          danger
          onClick={handlePlanningImportRollback}
          loading={planningImportRollbackLoading}
          disabled={!planningImportSnapshotToken}
        >
          回滚最近导入
        </Button>,
        <Button
          key="validate"
          onClick={handlePlanningImportValidate}
          loading={planningImportValidating}
          disabled={!planningImportPayload}
        >
          校验
        </Button>,
        <Button
          key="import"
          type="primary"
          onClick={handlePlanningImportApply}
          loading={planningImportLoading}
          disabled={!planningImportPayload || !planningImportValidatedKey}
        >
          导入
        </Button>
      ]}
      destroyOnClose
    >
      <Upload.Dragger
        accept=".json,application/json"
        multiple={false}
        fileList={planningImportFileList}
        beforeUpload={handlePlanningImportFile}
        onRemove={handlePlanningImportRemove}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽上传 planning_result.json</p>
        <p className="ant-upload-hint">仅支持 JSON（标准格式）</p>
      </Upload.Dragger>

      {planningImportPayload ? (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          {planningImportFile ? (
            <div>
              {`文件: ${planningImportFile.name} (${(planningImportFile.size / 1024).toFixed(1)} KB)`}
            </div>
          ) : null}
          <div>{`schema: ${planningImportPayload.schema}`}</div>
          <div>{`mode: ${planningImportPayload.mode || '-'}`}</div>
          <div>
            {`range: ${planningImportRange ? `${planningImportRange.start} ~ ${planningImportRange.end}` : '-'}`}
          </div>
          <div>{`assignments: ${planningImportAssignmentsCount}`}</div>
          <div>{`groups in file: ${planningImportPayloadGroupIds.length}`}</div>
        </div>
      ) : null}

      <Form
        form={planningImportForm}
        layout="vertical"
        onValuesChange={() => {
          setPlanningImportValidatedKey('');
        }}
        initialValues={{
          replaceExisting: false,
          skipConflicts: true,
          onlySelectedGroups: true,
          groupIds: [],
          importDateRange: []
        }}
        style={{ marginTop: 12 }}
      >
        <Form.Item
          name="importDateRange"
          label="导入日期范围（保护机制）"
          rules={[{ required: true, message: '请选择导入日期范围' }]}
        >
          <DatePicker.RangePicker
            getPopupContainer={getContainer}
            disabled={!planningImportPayload}
          />
        </Form.Item>
        <Form.Item name="replaceExisting" valuePropName="checked">
          <Checkbox>覆盖日期范围内已有安排</Checkbox>
        </Form.Item>
        <Form.Item name="skipConflicts" valuePropName="checked">
          <Checkbox>跳过冲突继续导入</Checkbox>
        </Form.Item>
        <Form.Item name="onlySelectedGroups" valuePropName="checked">
          <Checkbox>仅导入已选团组</Checkbox>
        </Form.Item>

        {!planningImportOnlySelectedValue ? (
          <Form.Item
            name="groupIds"
            label="选择团组"
            rules={[{ required: true, message: '请选择团组' }]}
          >
            <Select
              mode="multiple"
              placeholder={planningImportPayloadGroupIds.length ? '选择需要导入的团组' : '请先上传文件'}
              disabled={!planningImportPayload}
              dropdownRender={(menu) => (
                <>
                  <div style={{ padding: '8px', display: 'flex', gap: '8px' }}>
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        planningImportForm.setFieldsValue({
                          groupIds: planningImportPayloadGroupIds
                        });
                      }}
                      disabled={planningImportPayloadGroupIds.length === 0}
                    >
                      全选
                    </Button>
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        planningImportForm.setFieldsValue({ groupIds: [] });
                      }}
                    >
                      全不选
                    </Button>
                  </div>
                  {menu}
                </>
              )}
            >
              {planningImportPayloadGroupIds.map(groupId => {
                const group = groups.find(g => g.id === groupId);
                return (
                  <Option key={groupId} value={groupId}>
                    {group?.name || `#${groupId}`}
                  </Option>
                );
              })}
            </Select>
          </Form.Item>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            导入团组数: {planningImportSelectedGroupIds.length}
          </div>
        )}
      </Form>

      {planningImportResult ? (
        <div style={{ marginTop: 12, background: '#fafafa', padding: 12, borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: 8 }}>
            <span>团组: {planningImportSummary?.groups || 0}</span>
            <span>分配: {planningImportSummary?.assignments || 0}</span>
            <span>导入: {planningImportSummary?.inserted || 0}</span>
            <span>跳过: {planningImportSummary?.skipped || 0}</span>
            <span>冲突: {planningImportSummary?.conflicts || 0}</span>
          </div>
          {planningImportResult?.appliedRange ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              生效范围: {planningImportResult.appliedRange.startDate} ~ {planningImportResult.appliedRange.endDate}
            </div>
          ) : null}
          {planningImportResult?.snapshotToken ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              回滚快照: {planningImportResult.snapshotToken}
            </div>
          ) : null}
          {planningImportConflicts.length ? (
            <div style={{ marginTop: 8, borderTop: '1px solid #ececec', paddingTop: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <Button
                  size="small"
                  type={planningConflictActiveReason === 'ALL' ? 'primary' : 'default'}
                  onClick={() => setPlanningConflictActiveReason('ALL')}
                >
                  全部 {planningConflictRows.length}
                </Button>
                {planningConflictBuckets.map((bucket) => (
                  <Button
                    key={bucket.reasonCode}
                    size="small"
                    type={planningConflictActiveReason === bucket.reasonCode ? 'primary' : 'default'}
                    onClick={() => setPlanningConflictActiveReason(bucket.reasonCode)}
                  >
                    {bucket.reasonLabel} {bucket.count}
                  </Button>
                ))}
                <Checkbox
                  checked={planningConflictManualOnly}
                  onChange={(event) => setPlanningConflictManualOnly(event.target.checked)}
                >
                  仅看必须人工处理
                </Checkbox>
                <Checkbox
                  checked={planningConflictTodayOnly}
                  onChange={(event) => setPlanningConflictTodayOnly(event.target.checked)}
                  disabled={planningConflictTodayCount === 0}
                >
                  仅看今日冲突（{planningConflictTodayCount}）
                </Checkbox>
                <Select
                  size="small"
                  style={{ minWidth: 170 }}
                  value={planningConflictSortBy}
                  onChange={setPlanningConflictSortBy}
                  options={[
                    { label: '按日期升序', value: 'DATE_ASC' },
                    { label: '按日期降序', value: 'DATE_DESC' },
                    { label: '按团组名称', value: 'GROUP_ASC' }
                  ]}
                />
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                今日日期: {planningConflictTodayDate}，当前显示 {Math.min(planningConflictFilteredRows.length, 50)} / {planningConflictRows.length} 条
              </div>

              {planningConflictFilteredRows.length ? (
                <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 12, color: '#d4380d' }}>
                  {planningConflictFilteredRows.slice(0, 50).map((row) => (
                    <div
                      key={row.key}
                      style={{
                        padding: '5px 0',
                        borderBottom: '1px dashed #f0f0f0',
                        display: 'grid',
                        gap: 8,
                        gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, 260px)'
                      }}
                    >
                      <div>
                        {row.groupLabel} | {row.date} | {row.slotLabel} | {row.locationLabel} | {row.reasonLabel}
                        {row.manualRequired ? <span style={{ color: '#cf1322', fontWeight: 600 }}>（需人工）</span> : null}
                      </div>
                      <div style={{ color: '#595959', wordBreak: 'break-word' }}>
                        建议: {row.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  当前筛选条件下无冲突
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#52c41a' }}>未发现冲突</div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

export default PlanningImportModal;
