import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Button, DatePicker, Select, message, Statistic } from 'antd';
import { DownloadOutlined, BarChartOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

function Statistics() {
  const [statistics, setStatistics] = useState({});
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [exportFormat, setExportFormat] = useState('json');

  // 加载统计数据
  const loadStatistics = async () => {
    setLoading(true);
    try {
      const response = await api.get('/statistics');
      setStatistics(response.data || {});
    } catch (error) {
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载活动数据用于预览
  const loadActivities = async (startDate, endDate) => {
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get('/statistics/export', { params });
      const tableData = (response.data || []).map((row, index) => ({
        id: row.id ?? `${row.activity_date}-${row.time_slot}-${index}`,
        date: row.activity_date,
        timeSlot: row.time_slot,
        groupName: row.group_name,
        locationName: row.location_name,
        participantCount: row.participant_count,
        capacity: row.location_capacity
      }));
      setActivities(tableData);
    } catch (error) {
      message.error('加载活动数据失败');
    }
  };

  useEffect(() => {
    loadStatistics();
    loadActivities();
  }, []);

  // 导出数据
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const params = { format: exportFormat };
      if (dateRange) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const response = await api.get('/statistics/export', {
        params,
        responseType: exportFormat === 'csv' ? 'blob' : 'json'
      });

      if (exportFormat === 'csv') {
        // 下载 CSV 文件
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activities_${dayjs().format('YYYY-MM-DD')}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        message.success('CSV 文件已下载');
      } else {
        // 下载 JSON 文件
        const blob = new Blob([JSON.stringify(response.data, null, 2)], {
          type: 'application/json'
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activities_${dayjs().format('YYYY-MM-DD')}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        message.success('JSON 文件已下载');
      }
    } catch (error) {
      message.error('导出失败');
    } finally {
      setExportLoading(false);
    }
  };

  // 更新日期范围
  const handleDateChange = (dates) => {
    setDateRange(dates);
    if (dates) {
      loadActivities(dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'));
    } else {
      loadActivities();
    }
  };

  // 时段标签映射
  const getTimeSlotLabel = (slot) => {
    const labels = {
      AM: '上午',
      PM1: '下午1',
      PM2: '下午2',
      MORNING: '上午',
      AFTERNOON: '下午',
      EVENING: '晚上'
    };
    return labels[slot] || slot;
  };

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      sorter: (a, b) => a.date.localeCompare(b.date)
    },
    {
      title: '时段',
      dataIndex: 'timeSlot',
      key: 'timeSlot',
      render: (slot) => getTimeSlotLabel(slot)
    },
    {
      title: '团组',
      dataIndex: 'groupName',
      key: 'groupName'
    },
    {
      title: '地点',
      dataIndex: 'locationName',
      key: 'locationName'
    },
    {
      title: '参与人数',
      dataIndex: 'participantCount',
      key: 'participantCount',
      render: (count) => `${count}人`
    },
    {
      title: '地点容量',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (capacity) => `${capacity}人`
    },
    {
      title: '容量利用率',
      key: 'utilization',
      render: (_, record) => {
        const capacity = Number(record.capacity) || 0;
        if (capacity <= 0) {
          return 'N/A';
        }
        const participants = Number(record.participantCount) || 0;
        const rate = ((participants / capacity) * 100).toFixed(1);
        return `${rate}%`;
      }
    }
  ];

  return (
    <div>
      {/* 统计概览 */}
      <Card title="统计概览" style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Statistic
              title="团组总数"
              value={statistics.summary?.groups || 0}
              prefix={<BarChartOutlined />}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="参访地点"
              value={statistics.summary?.locations || 0}
              prefix={<BarChartOutlined />}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="活动总数"
              value={statistics.summary?.activities || 0}
              prefix={<BarChartOutlined />}
            />
          </Col>
        </Row>
      </Card>

      {/* 地点使用统计 */}
      {statistics.locationUsage && (
        <Card title="地点使用统计" style={{ marginBottom: '24px' }}>
          <Table
            dataSource={statistics.locationUsage}
            pagination={false}
            size="small"
            columns={[
              {
                title: '地点名称',
                dataIndex: 'location_name',
                key: 'location_name'
              },
              {
                title: '活动次数',
                dataIndex: 'activity_count',
                key: 'activity_count',
                sorter: (a, b) => a.activity_count - b.activity_count
              },
              {
                title: '总参与人数',
                dataIndex: 'total_participants',
                key: 'total_participants',
                render: (count) => `${count}人`,
                sorter: (a, b) => a.total_participants - b.total_participants
              }
            ]}
          />
        </Card>
      )}

      {/* 活动安排导出 */}
      <Card
        title="活动安排导出"
        extra={
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <RangePicker
              value={dateRange}
              onChange={handleDateChange}
              placeholder={['开始日期', '结束日期']}
            />
            <Select
              value={exportFormat}
              onChange={setExportFormat}
              style={{ width: '100px' }}
            >
              <Option value="json">JSON</Option>
              <Option value="csv">CSV</Option>
            </Select>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={exportLoading}
            >
              导出
            </Button>
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={activities}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第${range[0]}-${range[1]}条，共${total}条`
          }}
        />
      </Card>
    </div>
  );
}

export default Statistics;
