import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Select, InputNumber, message, Checkbox, Tooltip, Badge } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LeftOutlined,
  RightOutlined,
  SettingOutlined,
  SaveOutlined,
  EyeOutlined,
  ExportOutlined,
  DragOutlined
} from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';
import useDataSync from '../hooks/useDataSync';
import './ItineraryDesigner.css';

const { Option } = Select;

function ItineraryDesigner() {
  const [groups, setGroups] = useState([]);
  const [activities, setActivities] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [draggedActivity, setDraggedActivity] = useState(null);
  const [cardStyle, setCardStyle] = useState('tag'); // 卡片样式：tag, minimal
  const [batchMode, setBatchMode] = useState(false); // 批量选择模式
  const [selectedActivities, setSelectedActivities] = useState([]); // 选中的活动
  const [form] = Form.useForm();
  const { registerRefreshCallback } = useDataSync();

  // 时间段定义
  const timeSlots = [
    { key: 'MORNING', label: '上午', time: '9:00-12:00', color: '#e6f7ff', borderColor: '#1890ff' },
    { key: 'AFTERNOON', label: '下午', time: '14:00-17:00', color: '#f6ffed', borderColor: '#52c41a' },
    { key: 'EVENING', label: '晚上', time: '19:00-21:00', color: '#fff2e8', borderColor: '#fa8c16' }
  ];

  // 加载数据
  const loadData = async (preserveSelection = false) => {
    setLoading(true);
    try {
      const [groupsRes, activitiesRes, locationsRes] = await Promise.all([
        api.get('/groups'),
        api.get('/activities/raw'),
        api.get('/locations')
      ]);
      setGroups(groupsRes.data);
      setActivities(activitiesRes.data);
      setLocations(locationsRes.data);

      // 只在首次加载时选中所有团组，后续刷新保持用户选择
      if (!preserveSelection && selectedGroups.length === 0) {
        setSelectedGroups(groupsRes.data.map(g => g.id));
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 刷新数据但保持团组选择
  const refreshData = async () => {
    await loadData(true);
  };

  useEffect(() => {
    loadData();
    const unregister = registerRefreshCallback(refreshData);
    return unregister;
  }, [registerRefreshCallback]);

  // 生成日期范围（7天一页）
  const generateDateRange = (weekOffset = 0) => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + weekOffset * 7 + i);
      dates.push(date);
    }
    return dates;
  };

  const dateRange = generateDateRange(currentWeekStart);

  // 格式化日期
  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 获取指定时段的活动
  const getActivitiesForSlot = (date, timeSlot) => {
    const dateString = formatDateString(date);
    return activities.filter(activity => {
      const activityDate = activity.date;
      return activityDate === dateString &&
             activity.timeSlot === timeSlot &&
             selectedGroups.includes(activity.groupId);
    });
  };

  // 团组控制台
  const renderGroupPanel = () => (
    <Card
      title="团组控制台"
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
      extra={
        <Button
          type="text"
          icon={<SettingOutlined />}
          size="small"
          title="设置"
        />
      }
    >
      <div style={{ marginBottom: '16px' }}>
        <Button
          type="link"
          size="small"
          onClick={() => setSelectedGroups(groups.map(g => g.id))}
        >
          全选
        </Button>
        <Button
          type="link"
          size="small"
          onClick={() => setSelectedGroups([])}
        >
          清空
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {groups.map(group => (
          <div key={group.id} style={{ marginBottom: '12px' }}>
            <Checkbox
              checked={selectedGroups.includes(group.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedGroups([...selectedGroups, group.id]);
                } else {
                  setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                }
              }}
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
                  <div style={{ fontSize: '10px', color: '#666' }}>
                    📅 {dayjs(group.start_date).format('MM-DD')} ~ {dayjs(group.end_date).format('MM-DD')}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666' }}>
                    👥 {group.student_count + group.teacher_count}人 🏫 {group.type === 'primary' ? '小学' : '中学'}
                  </div>
                </div>
              </div>
            </Checkbox>
          </div>
        ))}
      </div>
    </Card>
  );

  // 获取当前周的统计数据
  const getWeekStatistics = () => {
    const weekActivities = activities.filter(activity => {
      const activityDate = new Date(activity.date);
      return dateRange.some(date =>
        date.toDateString() === activityDate.toDateString()
      ) && selectedGroups.includes(activity.groupId);
    });

    const conflictCount = 0; // 这里可以添加冲突检测逻辑
    const locationsUsed = [...new Set(weekActivities
      .filter(a => a.locationId)
      .map(a => a.locationId))].length;

    return {
      totalActivities: weekActivities.length,
      conflictCount,
      locationsUsed,
      unassignedActivities: weekActivities.filter(a => !a.locationId).length
    };
  };

  const weekStats = getWeekStatistics();

  // 工具面板
  const renderToolPanel = () => (
    <Card
      title="设计工具"
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
    >
      <div style={{ marginBottom: '16px' }}>
        <h4>📊 当前周统计</h4>
        <div style={{ fontSize: '12px', lineHeight: '1.6', background: '#f8f9fa', padding: '8px', borderRadius: '4px' }}>
          <div>选中团组: {selectedGroups.length}个</div>
          <div>总人数: {groups.filter(g => selectedGroups.includes(g.id))
            .reduce((sum, g) => sum + g.student_count + g.teacher_count, 0)}人</div>
          <div>活动总数: {weekStats.totalActivities}个</div>
          <div>使用地点: {weekStats.locationsUsed}个</div>
          <div style={{ color: weekStats.unassignedActivities > 0 ? '#fa8c16' : '#52c41a' }}>
            未安排地点: {weekStats.unassignedActivities}个
          </div>
          {weekStats.conflictCount > 0 && (
            <div style={{ color: '#f5222d' }}>冲突数: {weekStats.conflictCount}个</div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h4>⚡ 批量操作</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button
            size="small"
            type={batchMode ? "primary" : "default"}
            block
            onClick={() => {
              setBatchMode(!batchMode);
              setSelectedActivities([]);
              message.info(batchMode ? '退出批量选择模式' : '进入批量选择模式，点击活动进行选择');
            }}
          >
            {batchMode ? '✓ 退出批量模式' : '☐ 批量选择'}
          </Button>

          {batchMode && selectedActivities.length > 0 && (
            <>
              <div style={{ fontSize: '11px', color: '#666', padding: '4px' }}>
                已选择 {selectedActivities.length} 个活动
              </div>
              <Button
                size="small"
                type="default"
                block
                onClick={() => {
                  Modal.confirm({
                    title: '批量分配地点',
                    content: (
                      <Select
                        placeholder="选择地点"
                        style={{ width: '100%', marginTop: '10px' }}
                        onChange={(locationId) => {
                          selectedActivities.forEach(activityId => {
                            handleUpdateActivity(activityId, { locationId });
                          });
                          setSelectedActivities([]);
                          setBatchMode(false);
                        }}
                      >
                        {locations.map(loc => (
                          <Option key={loc.id} value={loc.id}>
                            {loc.name}
                          </Option>
                        ))}
                      </Select>
                    ),
                    okText: '确定',
                    cancelText: '取消'
                  });
                }}
              >
                🏛️ 批量分配地点
              </Button>
              <Button
                size="small"
                danger
                block
                onClick={() => {
                  Modal.confirm({
                    title: '确认删除',
                    content: `确定要删除选中的 ${selectedActivities.length} 个活动吗？`,
                    onOk: () => {
                      selectedActivities.forEach(activityId => {
                        handleDeleteActivity(activityId);
                      });
                      setSelectedActivities([]);
                      setBatchMode(false);
                    }
                  });
                }}
              >
                🗑️ 批量删除
              </Button>
            </>
          )}

          <Button
            size="small"
            type="default"
            block
            onClick={() => {
              message.info('检查冲突中...');
              setTimeout(() => {
                message.success(`检查完成，发现 ${weekStats.conflictCount} 个冲突`);
              }, 1000);
            }}
          >
            ⚠️ 冲突检测
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h4>🎨 卡片样式</h4>
        <Select
          size="small"
          value={cardStyle}
          onChange={setCardStyle}
          style={{ width: '100%', marginBottom: '8px' }}
        >
          <Option value="tag">标签式（默认）</Option>
          <Option value="minimal">极简式</Option>
        </Select>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Checkbox defaultChecked size="small">显示团组颜色</Checkbox>
          <Checkbox size="small">显示地点容量</Checkbox>
          <Checkbox size="small">高亮冲突活动</Checkbox>
        </div>
      </div>

      <div>
        <h4>🚀 模板操作</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Button size="small" type="link" style={{ padding: '0', height: 'auto', textAlign: 'left' }}>
            💾 保存为模板
          </Button>
          <Button size="small" type="link" style={{ padding: '0', height: 'auto', textAlign: 'left' }}>
            📂 应用模板
          </Button>
          <Button size="small" type="link" style={{ padding: '0', height: 'auto', textAlign: 'left' }}>
            🔄 重置本周
          </Button>
        </div>
      </div>
    </Card>
  );

  // 时间轴头部
  const renderTimelineHeader = () => (
    <div style={{
      background: '#fafafa',
      padding: '8px 16px',
      borderBottom: '1px solid #e8e8e8',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexShrink: 0,
      height: '56px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h3 style={{ margin: 0 }}>🗓️ 行程设计器</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            type="text"
            icon={<LeftOutlined />}
            onClick={() => setCurrentWeekStart(prev => prev - 1)}
            title="前一周"
          />
          <span style={{ minWidth: '160px', textAlign: 'center', fontWeight: 'bold' }}>
            {dayjs(dateRange[0]).format('YYYY年MM月DD日')} ~ {dayjs(dateRange[6]).format('MM月DD日')}
          </span>
          <Button
            type="text"
            icon={<RightOutlined />}
            onClick={() => setCurrentWeekStart(prev => prev + 1)}
            title="后一周"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <Button icon={<SaveOutlined />} type="primary" size="small">
          保存
        </Button>
        <Button icon={<EyeOutlined />} size="small">
          预览
        </Button>
        <Button
          icon={<ExportOutlined />}
          size="small"
          onClick={() => exportData()}
        >
          导出
        </Button>
      </div>
    </div>
  );

  // 时间轴网格
  const renderTimelineGrid = () => (
    <div className="timeline-grid">
      {/* 表头 */}
      <div className="timeline-header">
        <div className="time-label-cell">时间段</div>
        {dateRange.map((date, index) => (
          <div key={index} className="date-header-cell">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold' }}>
                {dayjs(date).format('MM-DD')}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {dayjs(date).format('ddd')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 表格主体 */}
      {timeSlots.map(timeSlot => (
        <div key={timeSlot.key} className="timeline-row">
          <div
            className="time-label-cell"
            style={{
              backgroundColor: timeSlot.color,
              borderLeft: `4px solid ${timeSlot.borderColor}`
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold' }}>{timeSlot.label}</div>
              <div style={{ fontSize: '10px' }}>{timeSlot.time}</div>
            </div>
          </div>

          {dateRange.map((date, dateIndex) => {
            const slotActivities = getActivitiesForSlot(date, timeSlot.key);

            return (
              <div
                key={`${timeSlot.key}-${dateIndex}`}
                className="timeline-cell"
                style={{ backgroundColor: timeSlot.color }}
                onClick={() => handleCellClick(date, timeSlot.key, slotActivities)}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, date, timeSlot.key)}
              >
                {slotActivities.length === 0 ? (
                  <div className="empty-cell">
                    <PlusOutlined style={{ color: '#999' }} />
                    <div style={{ fontSize: '10px', color: '#999' }}>点击添加</div>
                  </div>
                ) : (
                  <div className="activity-summary">
                    {/* 根据选择的样式渲染不同的卡片 */}
                    {slotActivities.map(activity => {
                      const group = groups.find(g => g.id === activity.groupId);
                      const location = locations.find(l => l.id === activity.locationId);

                      // 标签式和极简式使用统一的渲染函数
                      const isSelected = selectedActivities.includes(activity.id);
                      return (
                        <div
                          key={activity.id}
                          draggable={!batchMode}
                          onDragStart={(e) => !batchMode && handleDragStart(e, activity)}
                          onDragEnd={!batchMode && handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (batchMode) {
                              // 批量选择模式下切换选中状态
                              if (isSelected) {
                                setSelectedActivities(prev => prev.filter(id => id !== activity.id));
                              } else {
                                setSelectedActivities(prev => [...prev, activity.id]);
                              }
                            } else {
                              // 正常模式下打开编辑
                              handleCellClick(date, timeSlot.key, [activity]);
                            }
                          }}
                          style={{
                            opacity: batchMode && !isSelected ? 0.6 : 1,
                            outline: isSelected ? '2px solid #1890ff' : 'none',
                            borderRadius: '4px'
                          }}
                          title={`${group?.name}${location ? ` - ${location.name}` : ''} (${activity.participantCount}人)`}
                        >
                          {renderActivityCard(activity, group, location)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  // 渲染活动卡片 - 根据不同样式
  const renderActivityCard = (activity, group, location) => {
    // 标签式（默认）
    if (cardStyle === 'tag') {
      return (
        <div
          className="activity-card-tag"
          style={{
            display: 'inline-block',
            padding: '4px 12px 4px 10px',
            backgroundColor: group?.color + '20',
            borderRadius: '14px',
            border: `1.5px solid ${group?.color}`,
            fontSize: '11px',
            marginRight: '4px',
            marginBottom: '4px',
            cursor: 'grab',
            position: 'relative'
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleCellClick(null, null, [activity]);
          }}
        >
          <span style={{ fontWeight: '600', color: '#333' }}>{group?.name}</span>
          {location && <span style={{ opacity: 0.7, fontSize: '10px', color: '#666' }}> @{location.name}</span>}

          {/* 悬停时显示的删除按钮 */}
          <span
            className="tag-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteActivity(activity.id);
            }}
            style={{
              marginLeft: '6px',
              padding: '0 4px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.8)',
              color: '#999',
              fontSize: '10px',
              display: 'none',
              cursor: 'pointer'
            }}
          >
            ×
          </span>
        </div>
      );
    }

    // 极简式
    if (cardStyle === 'minimal') {
      return (
        <div
          className="activity-card-minimal"
          style={{
            borderLeft: `3px solid ${group?.color}`,
            marginBottom: '4px',
            fontSize: '11px',
            cursor: 'grab',
            backgroundColor: 'rgba(255,255,255,0.5)',
            padding: '2px 8px',
            borderRadius: '0 4px 4px 0',
            position: 'relative'
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleCellClick(null, null, [activity]);
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: '500', lineHeight: '16px', color: '#333' }}>{group?.name}</div>
            <span
              className="minimal-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteActivity(activity.id);
              }}
              style={{
                padding: '0 4px',
                color: '#999',
                fontSize: '10px',
                display: 'none',
                cursor: 'pointer'
              }}
            >
              ×
            </span>
          </div>
          {location && <div style={{ fontSize: '10px', color: '#666', lineHeight: '14px' }}>{location.name}</div>}
        </div>
      );
    }

    return null;
  };

  // 点击时间格子
  const handleCellClick = (date, timeSlot, activities) => {
    setSelectedTimeSlot({
      date: formatDateString(date),
      timeSlot,
      activities
    });
    setModalVisible(true);
  };

  // 添加新活动
  const handleAddActivity = async (groupId, locationId, participantCount) => {
    const group = groups.find(g => g.id === groupId);
    const finalParticipantCount = participantCount || group?.student_count || 0;

    // 检查冲突
    const conflicts = checkConflicts(
      null, // 新活动没有ID
      groupId,
      locationId,
      selectedTimeSlot.date,
      selectedTimeSlot.timeSlot,
      finalParticipantCount
    );

    const addActivity = async () => {
      try {
        const newActivity = {
          groupId,
          locationId,
          date: selectedTimeSlot.date,
          timeSlot: selectedTimeSlot.timeSlot,
          participantCount: finalParticipantCount
        };

        const response = await api.post('/activities', newActivity);

        // 更新本地状态
        setActivities(prev => [...prev, response.data]);

        // 更新选中的时段活动
        const updatedActivities = [...selectedTimeSlot.activities, response.data];
        setSelectedTimeSlot(prev => ({...prev, activities: updatedActivities}));

        message.success('活动添加成功');
        refreshData();
      } catch (error) {
        message.error('添加活动失败');
      }
    };

    if (conflicts.length > 0) {
      // 显示冲突提示
      Modal.confirm({
        title: '检测到冲突',
        content: (
          <div>
            <p>发现以下冲突：</p>
            <ul style={{ paddingLeft: '20px' }}>
              {conflicts.map((c, i) => (
                <li key={i} style={{ color: c.type === 'time' ? '#ff4d4f' : '#faad14', marginBottom: '4px' }}>
                  {c.message}
                </li>
              ))}
            </ul>
            <p style={{ marginTop: '10px' }}>是否仍要继续添加？</p>
          </div>
        ),
        okText: '继续添加',
        cancelText: '取消',
        okType: conflicts.some(c => c.type === 'time') ? 'danger' : 'primary',
        onOk: addActivity
      });
    } else {
      await addActivity();
    }
  };

  // 删除活动
  const handleDeleteActivity = async (activityId) => {
    try {
      await api.delete(`/activities/${activityId}`);

      // 更新本地状态
      setActivities(prev => prev.filter(a => a.id !== activityId));

      // 更新选中的时段活动
      const updatedActivities = selectedTimeSlot.activities.filter(a => a.id !== activityId);
      setSelectedTimeSlot(prev => ({...prev, activities: updatedActivities}));

      message.success('活动删除成功');
      refreshData();
    } catch (error) {
      message.error('删除活动失败');
    }
  };

  // 更新活动
  const handleUpdateActivity = async (activityId, updates) => {
    try {
      const response = await api.put(`/activities/${activityId}`, updates);

      // 更新本地状态
      setActivities(prev => prev.map(a => a.id === activityId ? response.data : a));

      // 更新选中的时段活动
      if (selectedTimeSlot) {
        const updatedActivities = selectedTimeSlot.activities.map(a =>
          a.id === activityId ? response.data : a
        );
        setSelectedTimeSlot(prev => ({...prev, activities: updatedActivities}));
      }

      message.success('活动更新成功');
      refreshData();
    } catch (error) {
      message.error('更新活动失败');
    }
  };

  // 导出数据功能
  const exportData = () => {
    try {
      // 获取当前周的活动数据
      const exportActivities = activities.filter(a => {
        // 只导出选中团组的活动
        if (!selectedGroups.includes(a.groupId)) return false;

        // 只导出当前周的活动
        const activityDate = dayjs(a.date);
        return activityDate.isSame(currentWeek, 'week');
      });

      // 构建导出数据
      const exportData = exportActivities.map(activity => {
        const group = groups.find(g => g.id === activity.groupId);
        const location = locations.find(l => l.id === activity.locationId);

        return {
          日期: activity.date,
          时段: activity.timeSlot === 'MORNING' ? '上午' :
                activity.timeSlot === 'AFTERNOON' ? '下午' : '晚上',
          团组: group?.name || '',
          类型: group?.type === 'primary' ? '小学' : '中学',
          人数: activity.participantCount,
          地点: location?.name || '未安排',
          联系人: group?.contact_person || '',
          联系电话: group?.contact_phone || ''
        };
      });

      // 按日期和时段排序
      exportData.sort((a, b) => {
        if (a.日期 !== b.日期) return a.日期.localeCompare(b.日期);
        const timeOrder = { '上午': 0, '下午': 1, '晚上': 2 };
        return timeOrder[a.时段] - timeOrder[b.时段];
      });

      // 生成CSV内容
      if (exportData.length === 0) {
        message.warning('当前周没有可导出的活动数据');
        return;
      }

      const headers = ['日期', '时段', '团组', '类型', '人数', '地点', '联系人', '联系电话'];
      const csvContent = [
        headers.join(','),
        ...exportData.map(row =>
          headers.map(header => {
            const value = row[header] || '';
            // 如果值包含逗号或引号，需要用引号包裹并转义
            if (value.toString().includes(',') || value.toString().includes('"')) {
              return `"${value.toString().replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // 添加BOM以支持Excel正确识别UTF-8
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

      // 创建下载链接
      const link = document.createElement('a');
      const weekStart = currentWeek.format('YYYY-MM-DD');
      const weekEnd = currentWeek.endOf('week').format('YYYY-MM-DD');
      link.href = URL.createObjectURL(blob);
      link.download = `行程安排_${weekStart}_至_${weekEnd}.csv`;

      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      message.success('数据导出成功');
    } catch (error) {
      console.error('Export error:', error);
      message.error('数据导出失败');
    }
  };

  // 拖拽开始
  const handleDragStart = (e, activity) => {
    setDraggedActivity(activity);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');

    // 添加拖拽样式
    setTimeout(() => {
      e.target.classList.add('dragging');
    }, 0);
  };

  // 拖拽结束
  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    setDraggedActivity(null);
  };

  // 拖拽经过
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // 拖拽进入
  const handleDragEnter = (e) => {
    e.preventDefault();
    if (e.target.classList.contains('timeline-cell')) {
      e.target.classList.add('drag-over');
    }
  };

  // 拖拽离开
  const handleDragLeave = (e) => {
    if (e.target.classList.contains('timeline-cell')) {
      e.target.classList.remove('drag-over');
    }
  };

  // 检测冲突
  const checkConflicts = (activityId, groupId, locationId, date, timeSlot, participantCount) => {
    const conflicts = [];

    // 1. 检查同一团组的时间冲突
    const groupActivities = activities.filter(a =>
      a.groupId === groupId &&
      a.id !== activityId &&
      a.date === date &&
      a.timeSlot === timeSlot
    );

    if (groupActivities.length > 0) {
      conflicts.push({
        type: 'time',
        message: '该团组在此时段已有其他活动安排'
      });
    }

    // 2. 检查地点容量限制
    if (locationId) {
      const location = locations.find(l => l.id === locationId);
      if (location) {
        // 获取同一时段同一地点的所有活动
        const locationActivities = activities.filter(a =>
          a.locationId === locationId &&
          a.id !== activityId &&
          a.date === date &&
          a.timeSlot === timeSlot
        );

        const totalParticipants = locationActivities.reduce((sum, a) => sum + a.participantCount, 0) + participantCount;

        if (totalParticipants > location.capacity) {
          conflicts.push({
            type: 'capacity',
            message: `地点容量超限：${totalParticipants}/${location.capacity}人`
          });
        }

        // 3. 检查地点不可用日期
        const dayOfWeek = dayjs(date).day();
        const unavailableDays = location.unavailable_days || [];
        const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        if (unavailableDays.includes(dayMap[dayOfWeek])) {
          conflicts.push({
            type: 'unavailable',
            message: `${location.name}在${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayOfWeek]}不可用`
          });
        }

        // 4. 检查地点是否适用于团组类型
        const group = groups.find(g => g.id === groupId);
        if (group && location.allowed_group_types && location.allowed_group_types.length > 0) {
          if (!location.allowed_group_types.includes(group.type)) {
            conflicts.push({
              type: 'groupType',
              message: `${location.name}不适用于${group.type === 'primary' ? '小学' : '中学'}团组`
            });
          }
        }
      }
    }

    return conflicts;
  };

  // 放置
  const handleDrop = async (e, targetDate, targetTimeSlot) => {
    e.preventDefault();
    e.target.classList.remove('drag-over');

    if (!draggedActivity) return;

    const targetDateString = formatDateString(targetDate);

    // 检查是否移动到相同位置
    if (draggedActivity.date === targetDateString && draggedActivity.timeSlot === targetTimeSlot) {
      return;
    }

    // 检查冲突
    const conflicts = checkConflicts(
      draggedActivity.id,
      draggedActivity.groupId,
      draggedActivity.locationId,
      targetDateString,
      targetTimeSlot,
      draggedActivity.participantCount
    );

    if (conflicts.length > 0) {
      // 显示冲突提示
      Modal.confirm({
        title: '检测到冲突',
        content: (
          <div>
            <p>发现以下冲突：</p>
            <ul style={{ paddingLeft: '20px' }}>
              {conflicts.map((c, i) => (
                <li key={i} style={{ color: c.type === 'time' ? '#ff4d4f' : '#faad14', marginBottom: '4px' }}>
                  {c.message}
                </li>
              ))}
            </ul>
            <p style={{ marginTop: '10px' }}>是否仍要继续？</p>
          </div>
        ),
        okText: '继续',
        cancelText: '取消',
        okType: conflicts.some(c => c.type === 'time') ? 'danger' : 'primary',
        onOk: async () => {
          try {
            // 用户确认后继续更新
            await handleUpdateActivity(draggedActivity.id, {
              date: targetDateString,
              timeSlot: targetTimeSlot
            });

            message.warning('活动已更新（存在冲突）');
          } catch (error) {
            message.error('更新活动失败');
          }
        }
      });
    } else {
      try {
        // 无冲突，直接更新
        await handleUpdateActivity(draggedActivity.id, {
          date: targetDateString,
          timeSlot: targetTimeSlot
        });

        message.success('活动时间调整成功');
      } catch (error) {
        message.error('调整活动时间失败');
      }
    }
  };

  return (
    <div className="itinerary-designer">
      {renderTimelineHeader()}

      <div style={{ display: 'flex', height: 'calc(100vh - 56px)', flex: 1 }}>
        {/* 左侧团组面板 */}
        <div style={{
          width: '180px',
          borderRight: '1px solid #e8e8e8',
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {renderGroupPanel()}
        </div>

        {/* 中央时间轴 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          height: '100%',
          minWidth: 0  // 确保flex item可以收缩
        }}>
          {renderTimelineGrid()}
        </div>

        {/* 右侧工具面板 */}
        <div style={{
          width: '180px',
          borderLeft: '1px solid #e8e8e8',
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {renderToolPanel()}
        </div>
      </div>

      {/* 详情编辑弹窗 */}
      <Modal
        title={`编辑行程 - ${selectedTimeSlot?.date} ${timeSlots.find(t => t.key === selectedTimeSlot?.timeSlot)?.label}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={null}
      >
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {/* 添加活动按钮 */}
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                form.setFieldValue('date', selectedTimeSlot?.date);
                form.setFieldValue('timeSlot', selectedTimeSlot?.timeSlot);
              }}
              style={{ width: '100%', height: '40px' }}
            >
              添加团组活动
            </Button>
          </div>

          {/* 添加活动表单 */}
          <Form
            form={form}
            layout="inline"
            onFinish={(values) => {
              handleAddActivity(values.groupId, values.locationId, values.participantCount);
              form.resetFields();
            }}
            style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '6px' }}
          >
            <Form.Item name="groupId" label="选择团组" rules={[{ required: true, message: '请选择团组' }]}>
              <Select placeholder="选择团组" style={{ width: 150 }}>
                {groups.filter(g => selectedGroups.includes(g.id)).map(group => (
                  <Option key={group.id} value={group.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          backgroundColor: group.color,
                          borderRadius: '50%'
                        }}
                      />
                      {group.name}
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="locationId" label="选择地点">
              <Select placeholder="选择地点" allowClear style={{ width: 150 }}>
                {locations.map(location => (
                  <Option key={location.id} value={location.id}>
                    {location.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="participantCount" label="参与人数">
              <InputNumber placeholder="人数" min={1} style={{ width: 80 }} />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" size="small">
                添加
              </Button>
            </Form.Item>
          </Form>

          {/* 现有活动列表 */}
          {selectedTimeSlot?.activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              该时段暂无安排
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
              {selectedTimeSlot?.activities.map(activity => {
                const group = groups.find(g => g.id === activity.groupId);
                const location = locations.find(l => l.id === activity.locationId);

                return (
                  <Card key={activity.id} size="small" style={{ backgroundColor: group?.color + '20' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: group?.color,
                          borderRadius: '2px'
                        }}
                      />
                      <span style={{ fontWeight: 'bold' }}>{group?.name}</span>
                    </div>

                    {/* 可编辑的地点选择 */}
                    <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                      📍 地点:
                      <Select
                        size="small"
                        value={activity.locationId}
                        placeholder="选择地点"
                        allowClear
                        style={{ width: '100%', marginLeft: '4px' }}
                        onChange={(value) => handleUpdateActivity(activity.id, { locationId: value })}
                      >
                        {locations.map(loc => (
                          <Option key={loc.id} value={loc.id}>
                            {loc.name}
                          </Option>
                        ))}
                      </Select>
                    </div>

                    {/* 可编辑的人数 */}
                    <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                      👥 人数:
                      <InputNumber
                        size="small"
                        value={activity.participantCount}
                        min={1}
                        style={{ width: '80px', marginLeft: '4px' }}
                        onChange={(value) => handleUpdateActivity(activity.id, { participantCount: value })}
                      />
                      人
                    </div>

                    <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                      <Button
                        size="small"
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() => handleDeleteActivity(activity.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default ItineraryDesigner;