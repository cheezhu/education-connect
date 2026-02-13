import React from 'react';

const statusClassName = (value) => (value === '已填' ? 'status-ok' : 'status-warn');

const DaySummaryPanel = ({
  dayDate,
  morningItems = [],
  afternoonItems = [],
  groupSize = 0,
  isMealsOnly = false,
  hotelStatus = '未填',
  vehicleStatus = '未填',
  guideStatus = '未填',
  securityStatus = '未填',
  mealStatus = '未填'
}) => {
  return (
    <div className="day-summary">
      <div className="summary-card">
        <div className="summary-title">当日行程摘要</div>
        <div className="summary-slot">
          <div className="summary-slot-label">上午</div>
          <div className="summary-slot-list">
            {morningItems.map((item, idx) => (
              <div className="summary-slot-main" key={`${dayDate}-morning-${idx}`}>
                {item}
              </div>
            ))}
          </div>
          {groupSize > 0 && <div className="summary-slot-sub">{groupSize}人</div>}
        </div>
        <div className="summary-slot">
          <div className="summary-slot-label">下午</div>
          <div className="summary-slot-list">
            {afternoonItems.map((item, idx) => (
              <div className="summary-slot-main" key={`${dayDate}-afternoon-${idx}`}>
                {item}
              </div>
            ))}
          </div>
          {groupSize > 0 && <div className="summary-slot-sub">{groupSize}人</div>}
        </div>
      </div>

      <div className="summary-card">
        <div className="summary-title">录入状态</div>
        {!isMealsOnly && (
          <>
            <div className="summary-status-item">
              <span>住宿酒店</span>
              <span className={`summary-status ${statusClassName(hotelStatus)}`}>{hotelStatus}</span>
            </div>
            <div className="summary-status-item">
              <span>车辆调度</span>
              <span className={`summary-status ${statusClassName(vehicleStatus)}`}>{vehicleStatus}</span>
            </div>
            <div className="summary-status-item">
              <span>随团导游</span>
              <span className={`summary-status ${statusClassName(guideStatus)}`}>{guideStatus}</span>
            </div>
            <div className="summary-status-item">
              <span>安保人员</span>
              <span className={`summary-status ${statusClassName(securityStatus)}`}>{securityStatus}</span>
            </div>
          </>
        )}
        <div className="summary-status-item">
          <span>餐饮</span>
          <span className={`summary-status ${statusClassName(mealStatus)}`}>{mealStatus}</span>
        </div>
      </div>

      <div className="summary-save">
        <span className="status-dot" />
        自动保存
      </div>
    </div>
  );
};

export default DaySummaryPanel;
