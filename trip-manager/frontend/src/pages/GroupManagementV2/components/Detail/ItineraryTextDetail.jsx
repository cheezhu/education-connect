import React, { useMemo, useState } from 'react';
import { message } from 'antd';
import {
  CopyOutlined,
  FileTextOutlined,
  CodeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import ItineraryEventRow from './ItineraryEventRow';
import { resolveSourceMeta } from '../../../../domain/resourceSource';
import { toMinutes, timeSlotWindows } from '../../../../domain/time';

const safeText = (value) => (value === undefined || value === null ? '' : String(value));
const normalizeInlineText = (value) => safeText(value).replace(/\s+/g, ' ').trim();
const LEGACY_MEAL_TITLES = new Set(['早餐', '午餐', '晚餐', '早饭', '午饭', '晚饭']);

const resolveScheduleNote = (schedule, options = {}) => {
  if (!schedule || typeof schedule !== 'object') return '';
  const { includeDescription = true } = options;
  const title = normalizeInlineText(schedule.title);
  const location = normalizeInlineText(schedule.location);
  const candidates = [
    schedule.note,
    schedule.remark,
    schedule.memo,
    schedule.notes
  ]
    .concat(includeDescription ? [schedule.description] : [])
    .map((item) => normalizeInlineText(item))
    .filter(Boolean);

  if (candidates.length === 0) return '';
  const primary = candidates[0];
  if ((title && primary === title) || (location && primary === location)) {
    return '';
  }
  return primary;
};

const resolveScheduleTitle = (schedule) => {
  if (!schedule || typeof schedule !== 'object') return '';
  const type = normalizeInlineText(schedule.type).toLowerCase();
  const title = normalizeInlineText(schedule.title);
  const description = normalizeInlineText(schedule.description);

  if (type === 'meal' && description && (!title || LEGACY_MEAL_TITLES.has(title))) {
    return description;
  }
  return title || normalizeInlineText(schedule.location);
};

const resolveScheduleAddress = (schedule) => normalizeInlineText(schedule?.location || '');

const resolveMealArrangement = (schedule) => {
  if (!schedule || typeof schedule !== 'object') return '';
  const title = normalizeInlineText(schedule.title);
  const description = normalizeInlineText(schedule.description);

  if (description && (!title || LEGACY_MEAL_TITLES.has(title))) {
    return description;
  }
  if (title && !LEGACY_MEAL_TITLES.has(title)) {
    return title;
  }
  return description || '';
};

const truncate = (value, maxLen = 56) => {
  const text = safeText(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 3))}...`;
};

const buildScheduleMetaItems = (schedule) => {
  const type = normalizeInlineText(schedule?.type).toLowerCase();
  if (type === 'meal') {
    const mealPlan = truncate(resolveMealArrangement(schedule), 52) || '-';
    const manualNote = truncate(resolveScheduleNote(schedule, { includeDescription: false }), 52);
    return manualNote ? [`餐饮安排: ${mealPlan}`, `备注: ${manualNote}`] : [`餐饮安排: ${mealPlan}`];
  }

  if (type === 'transport') {
    const transferInfo = truncate(resolveScheduleNote(schedule), 52) || '-';
    return [`接送信息: ${transferInfo}`];
  }

  const note = truncate(resolveScheduleNote(schedule), 52) || '-';
  return [`备注: ${note}`];
};

// Keep consistent with CalendarDetailWorkspace: derive the window from shared time-slot definitions.
const CALENDAR_START_MIN = toMinutes(timeSlotWindows.MORNING.start) ?? 6 * 60;
const CALENDAR_END_MIN = toMinutes(timeSlotWindows.EVENING.end) ?? (20 * 60 + 45);

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const isWithinCalendarWindow = (schedule) => {
  const start = toMinutes(schedule?.startTime);
  const end = toMinutes(schedule?.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (end <= start) return false;
  if (start < CALENDAR_START_MIN || start > CALENDAR_END_MIN) return false;
  if (end < CALENDAR_START_MIN || end > CALENDAR_END_MIN) return false;
  return true;
};

const isWithinGroupDateRange = (dateStr, group) => {
  const start = safeText(group?.start_date);
  const end = safeText(group?.end_date);
  if (!start || !end) return true;
  return dateStr >= start && dateStr <= end;
};

const normalizeSchedule = (s) => ({
  date: normalizeInlineText(s?.date || s?.activity_date),
  startTime: normalizeInlineText(s?.startTime ?? s?.start_time),
  endTime: normalizeInlineText(s?.endTime ?? s?.end_time),
  type: normalizeInlineText(s?.type),
  title: normalizeInlineText(s?.title),
  location: normalizeInlineText(s?.location),
  description: normalizeInlineText(s?.description),
  note: normalizeInlineText(s?.note ?? s?.remark ?? s?.memo ?? s?.notes),
  resourceId: s?.resourceId ?? s?.resource_id ?? ''
});

const sortSchedules = (schedules = []) => (
  [...(Array.isArray(schedules) ? schedules : [])]
    .map(normalizeSchedule)
    .filter((s) => s.date)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.endTime !== b.endTime) return a.endTime.localeCompare(b.endTime);
      const aMain = resolveScheduleTitle(a) || a.location;
      const bMain = resolveScheduleTitle(b) || b.location;
      return safeText(aMain).localeCompare(safeText(bMain));
    })
);

const resolveSource = (schedule) => {
  const resourceId = schedule?.resourceId ?? '';
  const meta = resolveSourceMeta(resourceId);
  if (meta.kind === 'plan') return { key: 'plan', label: meta.tag };
  if (meta.kind === 'shixing') return { key: 'shixing', label: meta.tag };
  return { key: 'custom', label: meta.tag };
};

const downloadBlob = (filename, blob) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const downloadText = (filename, mimeType, content, { withBom = false } = {}) => {
  const parts = withBom ? ['\uFEFF', content] : [content];
  const blob = new Blob(parts, { type: mimeType || 'text/plain;charset=utf-8' });
  downloadBlob(filename, blob);
};

const copyText = async (content) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const buildExportModel = ({ group, schedules }) => {
  const groupName = safeText(group?.name || '未命名团组');
  const dateRange = group?.start_date && group?.end_date
    ? `${dayjs(group.start_date).format('YYYY-MM-DD')} ~ ${dayjs(group.end_date).format('YYYY-MM-DD')}`
    : '';
  const students = Number(group?.student_count ?? 0) || 0;
  const teachers = Number(group?.teacher_count ?? 0) || 0;
  const total = students + teachers;
  const exportTime = dayjs().format('YYYY-MM-DD HH:mm');

  const byDay = new Map();
  sortSchedules(schedules).forEach((s) => {
    if (!byDay.has(s.date)) byDay.set(s.date, []);
    byDay.get(s.date).push(s);
  });

  const days = Array.from(byDay.entries()).map(([dateStr, items], dayIndex) => {
    const d = dayjs(dateStr);
    const weekLabel = d.isValid() ? (WEEK_LABELS[d.day()] || d.format('ddd')) : '';
    const dayTitle = `${dateStr}${weekLabel ? `（${weekLabel}）` : ''} Day ${dayIndex + 1}`;

    const rows = items.map((s) => {
      const time = s.startTime && s.endTime
        ? `${s.startTime} - ${s.endTime}`
        : (s.startTime || s.endTime || '--:--');
      const title = resolveScheduleTitle(s) || '未命名活动';
      const address = resolveScheduleAddress(s);
      const location = address && address !== title ? address : '-';
      const includeDescription = normalizeInlineText(s.type).toLowerCase() !== 'meal';
      const note = truncate(resolveScheduleNote(s, { includeDescription }), 80) || '-';

      return {
        time,
        title,
        location,
        note
      };
    });

    return {
      dateStr,
      weekLabel,
      dayTitle,
      rows
    };
  });

  return {
    groupName,
    dateRange,
    students,
    teachers,
    total,
    exportTime,
    days
  };
};

const buildManualMarkdown = ({ group, schedules }) => {
  const model = buildExportModel({ group, schedules });
  const head = [
    `# 行程详情：${model.groupName}`,
    model.dateRange ? `- 日期：${model.dateRange}` : '',
    `- 总人数：${model.total}`,
    ''
  ].filter(Boolean).join('\n');

  if (!model.days.length) {
    return `${head}\n- 暂无可导出的行程数据。\n\n- 导出时间：${model.exportTime}\n`;
  }

  const dayBlocks = model.days.map((day) => {
    const title = `## ${day.dateStr}${day.weekLabel ? ` (${day.weekLabel})` : ''}`;
    const lines = day.rows.map((row) => (`- ${row.time} | ${row.title} | 地址: ${row.location} | 备注: ${row.note}`));
    return [title, ...lines, ''].join('\n');
  });

  return `${head}\n${dayBlocks.join('\n')}\n- 导出时间：${model.exportTime}\n`;
};

const toChineseNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return String(value);
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n <= 10) return n === 10 ? '十' : digits[n];
  if (n < 20) return `十${digits[n - 10]}`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return `${digits[tens]}十${ones ? digits[ones] : ''}`;
  }
  return String(n);
};

const chunkText = (value, width) => {
  const text = safeText(value).trim();
  if (!text) return [];
  const chars = [...text];
  const chunks = [];
  for (let i = 0; i < chars.length; i += width) {
    chunks.push(chars.slice(i, i + width).join(''));
  }
  return chunks;
};

const pushWrappedField = (lines, label, value, options = {}) => {
  const content = safeText(value).replace(/\s+/g, ' ').trim();
  if (!content || content === '-') return;

  const indent = options.indent || '   ';
  const maxWidth = Number.isFinite(options.maxWidth) ? options.maxWidth : 34;
  const prefix = `${indent}${label}`;
  const bodyWidth = Math.max(8, maxWidth - [...prefix].length);
  const chunks = chunkText(content, bodyWidth);
  if (chunks.length === 0) return;

  lines.push(`${prefix}${chunks[0]}`);
  const continuePrefix = `${indent}${' '.repeat([...label].length)}`;
  chunks.slice(1).forEach((part) => {
    lines.push(`${continuePrefix}${part}`);
  });
};

