import React from 'react';

const GroupCommandCenterSkeleton = () => {
  return (
    <div className="group-command-center-skeleton">
      <div className="gcc-skeleton-layout">
        <div className="gcc-skeleton-sidebar">
          <div className="skeleton sk-title"></div>
          <div className="skeleton sk-search"></div>
          <div className="gcc-skeleton-list">
            <div className="skeleton sk-item"></div>
            <div className="skeleton sk-item"></div>
            <div className="skeleton sk-item" style={{ opacity: 0.6 }}></div>
            <div className="skeleton sk-item" style={{ opacity: 0.3 }}></div>
          </div>
        </div>

        <div className="gcc-skeleton-main">
          <div className="gcc-skeleton-header">
            <div className="skeleton sk-title" style={{ width: 200 }}></div>
          </div>

          <div className="gcc-skeleton-body">
            <div className="gcc-skeleton-form">
              <div className="skeleton sk-block"></div>
              <div className="skeleton sk-block"></div>
              <div className="skeleton sk-block"></div>
              <div className="skeleton sk-block" style={{ width: '70%' }}></div>
            </div>

            <div className="gcc-skeleton-timeline">
              <div className="skeleton sk-col-header"></div>
              <div className="sk-event-ghost" style={{ height: 90, marginTop: 18, width: '80%' }}></div>
              <div className="sk-event-ghost" style={{ height: 120, marginTop: 32, width: '90%' }}></div>
              <div className="sk-event-ghost" style={{ height: 70, marginTop: 28, width: '70%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupCommandCenterSkeleton;
