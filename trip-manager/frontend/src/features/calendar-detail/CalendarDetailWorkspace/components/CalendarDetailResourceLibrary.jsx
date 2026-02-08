import React from 'react';
import { Button, Tooltip } from 'antd';
import { SyncOutlined, UploadOutlined } from '@ant-design/icons';

const CalendarDetailResourceLibrary = ({
  loading,
  canSyncDesigner,
  designerSourceState,
  pullingFromDesigner,
  pushingToDesigner,
  locationScheduleCount,
  onPullFromDesigner,
  onPushToDesigner,
  onResetSchedules,
  availablePlanResources,
  shixingCardResources,
  availableCustomResources,
  activityTypes,
  onResourceDragStart,
  onResourceDragEnd,
  onDeleteCustomResource
}) => (
  <div className="resource-pane-scroll">
    <div className="resource-header">
      <div className="resource-hint">
        <div className="resource-hint-header">
          <span className="resource-hint-label">资源库操作</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Tooltip
            title={
              !canSyncDesigner
                ? '需要管理员权限'
                : designerSourceState.loading
                  ? '正在检测是否有可拉取的行程点'
                  : designerSourceState.available
                    ? `可拉取 ${designerSourceState.count} 条行程点`
                    : '行程设计器暂无可拉取的行程点'
            }
          >
            <Button
              size="small"
              icon={<SyncOutlined />}
              loading={pullingFromDesigner}
              disabled={
                loading
                || pullingFromDesigner
                || pushingToDesigner
                || !canSyncDesigner
                || designerSourceState.loading
                || !designerSourceState.available
              }
              onClick={onPullFromDesigner}
            >
              拉取行程点
            </Button>
          </Tooltip>

          <Tooltip
            title={
              !canSyncDesigner
                ? '需要管理员权限'
                : locationScheduleCount === 0
                  ? '当前日历暂无可推送的行程点'
                  : '推送会覆盖行程设计器中的行程点'
            }
          >
            <Button
              size="small"
              icon={<UploadOutlined />}
              loading={pushingToDesigner}
              disabled={
                loading
                || pullingFromDesigner
                || pushingToDesigner
                || !canSyncDesigner
                || locationScheduleCount === 0
              }
              onClick={onPushToDesigner}
            >
              推送到设计器
            </Button>
          </Tooltip>

          <Button
            size="small"
            danger
            onClick={onResetSchedules}
            disabled={pullingFromDesigner || pushingToDesigner}
          >
            重置行程
          </Button>
        </div>
      </div>
    </div>

    <div className="resource-columns">
      <div className="resource-section unique-section">
        <div className="section-label">必去行程点</div>
        <div className="resource-cards">
          {availablePlanResources.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#999', padding: '8px 4px' }}>
              暂无可用必去行程点
            </div>
          ) : availablePlanResources.map((resource) => (
            <div
              key={resource.id}
              className={`resource-card ${resource.type} unique`}
              draggable
              onDragStart={(event) => {
                onResourceDragStart?.(resource);
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('resource', JSON.stringify(resource));
              }}
              onDragEnd={() => {
                onResourceDragEnd?.();
              }}
              style={{
                background: activityTypes[resource.type]?.color || '#1890ff',
                cursor: 'grab'
              }}
              title={resource.description}
            >
              <div className="resource-info">
                <div className="resource-name">{resource.title}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="resource-section shixing-section">
        <div className="section-label">食行卡片</div>
        <div className="resource-cards">
          {shixingCardResources.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#999', padding: '8px 4px' }}>
              暂无可用食行卡片
            </div>
          ) : shixingCardResources.map((resource) => (
            <div
              key={resource.id}
              className={`resource-card ${resource.type} repeatable`}
              draggable
              onDragStart={(event) => {
                onResourceDragStart?.(resource);
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('resource', JSON.stringify(resource));
              }}
              onDragEnd={() => {
                onResourceDragEnd?.();
              }}
              style={{
                background: activityTypes[resource.type]?.color || '#1890ff',
                cursor: 'grab'
              }}
              title={resource.description}
            >
              <div className="resource-info">
                <div className="resource-name">{resource.title}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="resource-section custom-section">
        <div className="section-label">其他</div>
        <div className="resource-cards">
          {availableCustomResources.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#999', padding: '8px 4px' }}>
              暂无自定义模板
            </div>
          ) : availableCustomResources.map((resource) => (
            <div
              key={resource.id}
              className={`resource-card ${resource.type} repeatable`}
              draggable
              onDragStart={(event) => {
                onResourceDragStart?.(resource);
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('resource', JSON.stringify(resource));
              }}
              onDragEnd={() => {
                onResourceDragEnd?.();
              }}
              style={{
                background: activityTypes[resource.type]?.color || '#1890ff',
                cursor: 'grab'
              }}
              title={resource.description}
            >
              <button
                type="button"
                className="resource-delete-btn"
                title="删除"
                draggable={false}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDeleteCustomResource?.(resource.id);
                }}
              >
                ×
              </button>
              <div className="resource-info">
                <div className="resource-name">{resource.title}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default CalendarDetailResourceLibrary;
