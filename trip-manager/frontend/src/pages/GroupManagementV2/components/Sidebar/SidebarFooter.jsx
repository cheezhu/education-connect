import React from 'react';

const SidebarFooter = ({ onBulkCreate }) => {
  return (
    <div className="sidebar-footer">
      <button className="btn-bulk" onClick={onBulkCreate}>
        Batch Create...
      </button>
    </div>
  );
};

export default SidebarFooter;
