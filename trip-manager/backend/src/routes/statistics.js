const express = require('express');
const router = express.Router();

// 获取统计数据
router.get('/', (req, res) => {
  try {
    // 基础统计
    const groupCount = req.db.prepare('SELECT COUNT(*) as count FROM groups').get();
    const locationCount = req.db.prepare('SELECT COUNT(*) as count FROM locations WHERE is_active = 1').get();
    const activityCount = req.db.prepare('SELECT COUNT(*) as count FROM activities').get();
    
    // 地点使用统计
    const locationUsage = req.db.prepare(`
      SELECT 
        l.name as location_name,
        COUNT(a.id) as activity_count,
        COALESCE(SUM(a.participant_count), 0) as total_participants
      FROM locations l
      LEFT JOIN activities a ON l.id = a.location_id
      WHERE l.is_active = 1
      GROUP BY l.id, l.name
      ORDER BY activity_count DESC
    `).all();
    
    // 团组活动统计
    const groupActivities = req.db.prepare(`
      SELECT 
        g.name as group_name,
        g.type as group_type,
        COUNT(a.id) as activity_count,
        MIN(a.activity_date) as first_activity,
        MAX(a.activity_date) as last_activity
      FROM groups g
      LEFT JOIN activities a ON g.id = a.group_id
      GROUP BY g.id, g.name, g.type
      ORDER BY activity_count DESC
    `).all();
    
    // 每日活动统计
    const dailyActivities = req.db.prepare(`
      SELECT 
        activity_date,
        COUNT(*) as activity_count,
        SUM(participant_count) as total_participants
      FROM activities
      GROUP BY activity_date
      ORDER BY activity_date
    `).all();
    
    // 时段分布统计
    const timeSlotDistribution = req.db.prepare(`
      SELECT 
        time_slot,
        COUNT(*) as count,
        SUM(participant_count) as total_participants
      FROM activities
      GROUP BY time_slot
    `).all();
    
    res.json({
      summary: {
        groups: groupCount.count,
        locations: locationCount.count,
        activities: activityCount.count
      },
      locationUsage,
      groupActivities,
      dailyActivities,
      timeSlotDistribution
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// 导出活动安排表
router.get('/export', (req, res) => {
  const { format = 'json', startDate, endDate } = req.query;
  
  let query = 'SELECT * FROM calendar_view WHERE 1=1';
  const params = [];
  
  if (startDate) {
    query += ' AND activity_date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND activity_date <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY activity_date, time_slot';
  
  try {
    const activities = req.db.prepare(query).all(...params);
    
    if (format === 'csv') {
      // 生成CSV格式
      const csvHeader = '日期,时段,团组,类型,地点,参与人数,地点容量\n';
      const csvData = activities.map(a => 
        `${a.activity_date},${a.time_slot},${a.group_name},${a.group_type === 'primary' ? '小学' : '中学'},${a.location_name},${a.participant_count},${a.location_capacity}`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=activities.csv');
      res.send('\uFEFF' + csvHeader + csvData); // 添加BOM以支持中文
    } else {
      // 默认JSON格式
      res.json(activities);
    }
  } catch (error) {
    console.error('导出数据失败:', error);
    res.status(500).json({ error: '导出数据失败' });
  }
});

module.exports = router;