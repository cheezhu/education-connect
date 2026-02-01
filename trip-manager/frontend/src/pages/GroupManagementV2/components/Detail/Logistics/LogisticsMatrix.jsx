import React from 'react';
import DayLogisticsCard from './DayLogisticsCard';

const LogisticsMatrix = ({
  rows = [],
  scheduleMap,
  onUpdateDay,
  onCopyPrevDay,
  hotelOptions,
  vehicleOptions,
  guideOptions,
  securityOptions,
  mealOptions,
  groupSize = 0
}) => {
  if (!rows.length) {
    return <div className="empty-state">暂无资源安排</div>;
  }

  return (
    <div className="logistics-list">
      {rows.map((day, index) => (
        <DayLogisticsCard
          key={day.date}
          index={index}
          day={day}
          scheduleItems={scheduleMap?.get(day.date) || []}
          onUpdateDay={onUpdateDay}
          onCopyPrevDay={onCopyPrevDay}
          hotelOptions={hotelOptions}
          vehicleOptions={vehicleOptions}
          guideOptions={guideOptions}
          securityOptions={securityOptions}
          mealOptions={mealOptions}
          groupSize={groupSize}
          isFirstDay={index === 0}
          isLastDay={index === rows.length - 1}
        />
      ))}
    </div>
  );
};

export default LogisticsMatrix;



