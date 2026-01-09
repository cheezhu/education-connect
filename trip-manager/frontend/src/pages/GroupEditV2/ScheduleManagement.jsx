import React, { useState, useEffect, useRef } from 'react';
import { Alert, Space, message } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import CalendarDaysView from './CalendarDaysView';
import api from '../../services/api';
import './ScheduleManagement.css';

const ScheduleManagement = ({ groupId, groupData, schedules, onUpdate }) => {
  const [viewMode, setViewMode] = useState('calendar');
  const [localSchedules, setLocalSchedules] = useState(schedules || []);
  const saveTimeoutRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    setLocalSchedules(schedules || []);
  }, [schedules]);

  useEffect(() => {
    return () => {
      clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // 处理日程更新
  const handleScheduleUpdate = (updatedSchedules) => {
    setLocalSchedules(updatedSchedules);
    onUpdateRef.current?.(updatedSchedules);

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await api.post(`/groups/${groupId}/schedules/batch`, {
          scheduleList: updatedSchedules
        });
        const saved = Array.isArray(response.data) ? response.data : updatedSchedules;
        setLocalSchedules(saved);
        onUpdateRef.current?.(saved);
      } catch (error) {
        message.error('保存日程失败');
      }
    }, 500);
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

      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff'
        }}
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
      </div>
    </div>
  );
};

export default ScheduleManagement;
