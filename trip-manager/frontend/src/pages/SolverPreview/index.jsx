import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, DatePicker, Divider, Form, List, Select, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import api from '../../services/api';
import SolverTimelineGrid from './SolverTimelineGrid';
import '../ItineraryDesigner/ItineraryDesigner.css';
import './solverPreview.css';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const TIME_LIMIT_OPTIONS = [
  { label: '10 分钟', value: 600 },
  { label: '20 分钟', value: 1200 },
  { label: '30 分钟', value: 1800 }
];

const buildDateStrings = (start, end) => {
  const s = dayjs(start).startOf('day');
  const e = dayjs(end).startOf('day');
  if (!s.isValid() || !e.isValid() || s.isAfter(e, 'day')) return [];
  const out = [];
  let cursor = s;
  while (cursor.isBefore(e, 'day') || cursor.isSame(e, 'day')) {
    out.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'day');
  }
  return out;
};

const STATUS_COLORS = {
  queued: 'default',
  running: 'processing',
  succeeded: 'success',
  failed: 'error',
  canceled: 'default'
};

function SolverPreview() {
  const [form] = Form.useForm();
  const pollingRef = useRef(null);

  const [groups, setGroups] = useState([]);
  const [locations, setLocations] = useState([]);
  const [runs, setRuns] = useState([]);

  const [selectedRunId, setSelectedRunId] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runCandidates, setRunCandidates] = useState(null);

  const [selectedProfileId, setSelectedProfileId] = useState('baseline');

  const groupsById = useMemo(() => (
    new Map((groups || []).map(g => [Number(g.id), g]))
  ), [groups]);

  const locationsById = useMemo(() => (
    new Map((locations || []).map(l => [Number(l.id), l]))
  ), [locations]);

  const timeSlots = useMemo(() => ([
    { key: 'MORNING', label: '上午', time: '08:00-12:00', color: 'transparent', borderColor: '#0e639c' },
    { key: 'AFTERNOON', label: '下午', time: '14:00-18:00', color: 'transparent', borderColor: '#89d185' },
    { key: 'EVENING', label: '晚上', time: '19:00-22:00', color: 'transparent', borderColor: '#cca700' }
  ]), []);

  const visibleTimeSlots = timeSlots;

  const loadGroupsAndLocations = useCallback(async () => {
    const [groupsResp, locationsResp] = await Promise.all([
      api.get('/groups'),
      api.get('/locations')
    ]);
    setGroups(Array.isArray(groupsResp.data) ? groupsResp.data : []);
    setLocations(Array.isArray(locationsResp.data) ? locationsResp.data : []);
  }, []);

  const loadRuns = useCallback(async () => {
    const resp = await api.get('/planning/solver-runs', { params: { limit: 200 } });
    setRuns(Array.isArray(resp.data?.runs) ? resp.data.runs : []);
  }, []);

  const loadRun = useCallback(async (runId) => {
    const resp = await api.get(`/planning/solver-runs/${runId}`);
    setSelectedRun(resp.data || null);
    return resp.data || null;
  }, []);

  const loadCandidates = useCallback(async (runId) => {
    const resp = await api.get(`/planning/solver-runs/${runId}/candidates`);
    setRunCandidates(resp.data || null);
    return resp.data || null;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback((runId) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const data = await loadRun(runId);
        if (!data) return;
        if (data.status === 'succeeded' || data.status === 'failed' || data.status === 'canceled') {
          stopPolling();
          await loadCandidates(runId);
        }
      } catch (error) {
        // keep polling; transient errors should not lock the UI
      }
    }, 2000);
  }, [loadCandidates, loadRun, stopPolling]);

  useEffect(() => {
    loadGroupsAndLocations().catch(() => {});
    loadRuns().catch(() => {});
    return () => stopPolling();
  }, [loadGroupsAndLocations, loadRuns, stopPolling]);

  const handleCreateRun = async (values) => {
    const groupIds = values.groupIds || [];
    const range = values.dateRange || [];
    const startDate = range?.[0] ? dayjs(range[0]).format('YYYY-MM-DD') : null;
    const endDate = range?.[1] ? dayjs(range[1]).format('YYYY-MM-DD') : null;
    const timeLimitSec = values.timeLimitSec || 600;

    const resp = await api.post('/planning/solver-runs', {
      groupIds,
      startDate,
      endDate,
      timeLimitSec
    });

    const runId = resp.data?.runId;
    if (!runId) return;

    setSelectedRunId(runId);
    setSelectedProfileId('baseline');
    setRunCandidates(null);

    await loadRuns();
    await loadRun(runId);
    startPolling(runId);
  };

  const handleSelectRun = async (runId) => {
    setSelectedRunId(runId);
    setSelectedProfileId('baseline');
    setRunCandidates(null);

    const data = await loadRun(runId);
    if (!data) return;
    if (data.status === 'queued' || data.status === 'running') {
      startPolling(runId);
      return;
    }
    stopPolling();
    await loadCandidates(runId);
  };

  const candidatesPayload = runCandidates?.candidates?.candidates || [];
  const baselineCandidate = candidatesPayload.find(c => c?.profile?.id === 'baseline') || null;
  const selectedCandidate = candidatesPayload.find(c => c?.profile?.id === selectedProfileId) || baselineCandidate;

  const baselineAssignments = baselineCandidate?.result?.assignments || [];
  const selectedAssignments = selectedCandidate?.result?.assignments || [];

  const inputScope = runCandidates?.input?.scope || null;
  const dateStrings = useMemo(() => {
    const request = selectedRun?.request || null;
    const start = request?.startDate || inputScope?.startDate;
    const end = request?.endDate || inputScope?.endDate;
    if (!start || !end) return [];
    return buildDateStrings(start, end);
  }, [inputScope, selectedRun?.request]);

  const profileOptions = useMemo(() => (
    candidatesPayload.map(row => ({
      label: row?.profile?.label || row?.profile?.id || 'unknown',
      value: row?.profile?.id || 'unknown'
    }))
  ), [candidatesPayload]);

  const currentStatus = selectedRun?.status || null;
  const highlightDiff = selectedProfileId !== 'baseline';

  return (
    <div className="solver-preview-page">
      <Card size="small" className="solver-preview-toolbar">
        <Form
          form={form}
          layout="inline"
          onFinish={handleCreateRun}
          initialValues={{
            groupIds: [],
            dateRange: [dayjs().startOf('day'), dayjs().startOf('day').add(6, 'day')],
            timeLimitSec: 600
          }}
        >
          <Form.Item name="groupIds" label="团组" rules={[{ required: true, message: '请选择团组' }]}>
            <Select
              mode="multiple"
              style={{ minWidth: 360 }}
              placeholder="选择团组"
              optionFilterProp="label"
              options={(groups || []).map(g => ({
                value: Number(g.id),
                label: `${g.name || '未命名'} (#${g.id})`
              }))}
            />
          </Form.Item>

          <Form.Item name="dateRange" label="日期范围" rules={[{ required: true, message: '请选择日期范围' }]}>
            <RangePicker allowClear={false} />
          </Form.Item>

          <Form.Item name="timeLimitSec" label="时限">
            <Select style={{ width: 140 }} options={TIME_LIMIT_OPTIONS} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              生成方案
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <div className="solver-preview-body">
        <Card size="small" className="solver-preview-runs" title="最近 Runs">
          <List
            size="small"
            dataSource={runs || []}
            renderItem={(item) => (
              <List.Item
                className={`solver-preview-run-item${item.id === selectedRunId ? ' active' : ''}`}
                onClick={() => handleSelectRun(item.id)}
              >
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color={STATUS_COLORS[item.status] || 'default'}>{item.status}</Tag>
                    <Text code style={{ fontSize: 11 }}>{item.id.slice(0, 8)}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{item.createdAt}</Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {item?.request?.startDate} ~ {item?.request?.endDate} | groups={Array.isArray(item?.request?.groupIds) ? item.request.groupIds.length : 0} | time={item?.request?.timeLimitSec || 600}s
                  </Text>
                  {item.error ? (
                    <Text type="danger" style={{ fontSize: 11 }} ellipsis title={item.error}>{item.error}</Text>
                  ) : null}
                </Space>
              </List.Item>
            )}
          />
        </Card>

        <div className="solver-preview-viewer">
          <Card size="small" className="solver-preview-status" title="预览">
            {selectedRun ? (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Space wrap>
                  <Tag color={STATUS_COLORS[currentStatus] || 'default'}>{currentStatus}</Tag>
                  <Text code>{selectedRun.id}</Text>
                  {selectedRun.startedAt ? <Text type="secondary">started: {selectedRun.startedAt}</Text> : null}
                  {selectedRun.finishedAt ? <Text type="secondary">finished: {selectedRun.finishedAt}</Text> : null}
                </Space>

                {selectedRun.error ? (
                  <Text type="danger">{selectedRun.error}</Text>
                ) : null}

                <Divider style={{ margin: '8px 0' }} />

                <Space wrap>
                  <span>方案</span>
                  <Select
                    style={{ minWidth: 260 }}
                    value={selectedProfileId}
                    options={profileOptions}
                    onChange={(value) => setSelectedProfileId(value)}
                    disabled={profileOptions.length === 0}
                  />
                  {highlightDiff ? (
                    <Tag color="orange">Diff vs baseline</Tag>
                  ) : (
                    <Tag color="default">Baseline</Tag>
                  )}
                </Space>

                {selectedCandidate?.metrics ? (
                  <Space wrap>
                    <Tag>missing={selectedCandidate.metrics.missing}</Tag>
                    <Tag>repeats={selectedCandidate.metrics.repeats}</Tag>
                    <Tag>overT1={selectedCandidate.metrics.overT1}</Tag>
                    <Tag>overT2={selectedCandidate.metrics.overT2}</Tag>
                    <Tag>mustMissing={selectedCandidate.metrics.mustVisitMissing}</Tag>
                    <Tag>hard={selectedCandidate.metrics.hardViolations}</Tag>
                  </Space>
                ) : null}
              </Space>
            ) : (
              <Text type="secondary">请选择一个 run 或点击“生成方案”。</Text>
            )}
          </Card>

          <Card size="small" className="solver-preview-grid" bodyStyle={{ padding: 0 }}>
            {dateStrings.length > 0 && selectedCandidate ? (
              <SolverTimelineGrid
                dateStrings={dateStrings}
                visibleTimeSlots={visibleTimeSlots}
                assignments={selectedAssignments}
                baselineAssignments={baselineAssignments}
                groupsById={groupsById}
                locationsById={locationsById}
                highlightDiff={highlightDiff}
              />
            ) : (
              <div className="solver-preview-grid-empty">
                <Text type="secondary">暂无可预览数据</Text>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default SolverPreview;
