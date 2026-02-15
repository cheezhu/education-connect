import React from 'react';
import Alert from 'antd/es/alert';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Collapse from 'antd/es/collapse';
import Divider from 'antd/es/divider';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Steps from 'antd/es/steps';
import Table from 'antd/es/table';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';

const { Paragraph, Text, Title } = Typography;

const moduleColumns = [
  {
    title: '模块',
    dataIndex: 'module',
    key: 'module',
    width: 120
  },
  {
    title: '主要用途',
    dataIndex: 'purpose',
    key: 'purpose'
  },
  {
    title: '关键动作',
    dataIndex: 'actions',
    key: 'actions'
  },
  {
    title: '权限',
    dataIndex: 'permission',
    key: 'permission',
    width: 150
  }
];

const moduleData = [
  {
    key: 'groups',
    module: '团组管理',
    purpose: '单团组全流程维护（团组信息、食行卡片、日历详情、行程详情、人员信息）。',
    actions: '录入字段、维护每日卡片、拖拽调时、保存联动。',
    permission: '管理员 / 编辑者 / 查看者'
  },
  {
    key: 'designer',
    module: '行程设计器',
    purpose: '跨团组排程与时间网格编排。',
    actions: '拖拽活动、导入导出、打开团组日历详情。',
    permission: '仅管理员'
  },
  {
    key: 'resources',
    module: '资源管理',
    purpose: '维护可复用资源主数据。',
    actions: '行程点资源、人员管理、住宿管理、车辆管理。',
    permission: '管理员 / 编辑者'
  },
  {
    key: 'statistics',
    module: '统计报表',
    purpose: '查看录入完成度和业务统计。',
    actions: '筛选团组、查看状态、辅助交付。',
    permission: '管理员 / 编辑者 / 查看者'
  },
  {
    key: 'users',
    module: '用户管理',
    purpose: '管理账号与角色，并查看登录状态。',
    actions: '新增用户、角色调整、禁用/启用账号。',
    permission: '仅管理员'
  },
  {
    key: 'settings',
    module: '系统设置',
    purpose: '全局配置与版本快照管理。',
    actions: '手动快照、版本恢复、查看自动快照状态。',
    permission: '仅管理员'
  },
  {
    key: 'feedback',
    module: '意见反馈',
    purpose: '内部反馈流，支持提问、回复、状态闭环。',
    actions: '发布反馈、评论讨论、管理员状态流转。',
    permission: '所有已登录用户（管理员可回复与改状态）'
  },
  {
    key: 'help',
    module: '帮助中心',
    purpose: '统一文档入口，解释规则、流程和排障。',
    actions: '按流程操作、按问题定位。',
    permission: '所有已登录用户'
  }
];

const roleColumns = [
  {
    title: '角色',
    dataIndex: 'role',
    key: 'role',
    width: 100,
    render: (value) => {
      if (value === '管理员') return <Tag color="red">管理员</Tag>;
      if (value === '编辑者') return <Tag color="blue">编辑者</Tag>;
      return <Tag>查看者</Tag>;
    }
  },
  {
    title: '可访问模块',
    dataIndex: 'read',
    key: 'read'
  },
  {
    title: '可执行写操作',
    dataIndex: 'write',
    key: 'write'
  }
];

const roleData = [
  {
    key: 'admin',
    role: '管理员',
    read: '全部模块',
    write: '全部模块（含行程设计器、系统设置、用户管理、意见反馈状态管理）'
  },
  {
    key: 'editor',
    role: '编辑者',
    read: '团组管理、资源管理、统计报表、意见反馈、帮助中心',
    write: '团组管理、资源管理、意见反馈（不能使用行程设计器与系统设置）'
  },
  {
    key: 'viewer',
    role: '查看者',
    read: '团组管理、资源管理、统计报表、意见反馈、帮助中心',
    write: '意见反馈（可发帖/评论，不可改状态）'
  }
];

const startupItems = [
  {
    title: '确认权限',
    description: '先确认账号角色，避免保存失败或入口不可见。'
  },
  {
    title: '创建/选择团组',
    description: '优先补齐团组日期、人数、联系人等基础信息。'
  },
  {
    title: '录入食行卡片',
    description: '按天录入住宿、车导安保、三餐、接送站和备注。'
  },
  {
    title: '校准日历详情',
    description: '在时间网格里微调开始时间和时长，检查冲突。'
  },
  {
    title: '检查行程详情',
    description: '确认展示内容、导出内容与交付口径一致。'
  }
];

const linkageRules = [
  '日历活动来源分三类：行程点 / 每日卡片 / 自定义。',
  '每日卡片与日历活动是一对一映射：删除任一侧，会同步删除另一侧映射项。',
  '每日卡片映射活动不能跨日期拖拽，只允许在同一天调整时间和时长。',
  '三餐若有可用时间，会直接进入日历；若无时间则保留在资源库“每日卡片”分组。',
  '“不安排”会清空对应字段，并在录入状态中视为完成；备注保持可写。'
];

