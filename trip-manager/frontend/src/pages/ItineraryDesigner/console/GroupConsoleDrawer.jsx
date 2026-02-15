import React from 'react';
import Button from 'antd/es/button';
import Drawer from 'antd/es/drawer';
import { CloseOutlined, DragOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

function GroupConsoleDrawer({
  open,
  onClose,
  heightVh,
  resizing,
  onResizeStart,
  getContainer,

  group,
  groupConsoleTypeLabel,
  groupConsoleUnassignedMustVisitCards,
  groupConsoleMustVisitCards,
  groupConsoleMustVisitMode,
  groupConsoleActivePlan,
  groupConsoleAssignedMustVisitCount,

  groupConsoleDates,
  groupConsoleSchedule,
  groupConsoleDropTarget,

  formatDateString,
  onCardDragStart,
  onCardDragEnd,
  onClearSlot,
  onOpenCalendarDetail,
  onCellDragOver,
  onCellDragEnter,
  onCellDragLeave,
  onDrop,
  onRemoveActivity
}) {
  return (
    <Drawer
      title={null}
      placement="bottom"
      open={open}
      onClose={onClose}
      height={`${heightVh}vh`}
      mask={false}
      closable={false}
      bodyStyle={{ padding: 0, height: '100%' }}
      rootClassName={`group-calendar-drawer${resizing ? ' resizing' : ''}`}
      getContainer={getContainer}
    >
      <div
        className="group-calendar-resize-handle"
        onMouseDown={onResizeStart}
        onTouchStart={onResizeStart}
      />
      {group ? (
        <div className="group-console">
          <div className="group-console-header">
            <div className="group-console-title">
              <span className="group-console-label">团组详情</span>
              <span className="group-color-dot" style={{ backgroundColor: group.color }} />
              <span className="group-console-name-link">
                {group.name}
              </span>
              <span className="group-console-type">{groupConsoleTypeLabel}</span>
              <span className="group-console-date">
                {dayjs(group.start_date).format('YYYY-MM-DD')} ~ {dayjs(group.end_date).format('YYYY-MM-DD')}
              </span>
            </div>
            <div className="group-console-actions">
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={onClose}
              />
            </div>
          </div>

          <div className="group-console-body">
            <div className="group-console-layout">
              <div className="group-console-side">
                <div className="console-must-card">
                  <div className="console-must-head">
                    <div className="console-section-title">必去行程点</div>
                    <span className="console-must-count">
                      待安排 {groupConsoleUnassignedMustVisitCards.length} / 总 {groupConsoleMustVisitCards.length}
                    </span>
                  </div>
                  <div className="console-must-mode">
                    {groupConsoleMustVisitMode === 'plan'
                      ? `方案模式${groupConsoleActivePlan?.name ? ` · ${groupConsoleActivePlan.name}` : ''}`
                      : '手动模式'}
                  </div>
                  {groupConsoleAssignedMustVisitCount > 0 && (
                    <div className="console-must-progress">
                      已安排 {groupConsoleAssignedMustVisitCount} 项（安排后会从列表隐藏）
                    </div>
                  )}
                  <div className="console-must-list">
                    {groupConsoleUnassignedMustVisitCards.length ? (
                      groupConsoleUnassignedMustVisitCards.map((card) => (
                        <div
                          key={`must-visit-${card.locationId}`}
                          className={[
                            'console-must-chip',
                            'unassigned',
                            card.duplicateCount > 0 ? 'duplicate' : ''
                          ].join(' ')}
                          draggable
                          onDragStart={(event) => onCardDragStart(event, {
                            source: 'must_visit',
                            locationId: card.locationId,
                            locationName: card.locationName,
                            activityId: card.assignedActivity?.id ?? null
                          })}
                          onDragEnd={onCardDragEnd}
                        >
                          <div className="console-must-chip-title">
                            <span className="console-must-chip-name">{card.locationName}</span>
                            <span className="console-must-chip-drag">
                              <DragOutlined />
                            </span>
                          </div>
                          <div className="console-must-chip-sub">拖入右侧上午/下午时段</div>
                        </div>
                      ))
                    ) : groupConsoleMustVisitCards.length > 0 ? (
                      <div className="console-must-empty">
                        必去行程点已全部安排完成。
                      </div>
                    ) : (
                      <div className="console-must-empty">
                        未配置必去行程点，当前团组无法用于行程设计器导出。
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="group-console-workbench">
                <div className="console-workbench-toolbar">
                  <div className="console-workbench-title">调控台（上午 / 下午）</div>
                  <div className="console-workbench-actions">
                    <Button size="small" onClick={() => onClearSlot('MORNING')}>
                      清空上午
                    </Button>
                    <Button size="small" onClick={() => onClearSlot('AFTERNOON')}>
                      清空下午
                    </Button>
                    <Button size="small" onClick={onOpenCalendarDetail}>
                      打开日历详情
                    </Button>
                  </div>
                </div>

                <div className="console-grid-shell">
                  <div className="console-grid">
                    <div
                      className="console-grid-row console-grid-header-row"
                      style={{ gridTemplateColumns: `74px repeat(${groupConsoleDates.length}, minmax(140px, 1fr))` }}
                    >
                      <div className="console-grid-slot-cell">时段</div>
                      {groupConsoleDates.map((date) => (
                        <div key={`header-${formatDateString(date)}`} className="console-grid-date-cell">
                          <div>{dayjs(date).format('MM/DD')}</div>
                          <div className="console-grid-date-week">{dayjs(date).format('ddd')}</div>
                        </div>
                      ))}
                    </div>

                    {groupConsoleSchedule.map((slot) => (
                      <div
                        key={slot.key}
                        className="console-grid-row"
                        style={{ gridTemplateColumns: `74px repeat(${groupConsoleDates.length}, minmax(140px, 1fr))` }}
                      >
                        <div className="console-grid-slot-cell">{slot.label}</div>
                        {slot.cells.map((cell) => {
                          const isDropTarget = (
                            groupConsoleDropTarget?.date === cell.dateString
                            && groupConsoleDropTarget?.slotKey === slot.key
                          );
                          return (
                            <div
                              key={cell.key}
                              className={[
                                'console-grid-cell',
                                cell.inactive ? 'inactive' : '',
                                isDropTarget ? 'drop-active' : ''
                              ].join(' ')}
                              onDragOver={(event) => onCellDragOver(event, cell.inactive)}
                              onDragEnter={(event) => onCellDragEnter(event, cell.dateString, slot.key, cell.inactive)}
                              onDragLeave={(event) => onCellDragLeave(event, cell.dateString, slot.key)}
                              onDrop={(event) => onDrop(event, cell.date, slot.key, cell.inactive)}
                            >
                              {cell.activities.length ? (
                                <div className="console-grid-activity-list">
                                  {cell.activities.map((activity) => (
                                    <div
                                      key={`activity-${activity.id}`}
                                      className={`console-grid-activity ${activity.isMustVisit ? 'must-visit' : 'regular'}`}
                                      draggable={Number.isFinite(activity.locationId)}
                                      onDragStart={(event) => onCardDragStart(event, {
                                        source: 'activity',
                                        activityId: activity.id,
                                        locationId: activity.locationId,
                                        locationName: activity.locationName
                                      })}
                                      onDragEnd={onCardDragEnd}
                                    >
                                      <div className="console-grid-activity-main">
                                        <span className="console-grid-activity-name">{activity.locationName}</span>
                                        {activity.isMustVisit && (
                                          <span className="console-grid-activity-badge">必去</span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        className="console-grid-activity-remove"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          onRemoveActivity(activity.id);
                                        }}
                                      >
                                        移除
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="console-grid-empty">
                                  {cell.inactive ? '不在团期' : '空档（可拖入）'}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="group-calendar-empty-state">
          <div>{'\u8bf7\u9009\u62e9\u884c\u7a0b\u5361\u7247'}</div>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={onClose}
          />
        </div>
      )}
    </Drawer>
  );
}

export default GroupConsoleDrawer;
