import React from 'react';

const CalendarDetailSkeleton = ({ showResources = true, resourceWidth = 260 }) => {
  const dayColumns = Array.from({ length: 7 });
  const timeRows = Array.from({ length: 4 });
  const ghostEvents = [
    { dayIndex: 0, height: 90, marginTop: 20 },
    { dayIndex: 2, height: 150, marginTop: 70 },
    { dayIndex: 4, height: 110, marginTop: 50 }
  ];

  return (
    <div className="calendar-days-view calendar-skeleton calendar-workshop">
      <div className="calendar-layout">
        <div className="calendar-container">
          <div className="calendar-scroll-wrapper">
            <div className="calendar-skeleton-grid">
              <div className="calendar-skeleton-time">
                {timeRows.map((_, idx) => (
                  <div key={idx} className="skeleton sk-time"></div>
                ))}
              </div>

              {dayColumns.map((_, index) => {
                const ghost = ghostEvents.find(item => item.dayIndex === index);
                return (
                  <div className="calendar-skeleton-day" key={index}>
                    <div className="skeleton sk-col-header"></div>
                    {ghost && (
                      <div
                        className="sk-event-ghost"
                        style={{ height: ghost.height, marginTop: ghost.marginTop }}
                      ></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {showResources && (
          <div className="resource-cards-container calendar-skeleton-sidebar" style={{ width: resourceWidth }}>
            <div className="skeleton sk-title"></div>
            <div className="skeleton sk-search"></div>
            <div className="calendar-skeleton-list">
              <div className="skeleton sk-item"></div>
              <div className="skeleton sk-item"></div>
              <div className="skeleton sk-item" style={{ opacity: 0.6 }}></div>
              <div className="skeleton sk-item" style={{ opacity: 0.3 }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarDetailSkeleton;
