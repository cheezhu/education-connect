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
  // Dates are `YYYY-MM-DD`, so lexicographic compare works.
  return dateStr >= start && dateStr <= end;
};

const normalizeSchedule = (s) => ({
  date: safeText(s?.date || s?.activity_date),
  startTime: safeText(s?.startTime ?? s?.start_time),
  endTime: safeText(s?.endTime ?? s?.end_time),
  type: safeText(s?.type),
  title: safeText(s?.title),
  location: safeText(s?.location),
  description: safeText(s?.description),
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
      const aMain = a.title || a.location;
      const bMain = b.title || b.location;
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

const truncate = (value, maxLen = 56) => {
  const text = safeText(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 3))}...`;
};

const downloadText = (filename, mimeType, content) => {
  const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const escapeHtml = (value) => safeText(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildManualMarkdown = ({ group, schedules }) => {
  const groupName = safeText(group?.name || '未命名团组');
  const dateRange = group?.start_date && group?.end_date
    ? `${dayjs(group.start_date).format('YYYY-MM-DD')} ~ ${dayjs(group.end_date).format('YYYY-MM-DD')}`
    : '';
  const students = Number(group?.student_count ?? 0) || 0;
  const teachers = Number(group?.teacher_count ?? 0) || 0;
  const total = students + teachers;

  const head = [
    `# 行程详情：${groupName}`,
    dateRange ? `- 日期：${dateRange}` : '',
    `- 人数：${students} 学生 + ${teachers} 老师 = ${total}`,
    ''
  ].filter(Boolean).join('\n');

  const byDay = new Map();
  sortSchedules(schedules).forEach((s) => {
    if (!byDay.has(s.date)) byDay.set(s.date, []);
    byDay.get(s.date).push(s);
  });

  const dayBlocks = Array.from(byDay.entries()).map(([dateStr, items]) => {
    const title = `## ${dateStr} (${dayjs(dateStr).format('ddd')})`;
    const lines = items.map((s) => {
      const time = s.startTime && s.endTime ? `${s.startTime}-${s.endTime}` : (s.startTime || s.endTime || '--:--');
      const main = s.title || s.location || '未命名活动';
      const loc = s.location && s.location !== main ? ` @ ${s.location}` : '';
      return `- ${time} ${main}${loc}`;
    });
    return [title, ...lines, ''].join('\n');
  });

  return `${head}\n${dayBlocks.join('\n')}`.trim() + '\n';
};