const collaborationRules = [
  '同一团组写入受编辑锁约束。若提示“编辑锁占用”，请等待或切换其他团组。',
  '多人协作建议按字段分工：A 负责基础资源，B 负责三餐与接送站，减少冲突。',
  '出现冲突提示后先刷新再重提，系统以最新版本号为准。',
  '登录后无需重复输入账号密码；若被要求重登，通常是登录态失效。'
];

const snapshotRules = [
  '系统每 6 小时自动快照一次。',
  '若本次数据与上一次完全一致，会跳过保存，避免冗余快照。',
  '管理员可在系统设置手动创建快照。',
  '恢复版本会覆盖团组、日历、每日卡片等关联数据，请先确认范围。'
];

const faqItems = [
  {
    key: 'save-fail',
    label: '保存失败怎么排查？',
    children: (
      <ul>
        <li>先检查角色是否有写权限（编辑者不能进入行程设计器与系统设置）。</li>
        <li>确认当前团组是否被他人占用编辑锁。</li>
        <li>刷新页面后重试；若仍失败，记录页面与时间点后反馈管理员。</li>
      </ul>
    )
  },
  {
    key: 'resource-missing',
    label: '为什么有些每日卡片项没显示在资源库？',
    children: (
      <ul>
        <li>已进入日历的映射项，不会继续显示在资源库待排区。</li>
        <li>若在日历删除该映射项，会重新回到资源库“每日卡片”分组。</li>
        <li>标记“不安排”的项不会进入资源库待排列表。</li>
      </ul>
    )
  },
  {
    key: 'time-wrong',
    label: '最近登录时间不对怎么办？',
    children: (
      <ul>
        <li>用户管理页面按北京时间（Asia/Shanghai）展示。</li>
        <li>若浏览器缓存旧数据，刷新或重新登录后再看。</li>
      </ul>
    )
  },
  {
    key: 'snapshot',
    label: '自动快照除了 6 小时还有什么规则？',
    children: (
      <ul>
        <li>自动快照启用时按固定周期执行。</li>
        <li>内容未变化会自动跳过，不生成新版本。</li>
        <li>手动快照不受周期限制，可用于发布前留档。</li>
      </ul>
    )
  }
];

const HelpCenter = () => (
  <div className="content-wrapper" style={{ paddingTop: 16, paddingBottom: 16 }}>
    <div className="page-header">
      <Title level={4} style={{ margin: 0 }}>系统帮助中心</Title>
      <Paragraph type="secondary" style={{ margin: '6px 0 0 0' }}>
        这是全站帮助页。建议按“先团组管理，再日历详情，最后跨团组排程”的顺序使用系统。
      </Paragraph>
    </div>

    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="推荐顺序：团组管理录入基础信息 → 食行卡片补全每日资源 → 日历详情校准时间 → 行程设计器做跨团组排程。"
    />

    <Row gutter={[12, 12]}>
      <Col xs={24} lg={12}>
        <Card title="10 分钟上手" size="small">
          <Steps size="small" direction="vertical" items={startupItems} />
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title="核心联动规则" size="small">
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {linkageRules.map((item) => (
              <Paragraph key={item} style={{ marginBottom: 0 }}>
                <Text>• {item}</Text>
              </Paragraph>
            ))}
          </Space>
        </Card>
      </Col>

      <Col xs={24}>
        <Card title="模块说明" size="small">
          <Table
            size="small"
            pagination={false}
            columns={moduleColumns}
            dataSource={moduleData}
            scroll={{ x: 980 }}
          />
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title="权限矩阵" size="small">
          <Table
            size="small"
            pagination={false}
            columns={roleColumns}
            dataSource={roleData}
            scroll={{ x: 640 }}
          />
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title="多人协作建议" size="small">
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {collaborationRules.map((item) => (
              <Paragraph key={item} style={{ marginBottom: 0 }}>
                <Text>• {item}</Text>
              </Paragraph>
            ))}
          </Space>
          <Divider style={{ margin: '12px 0' }} />
          <Paragraph style={{ marginBottom: 0 }}>
            <Text type="secondary">
              建议把“字段分工”写入团队约定：谁维护食行卡片，谁维护日历时段，谁做最终交付检查。
            </Text>
          </Paragraph>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title="版本与快照机制" size="small">
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {snapshotRules.map((item) => (
              <Paragraph key={item} style={{ marginBottom: 0 }}>
                <Text>• {item}</Text>
              </Paragraph>
            ))}
          </Space>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title="上线前检查清单" size="small">
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Paragraph style={{ marginBottom: 0 }}><Text>• 核对团组日期、人数、联系人是否完整。</Text></Paragraph>
            <Paragraph style={{ marginBottom: 0 }}><Text>• 检查食行卡片录入状态，确认“不安排”项是否符合业务。</Text></Paragraph>
            <Paragraph style={{ marginBottom: 0 }}><Text>• 检查日历详情是否有时间冲突、跨日误拖或空白关键时段。</Text></Paragraph>
            <Paragraph style={{ marginBottom: 0 }}><Text>• 发布前手动创建快照，便于回滚。</Text></Paragraph>
          </Space>
        </Card>
      </Col>

      <Col xs={24}>
        <Card title="常见问题" size="small">
          <Collapse items={faqItems} />
        </Card>
      </Col>
    </Row>
  </div>
);

export default HelpCenter;
