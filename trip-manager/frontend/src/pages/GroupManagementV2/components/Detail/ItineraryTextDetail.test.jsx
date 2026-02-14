import { describe, expect, it } from 'vitest';
import {
  buildExportModel,
  buildManualMarkdown,
  buildManualText
} from './ItineraryTextDetail';

const group = {
  id: 7,
  name: 'Demo Group',
  start_date: '2025-07-01',
  end_date: '2025-07-02',
  student_count: 4,
  teacher_count: 0
};

const schedules = [
  {
    date: '2025-07-01',
    startTime: '08:00',
    endTime: '09:00',
    type: 'meal',
    title: '早餐',
    description: 'Hotel Buffet',
    location: 'Dining Hall',
    note: ''
  },
  {
    date: '2025-07-01',
    startTime: '10:00',
    endTime: '11:00',
    type: 'transport',
    title: '接站',
    description: 'MU1234 / T1',
    location: 'Airport',
    note: ''
  },
  {
    date: '2025-07-02',
    startTime: '14:00',
    endTime: '15:00',
    type: 'activity',
    title: 'Museum',
    description: '',
    location: 'Central Museum',
    note: 'Bring water'
  }
];

describe('ItineraryTextDetail export builders', () => {
  it('buildExportModel summarizes group with total pax only', () => {
    const model = buildExportModel({ group, schedules });
    expect(model.groupName).toBe('Demo Group');
    expect(model.total).toBe(4);
    expect(model.days.length).toBe(2);
  });

  it('buildManualMarkdown includes unified fields and excludes source labels', () => {
    const md = buildManualMarkdown({ group, schedules });
    expect(md).toContain('# 行程详情：Demo Group');
    expect(md).toContain('- 总人数：4');
    expect(md).toContain('Hotel Buffet');
    expect(md).toContain('导出时间：');
    expect(md).not.toContain('来源');
  });

  it('buildManualText structure matches export requirements and excludes source labels', () => {
    const txt = buildManualText({ group, schedules });
    expect(txt).toContain('一、团组信息');
    expect(txt).toContain('- 人数：4');
    expect(txt).toContain('二、行程安排');
    expect(txt).toContain('三、导出信息');
    expect(txt).toContain('导出时间：');
    expect(txt).not.toContain('来源');
  });
});
