import React, { useState } from 'react';
import Button from 'antd/es/button';
import Checkbox from 'antd/es/checkbox';
import DatePicker from 'antd/es/date-picker';
import {
  CalendarOutlined,
  ExportOutlined,
  LeftOutlined,
  RightOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  UploadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

function ItineraryDesignerHeader({
  dateRange,
  weekStartDate,
  onWeekStartChange,
  onWeekShift,
  onOpenGroupPanel,
  getPopupContainer,
  showDailyFocus,
  onDailyFocusToggle,
  showUnscheduledGroups,
  onShowUnscheduledToggle,
  enabledTimeSlots,
  onTimeSlotToggle,
  timeSlots,
  onOpenPlanningImport,
  onOpenPlanningExport
}) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <div className="page-header itinerary-header">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button size="small" onClick={onOpenGroupPanel}>
              团组控制台
            </Button>
            <Button
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => setDatePickerOpen(true)}
            />
            <DatePicker
              value={weekStartDate}
              onChange={(value) => {
                if (!value) return;
                onWeekStartChange(value);
                setDatePickerOpen(false);
              }}
              allowClear={false}
              size="small"
              format="YYYY-MM-DD"
              placeholder="请选择日期"
              open={datePickerOpen}
              onOpenChange={(open) => setDatePickerOpen(open)}
              getPopupContainer={getPopupContainer}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              type="text"
              icon={<LeftOutlined />}
              onClick={() => onWeekShift(-7)}
              title="前一周"
            />
            <span style={{ minWidth: '160px', textAlign: 'center', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Button
                type="text"
                size="small"
                icon={<StepBackwardOutlined />}
                onClick={() => onWeekShift(-1)}
                title="上一天"
              />
              <span>
                {dayjs(dateRange[0]).format('YYYY年MM月DD日')} ~ {dayjs(dateRange[6]).format('MM月DD日')}
              </span>
              <Button
                type="text"
                size="small"
                icon={<StepForwardOutlined />}
                onClick={() => onWeekShift(1)}
                title="下一天"
              />
            </span>
            <Button
              type="text"
              icon={<RightOutlined />}
              onClick={() => onWeekShift(7)}
              title="后一周"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
              <Checkbox checked={showDailyFocus} onChange={onDailyFocusToggle}>
                每日关注
              </Checkbox>
              <Checkbox checked={showUnscheduledGroups} onChange={onShowUnscheduledToggle}>
                未安排行程
              </Checkbox>
              <Checkbox.Group
                value={enabledTimeSlots}
                onChange={onTimeSlotToggle}
                options={timeSlots.map(slot => ({ label: slot.label, value: slot.key }))}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button icon={<UploadOutlined />} size="small" onClick={onOpenPlanningImport}>
            导入
          </Button>
          <Button icon={<ExportOutlined />} size="small" onClick={onOpenPlanningExport}>
            导出包
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ItineraryDesignerHeader;
