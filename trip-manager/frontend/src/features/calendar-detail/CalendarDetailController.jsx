import React, { useState, useEffect, useRef } from 'react';
import Alert from 'antd/es/alert';
import Space from 'antd/es/space';
import message from 'antd/es/message';
import { InfoCircleOutlined } from '@ant-design/icons';
import CalendarDetail from './CalendarDetail';
import api from '../../services/api';
import {
  CALENDAR_DETAIL_ALERT_TEXT,
  CALENDAR_DETAIL_MESSAGES
} from './messages';
import './CalendarDetailController.css';

const getRequestErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || fallback
);

const CalendarDetailController = ({
  groupId,
  groupData,
  schedules,
  onUpdate,
  onLogisticsUpdate,
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
          message.warning(CALENDAR_DETAIL_MESSAGES.saveConflictDetected);
          onRevisionConflict?.();
          return;
        }
        message.error(getRequestErrorMessage(error, CALENDAR_DETAIL_MESSAGES.saveFailedFallback));
      }
    }, 500);
  };

  return (
    <div className="schedule-management">
      {viewMode === 'demo' && (
        <Alert
          message={CALENDAR_DETAIL_ALERT_TEXT.featureMessage}
          description={CALENDAR_DETAIL_ALERT_TEXT.featureDescription}
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
            onLogisticsUpdate={onLogisticsUpdate}
            onPlanChange={onPlanChange}
            onCustomResourcesChange={onCustomResourcesChange}
            loading={loading}
            resourceWidth={resourceWidth}
          />
        ) : (
          <>
            <Alert
              message={CALENDAR_DETAIL_ALERT_TEXT.demoMessage}
              description={CALENDAR_DETAIL_ALERT_TEXT.demoDescription}
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