const buildWordDocumentHtml = ({ group, schedules }) => {
  const groupName = escapeHtml(group?.name || '未命名团组');
  const exportTime = dayjs().format('YYYY-MM-DD HH:mm');

  const byDay = new Map();
  sortSchedules(schedules).forEach((s) => {
    if (!byDay.has(s.date)) byDay.set(s.date, []);
    byDay.get(s.date).push(s);
  });

  const dayBlocks = Array.from(byDay.entries()).map(([dateStr, items], dayIndex) => {
    const weekLabel = WEEK_LABELS[dayjs(dateStr).day()] || '';
    const title = `${dateStr}${weekLabel ? `（${weekLabel}）` : ''}  Day ${dayIndex + 1}`;

    const rows = items.map((s) => {
      const source = resolveSource(s).label || '自定义';
      const time = s.startTime && s.endTime
        ? `${s.startTime} - ${s.endTime}`
        : `${s.startTime || s.endTime || '--:--'}`;
      const main = s.title || s.location || '未命名活动';
      const location = s.location && s.location !== main ? s.location : '-';
      const note = truncate(s.description, 80) || '-';

      return `
        <tr>
          <td>${escapeHtml(time)}</td>
          <td>${escapeHtml(main)}</td>
          <td>${escapeHtml(location)}</td>
          <td>${escapeHtml(source)}</td>
          <td>${escapeHtml(note)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="day-section">
        <div class="day-title">${escapeHtml(title)}</div>
        <table class="event-table">
          <thead>
            <tr>
              <th style="width: 110px;">时间</th>
              <th style="width: 240px;">活动</th>
              <th style="width: 190px;">地点</th>
              <th style="width: 90px;">来源</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  return `
    <html
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40"
    >
      <head>
        <meta charset="utf-8" />
        <title>行程详情</title>
        <style>
          @page { size: A4; margin: 1.6cm 1.6cm; }
          body {
            font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif;
            color: #1f2937;
            font-size: 11pt;
            line-height: 1.5;
          }
          .doc-wrap {
            max-width: 780px;
            margin: 0 auto;
          }
          .doc-title {
            font-size: 20pt;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 8px;
          }
          .doc-sub {
            color: #475569;
            margin-bottom: 4px;
          }
          .meta-row {
            margin-bottom: 16px;
            padding: 8px 10px;
            border: 1px solid #dbe3ef;
            background: #f8fbff;
            border-radius: 6px;
          }
          .day-section {
            margin-bottom: 18px;
            page-break-inside: avoid;
          }
          .day-title {
            font-size: 13pt;
            font-weight: 700;
            color: #0f172a;
            border-left: 4px solid #3b82f6;
            padding-left: 8px;
            margin-bottom: 8px;
          }
          .event-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .event-table th {
            background: #eef4ff;
            border: 1px solid #d6e4ff;
            color: #1e3a8a;
            text-align: left;
            padding: 6px 8px;
            font-weight: 700;
          }
          .event-table td {
            border: 1px solid #e2e8f0;
            padding: 6px 8px;
            vertical-align: top;
            word-break: break-word;
          }
          .footer {
            margin-top: 20px;
            color: #64748b;
            font-size: 9.5pt;
          }
        </style>
      </head>
      <body>
        <div class="doc-wrap">
          <div class="doc-title">行程详情：${groupName}</div>
          <div class="doc-sub">导出时间：${escapeHtml(exportTime)}</div>
          ${dayBlocks || '<div class="doc-sub">暂无可导出的行程数据。</div>'}
          <div class="footer">文档由系统自动生成，可在 Word 中继续编辑排版。</div>
        </div>
      </body>
    </html>
  `;
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
      const title = safeText(s.title || s.location || '').trim();
      const location = safeText(s.location).trim();
      const key = `${s.date}-${idx}-${safeText(s.startTime)}-${safeText(s.endTime)}-${title}-${location}-${safeText(s.resourceId)}`;

      const metaItems = [];
      if (s.startTime && s.endTime) {
        metaItems.push(`时段: ${s.startTime}-${s.endTime}`);
      }
      if (s.description) {
        metaItems.push(`备注: ${truncate(s.description, 52)}`);
      }

      const ev = {
        key,
        date: s.date,
        time: s.startTime || '--:--',
        title: title || location || '未命名活动',
        location: location && location !== title ? location : '',
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
    if (overflowCount) parts.push(`已隐藏${overflowCount}条溢出`);
    return parts.filter(Boolean).join(' · ');
  }, [pax, days, group?.start_date, group?.end_date, overflowCount]);

  const handleExportWord = async () => {
    if (!group) return;
    setExporting(true);
    try {
      const wordHtml = buildWordDocumentHtml({ group, schedules: visibleSchedules });
      const filename = `行程详情_${safeText(group?.name || group?.id)}.doc`;
      downloadText(filename, 'application/msword;charset=utf-8', wordHtml);
      message.success('已导出 Word', 1);
    } finally {
      setExporting(false);
    }
  };

  const handleExportJson = async () => {
    if (!group) return;
    setExporting(true);
    try {
      const payload = {
        groupId: group?.id,
        groupName: group?.name,
        start_date: group?.start_date,
        end_date: group?.end_date,
        schedules: visibleSchedules
      };
      const filename = `行程详情_${safeText(group?.name || group?.id)}.json`;
      downloadText(filename, 'application/json;charset=utf-8', JSON.stringify(payload, null, 2));
      message.success('已导出 JSON', 1);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!group) return;
    try {
      const md = buildManualMarkdown({ group, schedules: visibleSchedules });
      await navigator.clipboard.writeText(md);
      message.success('已复制 Markdown', 1);
    } catch (error) {
      message.error('复制失败：浏览器不允许或未授予权限');
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
            <FileTextOutlined /> 导出 Word
          </button>
          <button type="button" className="action-sm" onClick={handleCopyMarkdown}>
            <CopyOutlined /> 复制文本
          </button>
          <button type="button" className="action-sm" disabled={exporting} onClick={handleExportJson}>
            <CodeOutlined /> 导出 JSON
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
