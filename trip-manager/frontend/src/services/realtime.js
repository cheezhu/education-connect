import { clearStoredAuth, getAuthHeader } from './auth';

const STREAM_URL = '/api/realtime/stream';
const RETRY_BASE_MS = 1200;
const RETRY_MAX_MS = 12000;

const normalizeBlocks = (buffer) => {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const complete = parts.slice(0, -1);
  const tail = parts[parts.length - 1] || '';
  return { complete, tail };
};

const parseBlock = (block) => {
  const lines = block.split('\n');
  let event = 'message';
  const dataParts = [];

  lines.forEach((line) => {
    if (!line || line.startsWith(':')) return;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() || 'message';
      return;
    }
    if (line.startsWith('data:')) {
      dataParts.push(line.slice(5).trimStart());
    }
  });

  if (dataParts.length === 0) return null;
  const raw = dataParts.join('\n');
  try {
    return { event, payload: JSON.parse(raw) };
  } catch (error) {
    return { event, payload: { raw } };
  }
};

export const subscribeRealtimeChanges = ({ onChange, onStatus } = {}) => {
  let closed = false;
  let retryCount = 0;
  let reconnectTimer = null;
  let abortController = null;

  const notifyStatus = (status) => {
    if (typeof onStatus === 'function') {
      onStatus(status);
    }
  };

  const cleanup = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  const scheduleReconnect = () => {
    if (closed) return;
    const jitter = Math.floor(Math.random() * 250);
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * (2 ** retryCount)) + jitter;
    retryCount += 1;
    notifyStatus('reconnecting');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = async () => {
    if (closed) return;
    const authHeader = getAuthHeader();
    if (!authHeader) {
      notifyStatus('unauthorized');
      return;
    }

    abortController = new AbortController();
    notifyStatus('connecting');

    try {
      const response = await fetch(STREAM_URL, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'text/event-stream'
        },
        cache: 'no-store',
        signal: abortController.signal
      });

      if (response.status === 401) {
        clearStoredAuth();
        notifyStatus('unauthorized');
        return;
      }
      if (!response.ok || !response.body) {
        throw new Error(`realtime status ${response.status}`);
      }

      retryCount = 0;
      notifyStatus('connected');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // Read text/event-stream blocks and emit parsed events.
      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { complete, tail } = normalizeBlocks(buffer);
        buffer = tail;

        complete.forEach((block) => {
          const parsed = parseBlock(block);
          if (!parsed) return;
          if (parsed.event === 'change' && typeof onChange === 'function') {
            onChange(parsed.payload || {});
          }
        });
      }

      if (!closed) {
        scheduleReconnect();
      }
    } catch (error) {
      if (closed || error?.name === 'AbortError') return;
      scheduleReconnect();
    }
  };

  connect();

  return () => {
    closed = true;
    notifyStatus('disconnected');
    cleanup();
  };
};

