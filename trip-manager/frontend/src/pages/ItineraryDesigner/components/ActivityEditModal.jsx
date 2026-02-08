import React from 'react';
import { Button, Card, Form, InputNumber, Modal, Select } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';

const { Option } = Select;

function ActivityEditModal({
  open,
  onClose,
  selectedTimeSlot,
  timeSlots,
  getContainer,
  overlayStyles,
  groups,
  selectedGroups,
  locations,
  onAddActivity,
  onUpdateActivity,
  onDeleteActivity
}) {
  const [form] = Form.useForm();
  const timeSlotLabel = timeSlots.find(t => t.key === selectedTimeSlot?.timeSlot)?.label || '';

  return (
    <Modal
      title={`编辑行程 - ${selectedTimeSlot?.date || ''} ${timeSlotLabel}`}
      open={open}
      onCancel={onClose}
      width={800}
      wrapClassName="itinerary-modal-wrap"
      footer={null}
      getContainer={getContainer}
      styles={overlayStyles}
    >
      <div style={{ maxHeight: '400px', overflow: 'auto' }}>
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              form.setFieldValue('date', selectedTimeSlot?.date);
              form.setFieldValue('timeSlot', selectedTimeSlot?.timeSlot);
            }}
            style={{ width: '100%', height: '40px' }}
          >
            添加团组活动
          </Button>
        </div>

        <Form
          form={form}
          layout="inline"
          onFinish={(values) => {
            onAddActivity(values.groupId, values.locationId, values.participantCount);
            form.resetFields();
          }}
          style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '6px' }}
        >
          <Form.Item name="groupId" label="选择团组" rules={[{ required: true, message: '请选择团组' }]}>
            <Select placeholder="选择团组" style={{ width: 150 }}>
              {groups.filter(g => selectedGroups.includes(g.id)).map(group => (
                <Option key={group.id} value={group.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: group.color,
                        borderRadius: '50%'
                      }}
                    />
                    {group.name}
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="locationId" label="选择地点">
            <Select placeholder="选择地点" allowClear style={{ width: 150 }}>
              {locations.map(location => (
                <Option key={location.id} value={location.id}>
                  {location.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="participantCount" label="参与人数">
            <InputNumber placeholder="人数" min={1} style={{ width: 80 }} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" size="small">
              添加
            </Button>
          </Form.Item>
        </Form>

        {selectedTimeSlot?.activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            该时段暂无安排
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {selectedTimeSlot?.activities.map(activity => {
              const group = groups.find(g => g.id === activity.groupId);

              return (
                <Card key={activity.id} size="small" style={{ backgroundColor: group?.color + '20' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: group?.color,
                        borderRadius: '2px'
                      }}
                    />
                    <span style={{ fontWeight: 'bold' }}>{group?.name}</span>
                  </div>

                  <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                    📍 地点:
                    <Select
                      size="small"
                      value={activity.locationId}
                      placeholder="选择地点"
                      allowClear
                      style={{ width: '100%', marginLeft: '4px' }}
                      onChange={(value) => onUpdateActivity(activity.id, { locationId: value })}
                    >
                      {locations.map(loc => (
                        <Option key={loc.id} value={loc.id}>
                          {loc.name}
                        </Option>
                      ))}
                    </Select>
                  </div>

                  <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                    👥 人数:
                    <InputNumber
                      size="small"
                      value={activity.participantCount}
                      min={1}
                      style={{ width: '80px', marginLeft: '4px' }}
                      onChange={(value) => onUpdateActivity(activity.id, { participantCount: value })}
                    />
                    人
                  </div>

                  <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                    <Button
                      size="small"
                      icon={<DeleteOutlined />}
                      danger
                      onClick={() => onDeleteActivity(activity.id)}
                    >
                      删除
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default ActivityEditModal;

