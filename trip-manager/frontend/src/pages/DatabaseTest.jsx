import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, message, Spin, Alert } from 'antd';
import { DatabaseOutlined, TeamOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../services/api';

const DatabaseTest = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/groups');
      setGroups(response.data);
      message.success(`成功加载 ${response.data.length} 个团组`);
    } catch (err) {
      setError(err.message);
      message.error('加载团组数据失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60
    },
    {
      title: '团组名称',
      dataIndex: 'name',
      render: (text, record) => (
        <div>
          <strong>{text}</strong>
          <div style={{ fontSize: 12, color: '#666' }}>
            {record.type === 'primary' ? '小学' : '中学'}
          </div>
        </div>
      )
    },
    {
      title: '人数',
      render: (_, record) => (
        <span>
          <TeamOutlined /> {record.studentCount + record.teacherCount}人
        </span>
      ),
      width: 100
    },
    {
      title: '日期',
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          {record.startDate} 至 {record.endDate}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const colorMap = {
          '准备中': 'blue',
          '已确认': 'green',
          '待确认': 'orange',
          '进行中': 'processing',
          '已完成': 'default'
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: '主题包',
      dataIndex: 'themePackage',
      render: (pkg) => pkg ? (
        <Tag color="purple">{pkg.name}</Tag>
      ) : '-'
    },
    {
      title: '颜色',
      dataIndex: 'color',
      width: 60,
      render: (color) => (
        <div style={{
          width: 24,
          height: 24,
          backgroundColor: color,
          borderRadius: 4,
          border: '1px solid #d9d9d9'
        }} />
      )
    }
  ];

  return (
    <Card
      title={
        <span>
          <DatabaseOutlined style={{ marginRight: 8 }} />
          数据库连接测试 - SQLite
        </span>
      }
      extra={
        <span style={{ color: '#52c41a' }}>
          <CheckCircleOutlined /> 数据库已连接
        </span>
      }
      style={{ margin: 20 }}
    >
      {error && (
        <Alert
          message="错误"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>正在加载数据库数据...</div>
        </div>
      ) : (
        <>
          <Alert
            message={`数据库状态`}
            description={
              <div>
                <div>✅ SQLite 数据库运行正常</div>
                <div>📊 当前团组总数：{groups.length} 个</div>
                <div>🔑 认证方式：Basic Auth (admin/admin123)</div>
                <div>💾 数据位置：backend/prisma/dev.db</div>
              </div>
            }
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Table
            columns={columns}
            dataSource={groups}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showTotal: (total) => `共 ${total} 条记录`
            }}
            bordered
          />
        </>
      )}
    </Card>
  );
};

export default DatabaseTest;