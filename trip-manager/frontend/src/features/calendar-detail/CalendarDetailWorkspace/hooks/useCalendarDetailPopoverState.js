import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';

const defaultPopoverState = () => ({
  isOpen: false,
  mode: 'create',
  anchorRect: null,
  activity: null,
  initialValues: null
});

const useCalendarDetailPopoverState = ({
  isDragging,
  isResizing,
  buildShixingMealDrafts,
  buildShixingTransferDrafts
}) => {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [popoverState, setPopoverState] = useState(defaultPopoverState);

  const closePopover = useCallback(() => {
    setPopoverState((prev) => (
      prev.isOpen ? { ...prev, isOpen: false } : prev
    ));
  }, []);

  useEffect(() => {
    if (!popoverState.isOpen) return undefined;

    const handleOutsideClick = () => {
      closePopover();
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closePopover();
      }
    };

    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [popoverState.isOpen, closePopover]);

  const handleSlotClick = useCallback((date, time, anchorRect) => {
    if (isDragging || isResizing) return;

    setSelectedSlot({ date, time });

    const startTime = time;
    const endTime = dayjs(`2025-01-01 ${time}`, 'YYYY-MM-DD HH:mm')
      .add(1, 'hour')
      .format('HH:mm');

    setPopoverState({
      isOpen: true,
      mode: 'create',
      anchorRect,
      activity: null,
      initialValues: {
        date,
        startTime,
        endTime,
        type: 'visit',
        title: '',
        location: '',
        mealDrafts: buildShixingMealDrafts(date),
        transferDrafts: buildShixingTransferDrafts(date),
        shixingCardType: 'meal',
        shixingTransferType: 'pickup'
      }
    });
  }, [isDragging, isResizing, buildShixingMealDrafts, buildShixingTransferDrafts]);

  const handleActivityClick = useCallback((event, activity, anchorRect) => {
    event.stopPropagation();
    if (isDragging || isResizing) return;

    setSelectedSlot({ date: activity.date, time: activity.startTime });
    setPopoverState({
      isOpen: true,
      mode: 'edit',
      anchorRect,
      activity,
      initialValues: {
        date: activity.date,
        mealDrafts: buildShixingMealDrafts(activity.date),
        transferDrafts: buildShixingTransferDrafts(activity.date)
      }
    });
  }, [isDragging, isResizing, buildShixingMealDrafts, buildShixingTransferDrafts]);

  const handleActivityContextMenu = useCallback((event, activity, anchorRect) => {
    event.preventDefault();
    event.stopPropagation();
    handleActivityClick(event, activity, anchorRect);
  }, [handleActivityClick]);

  return {
    selectedSlot,
    popoverState,
    handleSlotClick,
    handleActivityClick,
    handleActivityContextMenu,
    closePopover
  };
};

export default useCalendarDetailPopoverState;