const buildManualText = ({ group, schedules }) => {
  const model = buildExportModel({ group, schedules });
  const lines = [
    '一、团组信息',
    `- 团组：${model.groupName}`,
    `- 团期：${model.dateRange || '-'}`,
    `- 人数：${model.total}`,
    '',
    '二、行程安排'
  ];

  if (!model.days.length) {
    lines.push('暂无可导出的行程数据。');
  } else {
    model.days.forEach((day, dayIndex) => {
      const dayNo = toChineseNumber(dayIndex + 1);
      const dayTitle = `${day.dateStr}${day.weekLabel ? `（${day.weekLabel}）` : ''}`;
      lines.push(`（${dayNo}）${dayTitle}`);
      day.rows.forEach((row, rowIndex) => {
        lines.push(`${rowIndex + 1}. ${row.time}  ${row.title}`);
        pushWrappedField(lines, '地址：', row.location, { indent: '   ', maxWidth: 34 });
        pushWrappedField(lines, '备注：', row.note, { indent: '   ', maxWidth: 34 });
        lines.push('');
      });
      if (lines[lines.length - 1] !== '') lines.push('');
    });
  }

  lines.push('三、导出信息');
  lines.push(`导出时间：${model.exportTime}`);
  return lines.join('\n');
};

const buildWordDocxBlob = async ({ group, schedules }) => {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun
  } = await import('docx');

  const DOCX_FONT = 'Microsoft YaHei';

  const makeTextRun = (text, options = {}) => new TextRun({
    text: safeText(text),
    font: DOCX_FONT,
    ...options
  });

  const model = buildExportModel({ group, schedules });
  const children = [
    new Paragraph({
      spacing: { after: 140 },
      children: [makeTextRun(`行程详情：${model.groupName}`, { bold: true, size: 34, color: '0F172A' })]
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [makeTextRun(`日期：${model.dateRange || '-'}`, { size: 24, color: '475569' })]
    }),
    new Paragraph({
      spacing: { after: 180 },
      children: [makeTextRun(`总人数：${model.total}`, { size: 24, color: '475569' })]
    })
  ];

  if (!model.days.length) {
    children.push(new Paragraph({ children: [makeTextRun('暂无可导出的行程数据。')] }));
  } else {
    model.days.forEach((day) => {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 100 },
          children: [makeTextRun(day.dayTitle, { bold: true, size: 28, color: '1E3A8A' })]
        })
      );

      day.rows.forEach((row) => {
        const inlineAddress = row.location && row.location !== '-' ? `  ${row.location}` : '';
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 30 },
            children: [
              makeTextRun(`${row.time}  ${row.title}`, { bold: true, size: 24, color: '0F172A' }),
              makeTextRun(inlineAddress, { size: 24, color: '0F172A' })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [makeTextRun(`备注：${row.note}`, { size: 22, color: '475569' })]
          })
        );
      });
    });
  }

  children.push(
    new Paragraph({
      spacing: { before: 160, after: 40 },
      children: [makeTextRun(`导出时间：${model.exportTime}`, { size: 22, color: '64748B' })]
    })
  );

  const doc = new Document({
    creator: 'Education Connect',
    title: `行程详情_${model.groupName}`,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 }
          }
        },
        children
      }
    ]
  });

  return Packer.toBlob(doc);
};

