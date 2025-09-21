import React from 'react';
import { Form, Input, Select, DatePicker, InputNumber, Tag, Space, Row, Col, Card, ColorPicker, Divider } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const GroupOverview = ({ data, onUpdate, onMultipleUpdate, isNew }) => {
  const [form] = Form.useForm();

  // 初始化表单值
  React.useEffect(() => {
    if (data) {
      form.setFieldsValue({
        name: data.name,
        type: data.type,
        status: data.status,
        dateRange: data.startDate && data.endDate ? [
          dayjs(data.startDate),
          dayjs(data.endDate)
        ] : null,
        studentCount: data.studentCount,
        teacherCount: data.teacherCount,
        color: data.color,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        emergency_contact: data.emergency_contact,
        emergency_phone: data.emergency_phone,
        tags: data.tags,
        notes: data.notes
      });
    }
  }, [data, form]);

  // 处理日期范围变化
  const handleDateRangeChange = (dates) => {
    if (dates && dates[0] && dates[1]) {
      const startDate = dates[0].format('YYYY-MM-DD');
      const endDate = dates[1].format('YYYY-MM-DD');
      const duration = dates[1].diff(dates[0], 'day') + 1;

      onMultipleUpdate({
        startDate: startDate,
        endDate: endDate,
        duration: duration
      });
    }
  };

  // 处理表单字段变化
  const handleFieldChange = (field, value) => {
    onUpdate(field, value);
  };

  // 添加新标签
  const [inputVisible, setInputVisible] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  const handleAddTag = () => {
    if (inputValue && !data.tags.includes(inputValue)) {
      onUpdate('tags', [...data.tags, inputValue]);
      setInputValue('');
      setInputVisible(false);
    }
  };

  const handleRemoveTag = (removedTag) => {
    onUpdate('tags', data.tags.filter(tag => tag !== removedTag));
  };

  return (
    <div className="group-overview">
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(changedValues) => {
          const key = Object.keys(changedValues)[0];
          const value = changedValues[key];

          if (key === 'dateRange') {
            handleDateRangeChange(value);
          } else if (key === 'color') {
            handleFieldChange(key, typeof value === 'string' ? value : value.toHexString());
          } else {
            handleFieldChange(key, value);
          }
        }}
      >
        {/* 基础信息 */}
        <Card title="基础信息" className="info-card">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="团组名称"
                name="name"
                rules={[{ required: true, message: '请输入团组名称' }]}
              >
                <Input placeholder="例如：深圳实验学校小学部" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="团组类型"
                name="type"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="primary">小学</Option>
                  <Option value="secondary">中学</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="团组状态"
                name="status"
                rules={[{ required: true }]}
              >
                <Select disabled={isNew}>
                  <Option value="准备中">准备中</Option>
                  <Option value="进行中">进行中</Option>
                  <Option value="已完成">已完成</Option>
                  <Option value="已取消">已取消</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="行程日期"
                name="dateRange"
                rules={[{ required: true, message: '请选择行程日期' }]}
              >
                <RangePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="学生人数" name="student_count">
                <InputNumber
                  min={1}
                  max={200}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="老师人数" name="teacher_count">
                <InputNumber
                  min={1}
                  max={50}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="显示颜色" name="color">
                <ColorPicker
                  showText
                  size="large"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* 行程信息显示 */}
          {data.startDate && data.endDate && (
            <div className="duration-info">
              <Tag color="blue">行程天数：{data.duration}天</Tag>
              <Tag color="green">总人数：{data.studentCount + data.teacherCount}人</Tag>
            </div>
          )}
        </Card>

        {/* 联系信息 */}
        <Card title="联系信息" className="info-card">
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="主要联系人" name="contact_person">
                <Input placeholder="姓名" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="联系电话" name="contact_phone">
                <Input placeholder="手机号码" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="紧急联系人" name="emergency_contact">
                <Input placeholder="姓名" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="紧急电话" name="emergency_phone">
                <Input placeholder="手机号码" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 标签和备注 */}
        <Card title="其他信息" className="info-card">
          <Form.Item label="标签管理">
            <div className="tags-container">
              <Space wrap>
                {data.tags.map((tag, index) => (
                  <Tag
                    key={index}
                    closable
                    onClose={() => handleRemoveTag(tag)}
                    color="blue"
                  >
                    {tag}
                  </Tag>
                ))}
                {inputVisible ? (
                  <Input
                    type="text"
                    size="small"
                    style={{ width: 100 }}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onBlur={handleAddTag}
                    onPressEnter={handleAddTag}
                    autoFocus
                  />
                ) : (
                  <Tag
                    onClick={() => setInputVisible(true)}
                    style={{ borderStyle: 'dashed', cursor: 'pointer' }}
                  >
                    <PlusOutlined /> 新增标签
                  </Tag>
                )}
              </Space>
            </div>
          </Form.Item>

          <Form.Item label="备注说明" name="notes">
            <TextArea
              rows={4}
              placeholder="请输入特殊要求、注意事项等"
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Card>

        {/* 统计信息（仅编辑模式显示） */}
        {!isNew && (
          <Card title="统计信息" className="info-card">
            <Row gutter={16}>
              <Col span={6}>
                <div className="stat-item">
                  <div className="stat-label">创建时间</div>
                  <div className="stat-value">{data.createdAt || '2025-01-01'}</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="stat-item">
                  <div className="stat-label">最后更新</div>
                  <div className="stat-value">{data.updated_at || '2025-01-15'}</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="stat-item">
                  <div className="stat-label">活动总数</div>
                  <div className="stat-value">{data.activity_count || 0}个</div>
                </div>
              </Col>
              <Col span={6}>
                <div className="stat-item">
                  <div className="stat-label">已完成活动</div>
                  <div className="stat-value">{data.completed_activities || 0}个</div>
                </div>
              </Col>
            </Row>
          </Card>
        )}
      </Form>
    </div>
  );
};

export default GroupOverview;