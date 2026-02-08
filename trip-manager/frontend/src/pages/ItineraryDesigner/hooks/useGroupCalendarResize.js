import { useCallback, useEffect, useRef, useState } from 'react';

export default function useGroupCalendarResize({
  heightRef,
  normalizeHeight,
  setHeight,
  persistHeight
}) {
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  useEffect(() => (
    () => {
      clearTimeout(saveTimeoutRef.current);
      resizeRef.current = null;
    }
  ), []);

  const handleMove = useCallback((event) => {
    if (!resizeRef.current) return;
    const point = event.touches ? event.touches[0] : event;
    if (!point) return;
    const clientY = point.clientY;
    if (!Number.isFinite(clientY)) return;

    const deltaY = resizeRef.current.startY - clientY;
    const viewportHeight = window.innerHeight || 1;
    const deltaVh = (deltaY / viewportHeight) * 100;
    const nextHeight = normalizeHeight(resizeRef.current.startHeight + deltaVh);
    if (nextHeight === null) return;
    setHeight(nextHeight);
    if (event.cancelable) {
      event.preventDefault();
    }
  }, [normalizeHeight, setHeight]);

  const handleEnd = useCallback(() => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    setResizing(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleEnd);
    window.removeEventListener('touchmove', handleMove);
    window.removeEventListener('touchend', handleEnd);

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistHeight(heightRef.current);
    }, 300);
  }, [handleMove, heightRef, persistHeight]);

  const onResizeStart = useCallback((event) => {
    if (event?.button !== undefined && event.button !== 0) return;
    const point = event.touches ? event.touches[0] : event;
    if (!point) return;
    const clientY = point.clientY;
    if (!Number.isFinite(clientY)) return;

    resizeRef.current = {
      startY: clientY,
      startHeight: heightRef.current
    };
    setResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  }, [handleEnd, handleMove, heightRef]);

  return {
    resizing,
    onResizeStart
  };
}