const buildDayMeta = (dateStr, groupStart, fallbackIndex) => {
  const d = dayjs(dateStr);
  const dateLabel = d.isValid() ? d.format('MM-DD') : safeText(dateStr);
  const weekLabel = d.isValid() ? (WEEK_LABELS[d.day()] ?? '') : '';

  let dayNumber = fallbackIndex + 1;
  if (groupStart) {
    const start = dayjs(groupStart);
    if (start.isValid() && d.isValid()) {
      const diff = d.diff(start, 'day');
      dayNumber = Number.isFinite(diff) ? (diff + 1) : dayNumber;
    }
  }

  return {
    dateLabel,
    metaLabel: weekLabel ? `${weekLabel} · Day ${dayNumber}` : `Day ${dayNumber}`
  };
};

const extractText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name.trim();
    if (typeof value.label === 'string') return value.label.trim();
    if (typeof value.value === 'string' || typeof value.value === 'number') return String(value.value).trim();
  }
  return '';
};

const buildLogisticsSummaryItems = (row) => {
  if (!row || typeof row !== 'object') return [];

  const hotelDisabled = Boolean(row.hotel_disabled);
  const vehicleDisabled = Boolean(row.vehicle_disabled || row.vehicle?.disabled);
  const guideDisabled = Boolean(row.guide_disabled || row.guide?.disabled);

  const hotel = !hotelDisabled ? extractText(row.hotel) : '';
  const vehiclePlate = !vehicleDisabled ? extractText(row.vehicle?.plate) : '';
  const vehicleDriver = !vehicleDisabled ? extractText(row.vehicle?.driver || row.vehicle?.name) : '';
  const guideName = !guideDisabled ? extractText(row.guide?.name || row.guide) : '';
  const guidePhone = !guideDisabled ? extractText(row.guide?.phone) : '';

  const vehicleText = [vehiclePlate, vehicleDriver].filter(Boolean).join(' ');
  const guideText = guideName
    ? `${guideName}${guidePhone ? ` (${guidePhone})` : ''}`
    : '';

  const items = [];
  if (vehicleText) items.push(`车辆：${vehicleText}`);
  if (hotel) items.push(`住宿：${hotel}`);
  if (guideText) items.push(`导游：${guideText}`);
  return items;
};

