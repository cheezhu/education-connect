import React from 'react';
import { Button, Modal, Tooltip } from 'antd';
import { CloseOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import CalendarDetail from '../../../features/calendar-detail/CalendarDetail';

function GroupCalendarDetailModal({
  open,
  onClose,
  topVh = 0,
  heightVh = 80,
  getContainer,
  overlayStyles,
  group,
  schedules,
  onUpdate,
  onPushedToDesigner,
  resourcesVisible,
  setResourcesVisible,
  loading
}) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      mask={false}
      width="100%"
      className="group-calendar-detail-modal"
      wrapClassName="group-calendar-detail-wrap itinerary-modal-wrap"
      style={{ top: `${topVh}vh` }}
      styles={{
        ...overlayStyles,
        body: { padding: 0, height: `${heightVh}vh` }
      }}
      getContainer={getContainer}
    >
      <div className="group-calendar-detail">
        <div className="group-calendar-detail-header">
          <div className="group-calendar-detail-info">
            <span
              className="group-color-dot"
              style={{ backgroundColor: group?.color || '#d9d9d9' }}
            />
            <span className="group-calendar-detail-name">
              {group?.name || '\u672a\u9009\u62e9\u56e2\u7ec4'}
            </span>
            {group && (
              <span className="group-calendar-detail-dates">
                {dayjs(group.start_date).format('YYYY-MM-DD')} ~ {dayjs(group.end_date).format('YYYY-MM-DD')}
              </span>
            )}
          </div>
          <div className="group-calendar-detail-actions">
            <Tooltip title={resourcesVisible ? '收起资源栏' : '展开资源栏'}>
              <Button
                size="small"
                type="text"
                icon={resourcesVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
                onClick={() => setResourcesVisible?.((prev) => !prev)}
              />
            </Tooltip>
            <Button
              size="small"
              type="text"
              icon={<CloseOutlined />}
              onClick={onClose}
            />
          </div>
        </div>
        <div className="group-calendar-detail-body">
          <CalendarDetail
            groupData={group}
            schedules={schedules}
            onUpdate={onUpdate}
            onPushedToDesigner={onPushedToDesigner}
            showResources={resourcesVisible}
            resourceWidth="25%"
            loading={loading}
          />
        </div>
      </div>
    </Modal>
  );
}

export default GroupCalendarDetailModal;

