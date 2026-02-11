import React, { useState, useEffect, useRef } from 'react';
import { Alert, Space, message } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import CalendarDetail from './CalendarDetail';
import api from '../../services/api';
import './CalendarDetailController.css';

const CalendarDetailController = ({
  groupId,
  groupData,
  schedules,
  onUpdate,
  onPlanChange,
  onCustomResourcesChange,
  loading = false,
  resourceWidth,
  scheduleRevision = 0,
  onRevisionChange,
  onRevisionConflict
}) => {
  const [viewMode, setViewMode] = useState('calendar');
  const [localSchedules, setLocalSchedules] = useState(schedules || []);

  const saveTimeoutRef = useRef(null);
  const saveTokenRef = useRef(0);
  const onUpdateRef = useRef(onUpdate);
  const scheduleRevisionRef = useRef(scheduleRevision);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    scheduleRevisionRef.current = scheduleRevision;
  }, [scheduleRevision]);

  useEffect(() => {
    setLocalSchedules(schedules || []);
  }, [schedules]);

  useEffect(() => {
    return () => {
      clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleScheduleUpdate = (updatedSchedules) => {
    setLocalSchedules(updatedSchedules);
    onUpdateRef.current?.(updatedSchedules);

    clearTimeout(saveTimeoutRef.current);
    saveTokenRef.current += 1;
    const saveToken = saveTokenRef.current;
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await api.post(`/groups/${groupId}/schedules/batch`, {
          scheduleList: updatedSchedules,
          revision: scheduleRevisionRef.current ?? 0
        });
        if (saveToken !== saveTokenRef.current) {
          return;
        }
        const saved = Array.isArray(response.data) ? response.data : updatedSchedules;
        const revisionHeader = response.headers?.['x-schedule-revision'];
        const nextRevision = Number(revisionHeader);
        if (Number.isFinite(nextRevision)) {
          scheduleRevisionRef.current = nextRevision;
          onRevisionChange?.(nextRevision);
        }
        setLocalSchedules(saved);
        onUpdateRef.current?.(saved);
      } catch (error) {
        if (error?.response?.status === 409) {
          const revisionHeader = error.response?.headers?.['x-schedule-revision'];
          const nextRevision = Number(revisionHeader);
          if (Number.isFinite(nextRevision)) {
            scheduleRevisionRef.current = nextRevision;
            onRevisionChange?.(nextRevision);
          }
          message.warning('检测到排期冲突，已刷新版本，请重试');
          onRevisionConflict?.();
          return;
        }
        message.error('保存失败，请稍后重试');
      }
    }, 500);
  };

  return (
    <div className="schedule-management">
      {viewMode === 'demo' && (
        <Alert
          message="Google Calendar 风格日程管理"
          description="V2 版本核心功能已实现，支持拖拽创建活动、调整时间、冲突检测等。"
          type="success"
          icon={<InfoCircleOutlined />}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff'
        }}
      >
        {viewMode === 'calendar' ? (
          <CalendarDetail
            groupData={groupData}
            schedules={localSchedules}
            onUpdate={handleScheduleUpdate}
            onPlanChange={onPlanChange}
            onCustomResourcesChange={onCustomResourcesChange}
            loading={loading}
            resourceWidth={resourceWidth}
            showResources={false}
          />
        ) : (
          <>
            <Alert
              message="演示模式"
              description="切换到日历视图查看完整的 Google Calendar 风格界面"
              type="info"
              style={{ marginBottom: 16 }}
            />

            <div className="sample-activities">
              <Space direction="vertical" style={{ width: '100%' }}>
                {localSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="activity-sample"
                    style={{
                      background: schedule.type === 'meal' ? '#e6f7ff'
                        : schedule.type === 'visit' ? '#f6ffed'
                          : '#fff7e6',
                      padding: 12,
                      borderRadius: 4
                    }}
                  >
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

export default CalendarDetailController;
