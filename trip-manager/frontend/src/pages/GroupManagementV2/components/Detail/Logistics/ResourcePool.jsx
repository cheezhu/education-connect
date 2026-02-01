import React from 'react';

const ResourcePool = ({ title = '可用资源池', items = [] }) => {
  return (
    <div className="resource-pool">
      <div className="resource-pool-header">{title}</div>
      <div className="resource-pool-body">
        {items.length === 0 && (
          <div className="empty-state">暂无可用资源</div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="pool-item"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('application/json', JSON.stringify(item));
              event.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <span>{item.label || item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResourcePool;

