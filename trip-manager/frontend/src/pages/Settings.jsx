import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Row,
  Space,
  Switch,
  message,
  Result
} from 'antd';
import dayjs from 'dayjs';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import './Settings.css';

const TIME_SLOT_OPTIONS = [
  { label: '上午', value: 'MORNING' },
  { label: '下午', value: 'AFTERNOON' },
  { label: '晚上', value: 'EVENING' }
];

function Settings() {
  const { canAccess } = useAuth();
  const [loading, setLoading] = useState(false);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [itineraryForm] = Form.useForm();

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await api.get('/config/all');
      const data = response.data || {};
      const itinerary = data.itinerary || {};

      itineraryForm.setFieldsValue({
        weekStart: itinerary.weekStart ? dayjs(itinerary.weekStart) : dayjs(),
        timeSlots: itinerary.timeSlots || TIME_SLOT_OPTIONS.map(item => item.value),
        dailyFocus: itinerary.dailyFocus ?? true,
        groupRowAlign: itinerary.groupRowAlign ?? true
      });
    } catch (error) {
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSaveItinerary = async () => {
    try {
      const values = await itineraryForm.validateFields();
      setSavingItinerary(true);
      await api.put('/config/all', {
        itinerary: {
          weekStart: values.weekStart.format('YYYY-MM-DD'),
          timeSlots: values.timeSlots,
          dailyFocus: values.dailyFocus,
          groupRowAlign: values.groupRowAlign
        }
      });
      message.success('行程设置已保存');
      loadConfig();
    } catch (error) {
      if (error?.errorFields) return;
      message.error('保存行程设置失败');
    } finally {
      setSavingItinerary(false);
    }
  };

  if (!canAccess('settings')) {
    return (
      <Result
        status="403"
        title="无权限"
        subTitle="仅管理员可访问系统设置"
      />
    );
  }

  return (
    <div className="content-wrapper settings-page">
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          marginBottom: 12
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>系统设置</div>
          <div style={{ fontSize: 12, color: '#666' }}>全局配置，立即生效</div>
        </div>
        <Button size="small" onClick={loadConfig} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card
            title="行程设计器设置"
            size="small"
            extra={(
              <Button size="small" type="primary" onClick={handleSaveItinerary} loading={savingItinerary}>
                保存
              </Button>
            )}
          >
            <Form
              form={itineraryForm}
              layout="vertical"
              size="small"
            >
              <Form.Item
                label="周起始日期"
                name="weekStart"
                rules={[{ required: true, message: '请选择日期' }]}
              >
                <DatePicker format="YYYY-MM-DD" size="small" />
              </Form.Item>

              <Form.Item
                label="显示时间段"
                name="timeSlots"
                rules={[{ required: true, message: '至少选择一个时段' }]}
              >
                <Checkbox.Group options={TIME_SLOT_OPTIONS} />
              </Form.Item>

              <Space size={16} wrap>
                <Form.Item label="每日关注" name="dailyFocus" valuePropName="checked">
                  <Switch size="small" />
                </Form.Item>
                <Form.Item label="对齐团组行" name="groupRowAlign" valuePropName="checked">
                  <Switch size="small" />
                </Form.Item>
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Settings;