const ItineraryTextDetail = ({ group, schedules }) => {
  const [exporting, setExporting] = useState(false);

  const sortedSchedules = useMemo(() => sortSchedules(schedules), [schedules]);
  const visibleSchedules = useMemo(() => (
    sortedSchedules.filter((s) => (
      Boolean(s?.date)
      && isWithinGroupDateRange(s.date, group)
      && isWithinCalendarWindow(s)
    ))
  ), [sortedSchedules, group?.start_date, group?.end_date]);
  const overflowCount = Math.max(0, sortedSchedules.length - visibleSchedules.length);

  const groupTitle = safeText(group?.name || '未选择团组');
  const groupId = safeText(group?.id);

  const pax = useMemo(() => {
    const students = Number(group?.student_count ?? 0) || 0;
    const teachers = Number(group?.teacher_count ?? 0) || 0;
    return students + teachers;
  }, [group?.student_count, group?.teacher_count]);

  const days = useMemo(() => {
    if (group?.start_date && group?.end_date) {
      const start = dayjs(group.start_date);
      const end = dayjs(group.end_date);
      if (start.isValid() && end.isValid()) {
        return Math.max(1, end.diff(start, 'day') + 1);
      }
    }
    const unique = new Set(visibleSchedules.map((s) => s.date).filter(Boolean));
    return unique.size || 0;
  }, [group?.start_date, group?.end_date, visibleSchedules]);

  const logisticsByDate = useMemo(() => {
    const map = new Map();
    const list = Array.isArray(group?.logistics) ? group.logistics : [];
    list.forEach((row) => {
      const date = safeText(row?.date || row?.activity_date).trim();
      if (!date) return;
      map.set(date, row);
    });
    return map;
  }, [group?.logistics]);

  const dayGroups = useMemo(() => {
    const map = new Map();
    visibleSchedules.forEach((s, idx) => {
      const sourceType = resolveSource(s).key;
      const title = resolveScheduleTitle(s) || '未命名活动';
      const address = resolveScheduleAddress(s);
      const location = address && address !== title ? address : '';
      const key = `${s.date}-${idx}-${safeText(s.startTime)}-${safeText(s.endTime)}-${title}-${location}-${safeText(s.resourceId)}`;
      const metaItems = buildScheduleMetaItems(s);

      const ev = {
        key,
        date: s.date,
        time: s.startTime && s.endTime
          ? `${s.startTime}-${s.endTime}`
          : (s.startTime || s.endTime || '--:--'),
        title,
        location,
        sourceType,
        metaItems
      };

      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date).push(ev);
    });

    return Array.from(map.entries()).map(([dateStr, events]) => ({ dateStr, events }));
  }, [visibleSchedules]);

  const compactMetaText = useMemo(() => {
    const parts = [];
    if (pax) parts.push(`${pax}人`);
    if (days) parts.push(`${days}天行程`);
    if (group?.start_date && group?.end_date) {
      parts.push(`${group.start_date}~${group.end_date}`);
    }
    if (overflowCount) parts.push(`已隐藏${overflowCount}条超窗活动`);
    return parts.filter(Boolean).join(' · ');
  }, [pax, days, group?.start_date, group?.end_date, overflowCount]);

  const handleExportWord = async () => {
    if (!group) return;
    setExporting(true);
    try {
      const filename = `行程详情_${safeText(group?.name || group?.id)}.docx`;
      const blob = await buildWordDocxBlob({ group, schedules: visibleSchedules });
      downloadBlob(filename, blob);
      message.success('已导出 DOCX', 1);
    } catch (error) {
      console.error('DOCX export failed:', error);
      message.error('导出 DOCX 失败，请重试', 1.5);
    } finally {
      setExporting(false);
    }
  };

  const handleExportTxt = async () => {
    if (!group) return;
    setExporting(true);
    try {
      const txt = buildManualText({ group, schedules: visibleSchedules });
      const filename = `行程详情_${safeText(group?.name || group?.id)}.txt`;
      downloadText(filename, 'text/plain;charset=utf-8', txt, { withBom: true });
      message.success('已导出 TXT', 1);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyTxt = async () => {
    if (!group) return;
    setExporting(true);
    try {
      const txt = buildManualText({ group, schedules: visibleSchedules });
      await copyText(txt);
      message.success('已复制 TXT 内容', 1);
    } catch (error) {
      console.error('TXT copy failed:', error);
      message.error('复制失败，请重试', 1.5);
    } finally {
      setExporting(false);
    }
  };

  const handleExportMarkdown = async () => {
    if (!group) return;
    setExporting(true);
    try {
      const md = buildManualMarkdown({ group, schedules: visibleSchedules });
      const filename = `行程详情_${safeText(group?.name || group?.id)}.md`;
      downloadText(filename, 'text/markdown;charset=utf-8', md, { withBom: true });
      message.success('已导出 MD', 1);
    } finally {
      setExporting(false);
    }
  };

  if (!group) return <div className="empty-state">请选择团组</div>;

  return (
    <div className="itinerary-view">
      <div className="itinerary-header">
        <div className="iti-title-compact">
          <span>{groupTitle}</span>
          {groupId ? <span className="iti-tag">{groupId}</span> : null}
          {compactMetaText ? (
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>
              {compactMetaText}
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="action-sm" disabled={exporting} onClick={handleExportWord}>
            <FileTextOutlined /> 导出 DOCX
          </button>
          <button type="button" className="action-sm" disabled={exporting} onClick={handleExportMarkdown}>
            <CopyOutlined /> 导出 MD
          </button>
          <button type="button" className="action-sm" disabled={exporting} onClick={handleExportTxt}>
            <CodeOutlined /> 导出 TXT
          </button>
          <button type="button" className="action-sm" disabled={exporting} onClick={handleCopyTxt}>
            <CopyOutlined /> 复制 TXT
          </button>
        </div>
      </div>

      {dayGroups.length === 0 ? (
        <div className="empty-state">暂无行程</div>
      ) : (
        dayGroups.map(({ dateStr, events }, dayIndex) => {
          const { dateLabel, metaLabel } = buildDayMeta(dateStr, group?.start_date, dayIndex);
          const logisticsRow = logisticsByDate.get(dateStr) || null;
          const logisticsItems = buildLogisticsSummaryItems(logisticsRow);

          return (
            <div className="day-section" key={dateStr}>
              <div className="day-bar" title={dateStr}>
                <span className="day-date">{dateLabel}</span>
                <span className="day-meta">{metaLabel}</span>
              </div>

              <div className="event-grid">
                {events.map((ev) => (
                  <ItineraryEventRow
                    key={ev.key}
                    time={ev.time}
                    title={ev.title}
                    location={ev.location}
                    sourceType={ev.sourceType}
                    metaItems={ev.metaItems}
                  />
                ))}

                {logisticsItems.length ? (
                  <div className="logistics-summary">
                    {logisticsItems.map((item) => (
                      <div className="ls-item" key={item}>
                        {item}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default ItineraryTextDetail;
