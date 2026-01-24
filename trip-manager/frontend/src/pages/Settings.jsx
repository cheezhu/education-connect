import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  message
} from 'antd';
import dayjs from 'dayjs';
import api from '../services/api';
import './Settings.css';

const TIME_SLOT_OPTIONS = [
  { label: '上午', value: 'MORNING' },
  { label: '下午', value: 'AFTERNOON' },
  { label: '晚上', value: 'EVENING' }
];

const DEFAULT_SLOT_WINDOWS = {
  MORNING: { start: 9, end: 12 },
  AFTERNOON: { start: 14, end: 17 },
  EVENING: { start: 19, end: 21 }
};

const SOURCE_LABELS = {
  system: '系统配置',
  env: '环境变量',
  default: '默认'
};

function Settings() {
  const [loading, setLoading] = useState(false);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [aiMeta, setAiMeta] = useState({
    providerSource: 'default',
    modelSource: 'default',
    timeoutSource: 'default',
    apiKeySource: 'default',
    apiKeyMasked: null,
    apiKeyPresent: false
  });

  const [itineraryForm] = Form.useForm();
  const [aiForm] = Form.useForm();
  const [rulesForm] = Form.useForm();

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await api.get('/config/all');
      const data = response.data || {};
      const itinerary = data.itinerary || {};
      const ai = data.ai || {};
      const aiRules = data.aiRules || {};

      itineraryForm.setFieldsValue({
        weekStart: itinerary.weekStart ? dayjs(itinerary.weekStart) : dayjs(),
        timeSlots: itinerary.timeSlots || TIME_SLOT_OPTIONS.map(item => item.value),
        dailyFocus: itinerary.dailyFocus ?? true,
        groupRowAlign: itinerary.groupRowAlign ?? true
      });

      aiForm.setFieldsValue({
        provider: ai.provider || 'openai',
        model: ai.model || '',
        timeoutMs: ai.timeoutMs || 25000
      });

      setAiMeta({
        providerSource: ai.providerSource || 'default',
        modelSource: ai.modelSource || 'default',
        timeoutSource: ai.timeoutSource || 'default',
        apiKeySource: ai.apiKeySource || 'default',
        apiKeyMasked: ai.apiKeyMasked || null,
        apiKeyPresent: Boolean(ai.apiKeyPresent)
      });

      rulesForm.setFieldsValue({
        timeSlots: aiRules.timeSlots || ['MORNING', 'AFTERNOON'],
        requireAllPlanItems: aiRules.requireAllPlanItems ?? false,
        maxItemsPerGroup: aiRules.maxItemsPerGroup ?? 8,
        slotWindows: aiRules.slotWindows || DEFAULT_SLOT_WINDOWS
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

  const handleSaveAi = async () => {
    try {
      const values = await aiForm.validateFields();
      setSavingAi(true);
      const payload = {
        provider: values.provider,
        model: values.model,
        timeoutMs: values.timeoutMs
      };
      const trimmedKey = apiKeyInput.trim();
      if (trimmedKey) {
        payload.apiKey = trimmedKey;
      }
      await api.put('/config/all', {
        ai: payload
      });
      setApiKeyInput('');
      message.success('AI 配置已保存');
      loadConfig();
    } catch (error) {
      if (error?.errorFields) return;
      message.error('保存 AI 配置失败');
    } finally {
      setSavingAi(false);
    }
  };

  const handleClearApiKey = async () => {
    try {
      setSavingAi(true);
      await api.put('/config/all', { ai: { apiKey: '' } });
      setApiKeyInput('');
      message.success('API Key 已清空');
      loadConfig();
    } catch (error) {
      message.error('清空 API Key 失败');
    } finally {
      setSavingAi(false);
    }
  };

  const handleSaveRules = async () => {
    try {
      const values = await rulesForm.validateFields();
      setSavingRules(true);
      await api.put('/ai/rules', {
        timeSlots: values.timeSlots,
        slotWindows: values.slotWindows,
        requireAllPlanItems: values.requireAllPlanItems,
        maxItemsPerGroup: values.maxItemsPerGroup
      });
      message.success('AI 规则已保存');
      loadConfig();
    } catch (error) {
      if (error?.errorFields) return;
      message.error('保存 AI 规则失败');
    } finally {
      setSavingRules(false);
    }
  };

  const renderSourceTag = (source) => (
    <Tag color={source === 'system' ? 'blue' : source === 'env' ? 'gold' : 'default'}>
      {SOURCE_LABELS[source] || '默认'}
    </Tag>
  );

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

        <Col xs={24} lg={12}>
          <Card
            title="AI 基础配置"
            size="small"
            extra={(
              <Button size="small" type="primary" onClick={handleSaveAi} loading={savingAi}>
                保存
              </Button>
            )}
          >
            <Alert
              type="info"
              showIcon
              message="系统配置优先生效。清空 API Key 会禁用外部 AI（即使环境变量存在）。"
              style={{ marginBottom: 12 }}
            />
            <Form
              form={aiForm}
              layout="vertical"
              size="small"
            >
              <Form.Item
                label={
                  <Space size={6}>
                    Provider
                    {renderSourceTag(aiMeta.providerSource)}
                  </Space>
                }
                name="provider"
                rules={[{ required: true, message: '请选择 Provider' }]}
              >
                <Select
                  size="small"
                  options={[
                    { label: 'OpenAI', value: 'openai' },
                    { label: 'Gemini', value: 'gemini' }
                  ]}
                />
              </Form.Item>

              <Form.Item
                label={
                  <Space size={6}>
                    Model
                    {renderSourceTag(aiMeta.modelSource)}
                  </Space>
                }
                name="model"
                rules={[{ required: true, message: '请输入模型名称' }]}
              >
                <Input size="small" placeholder="例如：gpt-4.1 / gemini-1.5-pro-latest" />
              </Form.Item>

              <Form.Item
                label={
                  <Space size={6}>
                    超时(ms)
                    {renderSourceTag(aiMeta.timeoutSource)}
                  </Space>
                }
                name="timeoutMs"
                rules={[{ required: true, message: '请输入超时' }]}
              >
                <InputNumber min={1000} max={120000} size="small" style={{ width: 200 }} />
              </Form.Item>

              <Form.Item
                label={
                  <Space size={6}>
                    API Key
                    {renderSourceTag(aiMeta.apiKeySource)}
                  </Space>
                }
                help={aiMeta.apiKeyMasked ? `当前：${aiMeta.apiKeyMasked}` : '当前未设置'}
              >
                <Space align="start" direction="vertical" style={{ width: '100%' }} size={8}>
                  <Input.Password
                    size="small"
                    value={apiKeyInput}
                    onChange={(event) => setApiKeyInput(event.target.value)}
                    placeholder={aiMeta.apiKeyMasked ? '输入以更新 API Key' : '输入 API Key'}
                  />
                  <Button
                    size="small"
                    onClick={handleClearApiKey}
                    disabled={!aiMeta.apiKeyPresent && aiMeta.apiKeySource !== 'system'}
                  >
                    清空 API Key
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            title="AI 规则"
            size="small"
            extra={(
              <Button size="small" type="primary" onClick={handleSaveRules} loading={savingRules}>
                保存
              </Button>
            )}
          >
            <Form
              form={rulesForm}
              layout="vertical"
              size="small"
            >
              <Form.Item
                label="参与排期的时段"
                name="timeSlots"
                rules={[{ required: true, message: '至少选择一个时段' }]}
              >
                <Checkbox.Group options={TIME_SLOT_OPTIONS} />
              </Form.Item>

              <Form.Item label="时段时间窗">
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {Object.keys(DEFAULT_SLOT_WINDOWS).map((slotKey) => (
                    <Space key={slotKey} size={8} wrap>
                      <Tag>{slotKey}</Tag>
                      <Form.Item
                        name={['slotWindows', slotKey, 'start']}
                        noStyle
                        rules={[{ required: true, message: '开始时间' }]}
                      >
                        <InputNumber min={0} max={23} size="small" />
                      </Form.Item>
                      <span>~</span>
                      <Form.Item
                        name={['slotWindows', slotKey, 'end']}
                        noStyle
                        rules={[{ required: true, message: '结束时间' }]}
                      >
                        <InputNumber min={0} max={23} size="small" />
                      </Form.Item>
                    </Space>
                  ))}
                </Space>
              </Form.Item>

              <Space size={16} wrap>
                <Form.Item label="要求完整排完方案" name="requireAllPlanItems" valuePropName="checked">
                  <Switch size="small" />
                </Form.Item>
                <Form.Item label="每团组最多安排点" name="maxItemsPerGroup">
                  <InputNumber min={1} max={50} size="small" />
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
