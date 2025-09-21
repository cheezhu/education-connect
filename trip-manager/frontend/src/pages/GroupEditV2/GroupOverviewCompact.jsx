import React from 'react';
import { Form, Input, Select, DatePicker, InputNumber, Tag, Space, Row, Col, ColorPicker, Divider, Statistic } from 'antd';
import { PlusOutlined, CalendarOutlined, TeamOutlined, PhoneOutlined, TagsOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import './GroupOverviewCompact.css';

const { Option } = Select;
const { TextArea } = Input;

const GroupOverviewCompact = ({ data, onUpdate, onMultipleUpdate, isNew }) => {
  const [form] = Form.useForm();

  // 初始化表单值
  React.useEffect(() => {
    if (data) {
      form.setFieldsValue({
        name: data.name,
        type: data.type,
        status: data.status,
        startDate: data.startDate ? dayjs(data.startDate) : null,
        endDate: data.endDate ? dayjs(data.endDate) : null,
        studentCount: data.studentCount,
        teacherCount: data.teacherCount,
        color: data.color,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        emergencyContact: data.emergencyContact,
        emergencyPhone: data.emergencyPhone,
        notes: data.notes
      });
    }
  }, [data, form]);

  // 处理日期变化
  const handleDateChange = (field, date) => {
    if (date) {
      const dateStr = date.format('YYYY-MM-DD');
      onUpdate(field, dateStr);

      // 自动计算天数
      const startDate = field === 'startDate' ? dateStr : data.startDate;
      const endDate = field === 'endDate' ? dateStr : data.endDate;

      if (startDate && endDate) {
        const duration = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
        onUpdate('duration', duration);
      }
    }
  };

  // 处理表单字段变化
  const handleFieldChange = (field, value) => {
    onUpdate(field, value);
  };

  // 标签管理
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
    <div className="group-overview-compact">
      <Form
        form={form}
        layout="inline"
        size="small"
        onValuesChange={(changedValues) => {
          const key = Object.keys(changedValues)[0];
          const value = changedValues[key];

          if (key === 'startDate' || key === 'endDate') {
            handleDateChange(key, value);
          } else if (key === 'color') {
            handleFieldChange(key, typeof value === 'string' ? value : value.toHexString());
          } else {
            handleFieldChange(key, value);
          }
        }}
      >
        {/* 第一行：基础信息 */}
        <div className="form-row">
          <Form.Item label="团组名称" name="name" className="form-item-flex">
            <Input placeholder="团组名称" />
          </Form.Item>

          <Form.Item label="类型" name="type" className="form-item-small">
            <Select style={{ width: 80 }}>
              <Option value="primary">小学</Option>
              <Option value="secondary">中学</Option>
            </Select>
          </Form.Item>

          <Form.Item label="状态" name="status" className="form-item-small">
            <Select style={{ width: 90 }} disabled={isNew}>
              <Option value="准备中">准备中</Option>
              <Option value="进行中">进行中</Option>
              <Option value="已完成">已完成</Option>
              <Option value="已取消">已取消</Option>
            </Select>
          </Form.Item>

          <Form.Item label="颜色" name="color" className="form-item-small">
            <ColorPicker size="small" />
          </Form.Item>
        </div>

        {/* 第二行：日期和人数 */}
        <div className="form-row">
          <Form.Item label="行程日期" name="start_date" className="form-item-date">
            <DatePicker placeholder="开始" size="small" />
          </Form.Item>

          <Form.Item label="至" name="end_date" className="form-item-date">
            <DatePicker placeholder="结束" size="small" />
          </Form.Item>

          <Form.Item label="学生" name="student_count" className="form-item-number">
            <InputNumber min={1} max={200} addonAfter="人" />
          </Form.Item>

          <Form.Item label="老师" name="teacher_count" className="form-item-number">
            <InputNumber min={1} max={50} addonAfter="人" />
          </Form.Item>

          {data.duration && (
            <div className="duration-display">
              共<span className="duration-number">{data.duration}</span>天
            </div>
          )}
        </div>

        <Divider style={{ margin: '8px 0' }} />

        {/* 第三行：联系信息 */}
        <div className="form-row">
          <Form.Item label="联系人" name="contact_person" className="form-item-contact">
            <Input placeholder="姓名" />
          </Form.Item>

          <Form.Item label="电话" name="contact_phone" className="form-item-contact">
            <Input placeholder="手机号" />
          </Form.Item>

          <Form.Item label="紧急" name="emergencyContact" className="form-item-contact">
            <Input placeholder="紧急联系人" />
          </Form.Item>

          <Form.Item label="" name="emergencyPhone" className="form-item-contact">
            <Input placeholder="紧急电话" />
          </Form.Item>
        </div>

        <Divider style={{ margin: '8px 0' }} />

        {/* 第四行：标签和备注 */}
        <div className="form-row">
          <div className="tags-section">
            <span className="label">标签:</span>
            <Space size={4}>
              {data.tags.map((tag, index) => (
                <Tag
                  key={index}
                  closable
                  onClose={() => handleRemoveTag(tag)}
                  style={{ marginRight: 3 }}
                >
                  {tag}
                </Tag>
              ))}
              {inputVisible ? (
                <Input
                  type="text"
                  size="small"
                  style={{ width: 78 }}
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
                  <PlusOutlined /> 添加
                </Tag>
              )}
            </Space>
          </div>

          <Form.Item label="备注" name="notes" className="form-item-flex">
            <Input.TextArea
              rows={1}
              placeholder="特殊要求、注意事项"
              autoSize={{ minRows: 1, maxRows: 3 }}
            />
          </Form.Item>
        </div>

        {/* 底部统计栏 */}
        {!isNew && (
          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-label">活动:</span>
              <span className="stat-value">{data.activity_count || 0}个</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">已完成:</span>
              <span className="stat-value">{data.completed_activities || 0}个</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">完成率:</span>
              <span className="stat-value">
                {data.activity_count > 0
                  ? Math.round((data.completed_activities / data.activity_count) * 100)
                  : 0}%
              </span>
            </div>
            <div className="stat-divider">|</div>
            <div className="stat-item">
              <span className="stat-label">创建:</span>
              <span className="stat-value">{data.createdAt || '2025-01-01'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">更新:</span>
              <span className="stat-value">{data.updated_at || '2025-01-15'}</span>
            </div>
          </div>
        )}
      </Form>
    </div>
  );
};

export default GroupOverviewCompact;