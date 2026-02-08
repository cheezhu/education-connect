import React from 'react';
import { Button, Card, Checkbox, Drawer } from 'antd';
import dayjs from 'dayjs';

function GroupSelectorDrawer({
  open,
  onClose,
  groups,
  selectedGroups,
  onChangeSelectedGroups
}) {
  const handleSelectAll = () => {
    onChangeSelectedGroups(groups.map(g => g.id));
  };

  const handleClear = () => {
    onChangeSelectedGroups([]);
  };

  const handleToggleGroup = (groupId, checked) => {
    if (checked) {
      onChangeSelectedGroups(Array.from(new Set([...selectedGroups, groupId])));
    } else {
      onChangeSelectedGroups(selectedGroups.filter(id => id !== groupId));
    }
  };

  return (
    <Drawer
      title="团组控制台"
      placement="left"
      open={open}
      onClose={onClose}
      width={240}
      mask={false}
      closable
      bodyStyle={{ padding: 0 }}
      getContainer={false}
      style={{ position: 'absolute' }}
    >
      <Card
        title={null}
        size="small"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          border: 'none',
          borderRadius: 0
        }}
        bodyStyle={{
          flex: 1,
          overflow: 'auto',
          padding: '12px'
        }}
        extra={null}
      >
        <div style={{ marginBottom: '16px' }}>
          <Button type="link" size="small" onClick={handleSelectAll}>
            全选
          </Button>
          <Button type="link" size="small" onClick={handleClear}>
            清空
          </Button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {groups.map(group => (
            <div key={group.id} style={{ marginBottom: '12px' }}>
              <Checkbox
                checked={selectedGroups.includes(group.id)}
                onChange={(event) => handleToggleGroup(group.id, event.target.checked)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: group.color,
                      borderRadius: '2px'
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                      {group.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      📅 {dayjs(group.start_date).format('MM-DD')} ~ {dayjs(group.end_date).format('MM-DD')}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      👥 {group.student_count + group.teacher_count}人 🏫 {group.type === 'primary' ? '小学' : '中学'}
                    </div>
                  </div>
                </div>
              </Checkbox>
            </div>
          ))}
        </div>
      </Card>
    </Drawer>
  );
}

export default GroupSelectorDrawer;
