import React, { useState, useEffect } from 'react';
import { Card, Alert, Button, Space, message, Segmented } from 'antd';
import { CalendarOutlined, InfoCircleOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import CalendarDaysView from './CalendarDaysView';
import './ScheduleManagement.css';

const ScheduleManagement = ({ groupId, groupData, schedules, onUpdate }) => {
  const [viewMode, setViewMode] = useState('calendar');
  const [localSchedules, setLocalSchedules] = useState(schedules || []);

  // 示例数据 - 实际应从API加载
  useEffect(() => {
    if (!schedules || schedules.length === 0) {
      // 加载示例数据
      const sampleSchedules = [
        {
          id: 1,
          groupId: groupId,
          date: groupData.start_date,
          startTime: '07:00',
          endTime: '08:00',
          type: 'meal',
          title: '早餐',
          location: '酒店餐厅',
          description: '自助早餐'
        },
        {
          id: 2,
          groupId: groupId,
          date: groupData.start_date,
          startTime: '09:00',
          endTime: '11:30',
          type: 'visit',
          title: '香港科学馆参观',
          location: '尖沙咀',
          description: '常设展览参观，科学体验'
        },
        {
          id: 3,
          groupId: groupId,
          date: groupData.start_date,
          startTime: '12:00',
          endTime: '13:00',
          type: 'meal',
          title: '午餐',
          location: '尖沙咀餐厅',
          description: '粤菜套餐'
        }
      ];
      setLocalSchedules(sampleSchedules);
    }
  }, [groupId, groupData, schedules]);

  // 处理日程更新
  const handleScheduleUpdate = (updatedSchedules) => {
    setLocalSchedules(updatedSchedules);
    onUpdate(updatedSchedules);
  };

  return (
    <div className="schedule-management">
      {viewMode === 'demo' && (
        <Alert
          message="Google Calendar 风格日程管理"
          description="V2版本核心功能已实现！支持拖拽创建活动、调整时间、冲突检测等专业功能。"
          type="success"
          icon={<InfoCircleOutlined />}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card
        title={
          <Space>
            <CalendarOutlined />
            <span>{groupData.name} - 日程安排</span>
          </Space>
        }
        extra={
          <Segmented
            options={[
              { label: '日历视图', value: 'calendar', icon: <AppstoreOutlined /> },
              { label: '演示视图', value: 'demo', icon: <UnorderedListOutlined /> }
            ]}
            value={viewMode}
            onChange={setViewMode}
          />
        }
      >
        {viewMode === 'calendar' ? (
          <CalendarDaysView
            groupData={groupData}
            schedules={localSchedules}
            onUpdate={handleScheduleUpdate}
          />
        ) : (
          <>
            {/* 原有的演示网格 */}
            <Alert
              message="演示模式"
              description="切换到日历视图查看完整的Google Calendar风格界面"
              type="info"
              style={{ marginBottom: 16 }}
            />

            {/* 示例活动列表 */}
            <div className="sample-activities">
              <Space direction="vertical" style={{ width: '100%' }}>
                {localSchedules.map(schedule => (
                  <div
                    key={schedule.id}
                    className="activity-sample"
                    style={{
                      background: schedule.type === 'meal' ? '#e6f7ff' :
                                 schedule.type === 'visit' ? '#f6ffed' : '#fff7e6',
                      padding: 12,
                      borderRadius: 4
                    }}
                  >
                    {schedule.type === 'meal' && '🍽️'}
                    {schedule.type === 'visit' && '🏛️'}
                    {schedule.type === 'transport' && '🚌'}
                    {' '}
                    {schedule.title} - {schedule.startTime}-{schedule.endTime} - {schedule.location}
                  </div>
                ))}
              </Space>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default ScheduleManagement;