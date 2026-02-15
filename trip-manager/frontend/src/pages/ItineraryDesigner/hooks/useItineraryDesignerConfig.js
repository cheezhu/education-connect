import message from 'antd/es/message';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { timeSlotKeys } from '../shared/timeSlots';

export default function useItineraryDesignerConfig({ api }) {
  const GROUP_CALENDAR_HEIGHT_DEFAULT = 30;
  const GROUP_CALENDAR_HEIGHT_MIN = 20;
  const GROUP_CALENDAR_HEIGHT_MAX = 70;

  const getStoredWeekStartDate = () => {
    try {
      const stored = localStorage.getItem('itinerary_week_start');
      if (stored && dayjs(stored).isValid()) {
        return dayjs(stored);
      }
    } catch (error) {
      // ignore
    }
    return dayjs().startOf('day');
  };

  const getStoredTimeSlots = () => {
    try {
      const stored = localStorage.getItem('itinerary_time_slots');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = timeSlotKeys.filter((key) => parsed.includes(key));
          if (filtered.length) {
            return filtered;
          }
        }
      }
    } catch (error) {
      // ignore
    }
    return timeSlotKeys;
  };

  const getStoredDailyFocus = () => {
    try {
      const stored = localStorage.getItem('itinerary_daily_focus');
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch (error) {
      // ignore
    }
    return true;
  };

  const getStoredShowUnscheduled = () => {
    try {
      const stored = localStorage.getItem('itinerary_show_unscheduled');
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch (error) {
      // ignore
    }
    return false;
  };

  const normalizeGroupCalendarHeight = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const clamped = Math.min(
      GROUP_CALENDAR_HEIGHT_MAX,
      Math.max(GROUP_CALENDAR_HEIGHT_MIN, parsed)
    );
    return Math.round(clamped * 10) / 10;
  };

  const getStoredGroupCalendarHeight = () => {
    try {
      const stored = localStorage.getItem('itinerary_group_calendar_height');
      const normalized = normalizeGroupCalendarHeight(stored);
      if (normalized !== null) return normalized;
    } catch (error) {
      // ignore
    }
    return GROUP_CALENDAR_HEIGHT_DEFAULT;
  };

  const [weekStartDate, setWeekStartDate] = useState(() => getStoredWeekStartDate());
  const [enabledTimeSlots, setEnabledTimeSlots] = useState(() => getStoredTimeSlots());
  const [showDailyFocus, setShowDailyFocus] = useState(() => getStoredDailyFocus());
  const [showUnscheduledGroups, setShowUnscheduledGroups] = useState(() => getStoredShowUnscheduled());
  const [groupCalendarHeight, setGroupCalendarHeight] = useState(() => getStoredGroupCalendarHeight());

  const groupCalendarHeightRef = useRef(getStoredGroupCalendarHeight());
  useEffect(() => {
    groupCalendarHeightRef.current = groupCalendarHeight;
  }, [groupCalendarHeight]);

  const loadWeekStartDate = async () => {
    try {
      const response = await api.get('/config/itinerary-week-start');
      if (response.data?.date && dayjs(response.data.date).isValid()) {
        const nextDate = dayjs(response.data.date);
        if (!weekStartDate || !nextDate.isSame(weekStartDate, 'day')) {
          setWeekStartDate(nextDate);
        }
        try {
          localStorage.setItem('itinerary_week_start', nextDate.format('YYYY-MM-DD'));
        } catch (error) {
          // ignore
        }
      }
    } catch (error) {
      message.warning('读取周起始日期失败');
    }
  };

  const persistWeekStartDate = async (nextDate) => {
    const normalized = dayjs(nextDate).startOf('day');
    setWeekStartDate(normalized);
    try {
      localStorage.setItem('itinerary_week_start', normalized.format('YYYY-MM-DD'));
    } catch (error) {
      // ignore
    }
    try {
      await api.put('/config/itinerary-week-start', {
        date: normalized.format('YYYY-MM-DD')
      });
    } catch (error) {
      message.error('保存周起始日期失败');
    }
  };

  const loadTimeSlotConfig = async () => {
    try {
      const response = await api.get('/config/itinerary-time-slots');
      const slots = response.data?.slots;
      if (Array.isArray(slots)) {
        const normalized = timeSlotKeys.filter((key) => slots.includes(key));
        const current = enabledTimeSlots;
        const same = normalized.length === current.length
          && normalized.every((slot, index) => slot === current[index]);
        if (!same) {
          setEnabledTimeSlots(normalized);
        }
        try {
          localStorage.setItem('itinerary_time_slots', JSON.stringify(normalized));
        } catch (error) {
          // ignore
        }
      }
    } catch (error) {
      message.warning('读取时间段设置失败');
    }
  };

  const persistTimeSlotConfig = async (slots) => {
    setEnabledTimeSlots(slots);
    try {
      localStorage.setItem('itinerary_time_slots', JSON.stringify(slots));
    } catch (error) {
      // ignore
    }
    try {
      await api.put('/config/itinerary-time-slots', {
        slots
      });
    } catch (error) {
      message.error('保存时间段设置失败');
    }
  };

  const loadDailyFocusConfig = async () => {
    try {
      const response = await api.get('/config/itinerary-daily-focus');
      if (typeof response.data?.enabled === 'boolean') {
        const nextValue = response.data.enabled;
        if (nextValue !== showDailyFocus) {
          setShowDailyFocus(nextValue);
        }
        try {
          localStorage.setItem('itinerary_daily_focus', nextValue ? 'true' : 'false');
        } catch (error) {
          // ignore
        }
      }
    } catch (error) {
      // ignore
    }
  };

  const persistDailyFocusConfig = async (enabled) => {
    setShowDailyFocus(enabled);
    try {
      localStorage.setItem('itinerary_daily_focus', enabled ? 'true' : 'false');
    } catch (error) {
      // ignore
    }
    try {
      await api.put('/config/itinerary-daily-focus', {
        enabled
      });
    } catch (error) {
      // ignore
    }
  };

  const loadGroupCalendarHeightConfig = async () => {
    try {
      const response = await api.get('/config/itinerary-group-calendar-height');
      const normalized = normalizeGroupCalendarHeight(response.data?.height);
      if (normalized !== null && normalized !== groupCalendarHeightRef.current) {
        setGroupCalendarHeight(normalized);
        try {
          localStorage.setItem('itinerary_group_calendar_height', String(normalized));
        } catch (error) {
          // ignore
        }
      }
    } catch (error) {
      // ignore
    }
  };

  const persistGroupCalendarHeightConfig = async (heightValue) => {
    const normalized = normalizeGroupCalendarHeight(heightValue);
    if (normalized === null) return;
    try {
      localStorage.setItem('itinerary_group_calendar_height', String(normalized));
    } catch (error) {
      // ignore
    }
    try {
      await api.put('/config/itinerary-group-calendar-height', {
        height: normalized
      });
    } catch (error) {
      // ignore
    }
  };

  useEffect(() => {
    loadWeekStartDate();
    loadTimeSlotConfig();
    loadDailyFocusConfig();
    loadGroupCalendarHeightConfig();
  }, []);

  const handleTimeSlotToggle = (slots) => {
    const normalized = timeSlotKeys.filter((key) => slots.includes(key));
    persistTimeSlotConfig(normalized);
  };

  const handleDailyFocusToggle = (event) => {
    persistDailyFocusConfig(event.target.checked);
  };

  const handleShowUnscheduledToggle = (event) => {
    const nextValue = event.target.checked;
    setShowUnscheduledGroups(nextValue);
    try {
      localStorage.setItem('itinerary_show_unscheduled', nextValue ? 'true' : 'false');
    } catch (error) {
      // ignore
    }
  };

  const handleWeekStartChange = (value) => {
    if (!value) return;
    persistWeekStartDate(value);
  };

  const handleWeekShift = (days) => {
    const baseDate = weekStartDate ? dayjs(weekStartDate) : dayjs();
    persistWeekStartDate(baseDate.add(days, 'day'));
  };

  return {
    weekStartDate,
    enabledTimeSlots,
    showDailyFocus,
    showUnscheduledGroups,
    groupCalendarHeight,
    setGroupCalendarHeight,
    groupCalendarHeightRef,
    normalizeGroupCalendarHeight,
    persistGroupCalendarHeightConfig,
    handleTimeSlotToggle,
    handleDailyFocusToggle,
    handleShowUnscheduledToggle,
    handleWeekStartChange,
    handleWeekShift
  };
}
