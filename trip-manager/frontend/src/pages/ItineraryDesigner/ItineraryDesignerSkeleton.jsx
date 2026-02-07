import React from 'react';

const ItineraryDesignerSkeleton = () => {
  const dayColumns = Array.from({ length: 7 });
  const timeRows = Array.from({ length: 4 });
  const ghostEvents = [
    { dayIndex: 0, height: 90, marginTop: 20 },
    { dayIndex: 2, height: 150, marginTop: 70 },
    { dayIndex: 5, height: 110, marginTop: 40 }
  ];

  return (
    <div className="itinerary-designer itinerary-skeleton">
      <div className="itinerary-skeleton-header">
        <div className="skeleton sk-title" style={{ width: 220 }}></div>
        <div className="skeleton sk-pill"></div>
      </div>

      <div className="itinerary-body">
        <div className="itinerary-center">
          <div className="timeline-wrapper">
            <div className="itinerary-skeleton-grid">
              <div className="itinerary-skeleton-time">
                {timeRows.map((_, idx) => (
                  <div key={idx} className="skeleton sk-time"></div>
                ))}
              </div>

              {dayColumns.map((_, index) => {
                const ghost = ghostEvents.find(item => item.dayIndex === index);
                return (
                  <div className="itinerary-skeleton-day" key={index}>
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
      </div>
    </div>
  );
};

export default ItineraryDesignerSkeleton;
