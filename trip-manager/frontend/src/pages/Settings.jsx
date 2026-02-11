import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  Typography,
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
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [restoringToken, setRestoringToken] = useState('');
  const [versionItems, setVersionItems] = useState([]);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [snapshotIntervalHours, setSnapshotIntervalHours] = useState(6);
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

  const loadVersions = async () => {
    setVersionsLoading(true);
    try {
      const response = await api.get('/config/group-versions', { params: { limit: 50 } });
      const data = response.data || {};
      setVersionItems(Array.isArray(data.items) ? data.items : []);
      setAutoBackupEnabled(data.autoBackupEnabled !== false);
      setSnapshotIntervalHours(Number(data.snapshotIntervalHours) || 6);
    } catch (error) {
      message.error('加载版本记录失败');
    } finally {
      setVersionsLoading(false);
    }
  };

  const loadAll = async () => {
    await Promise.all([loadConfig(), loadVersions()]);
  };

  useEffect(() => {
    loadAll();
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

  const handleCreateVersion = async () => {
    setCreatingVersion(true);
    try {
      const response = await api.post('/config/group-versions/create', {
        snapshotType: 'manual'
      });
      const result = response.data || {};
      if (result.skipped) {
        message.info('数据未变化，未创建新快照');
      } else {
        message.success('手动快照已创建');
      }
      loadVersions();
    } catch (error) {
      message.error('创建快照失败');
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleRestoreVersion = async (snapshotToken) => {
    if (!snapshotToken) return;
    setRestoringToken(snapshotToken);
    try {
      await api.post('/config/group-versions/restore', { snapshotToken });
      message.success('版本恢复成功');
      loadVersions();
    } catch (error) {
      message.error('版本恢复失败');
    } finally {
      setRestoringToken('');
    }
  };

  const versionColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (value) => (value ? dayjs(value).format('MM-DD HH:mm:ss') : '-')
    },
    {
      title: '类型',
      dataIndex: 'snapshotType',
      width: 80,
      render: (value) => (
        <Tag color={value === 'auto' ? 'blue' : 'geekblue'}>
          {value === 'auto' ? '自动' : '手动'}
        </Tag>
      )
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      render: (summary) => {
        const s = summary || {};
        return `团组 ${s.groups || 0} · 日程 ${s.schedules || 0} · 活动 ${s.activities || 0}`;
      }
    },
    {
      title: '令牌',
      dataIndex: 'snapshotToken',
      width: 170,
      render: (value) => (
        <Typography.Text copyable={{ text: value }} ellipsis style={{ maxWidth: 150 }}>
          {value}
        </Typography.Text>
      )
    },
    {
      title: '恢复时间',
      dataIndex: 'restoredAt',
      width: 140,
      render: (value) => (value ? dayjs(value).format('MM-DD HH:mm') : '-')
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确认恢复该版本？"
          description="会覆盖当前团组、日程和每日卡片数据。"
          okText="恢复"
          cancelText="取消"
          onConfirm={() => handleRestoreVersion(record.snapshotToken)}
        >
          <Button
            type="link"
            size="small"
            loading={restoringToken === record.snapshotToken}
          >
            恢复
          </Button>
        </Popconfirm>
      )
    }
  ];

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
        <Button size="small" onClick={loadAll} loading={loading || versionsLoading}>
          刷新
        </Button>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={24}>
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
        <Col xs={24} lg={24}>
          <Card
            title="版本管理"
            size="small"
            extra={(
              <Button
                size="small"
                type="primary"
                onClick={handleCreateVersion}
                loading={creatingVersion}
              >
                手动快照
              </Button>
            )}
          >
            <div className="settings-version-meta">
              <Tag color={autoBackupEnabled ? 'green' : 'default'}>
                {autoBackupEnabled ? '自动快照已开启' : '自动快照已关闭'}
              </Tag>
              <span>每 {snapshotIntervalHours} 小时执行一次；内容未变化则跳过保存。</span>
            </div>
            <Table
              size="small"
              rowKey="snapshotToken"
              loading={versionsLoading}
              columns={versionColumns}
              dataSource={versionItems}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: 720 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Settings;
