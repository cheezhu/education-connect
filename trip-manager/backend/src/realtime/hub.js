const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no'
};

const HEARTBEAT_INTERVAL_MS = 25000;

let clientSeq = 0;
const clients = new Map();

const safeJson = (value) => {
  try {
    return JSON.stringify(value ?? {});
  } catch (error) {
    return JSON.stringify({ error: 'serialize_failed' });
  }
};

const writeEvent = (res, event, payload) => {
  if (!res || res.writableEnded || res.destroyed) return false;
  const body = safeJson(payload);
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${body}\n\n`);
    return true;
  } catch (error) {
    return false;
  }
};

const removeClient = (clientId) => {
  const client = clients.get(clientId);
  if (!client) return;
  if (client.heartbeatTimer) {
    clearInterval(client.heartbeatTimer);
  }
  clients.delete(clientId);
  try {
    client.res.end();
  } catch (error) {
    // ignore socket close errors
  }
};

const openStream = (req, res) => {
  const clientId = `rt-${Date.now()}-${++clientSeq}`;
  res.writeHead(200, SSE_HEADERS);
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const heartbeatTimer = setInterval(() => {
    const ok = writeEvent(res, 'keepalive', { ts: Date.now() });
    if (!ok) {
      removeClient(clientId);
    }
  }, HEARTBEAT_INTERVAL_MS);

  const client = {
    id: clientId,
    user: req.user || req.auth?.user || null,
    res,
    heartbeatTimer
  };
  clients.set(clientId, client);

  writeEvent(res, 'connected', {
    clientId,
    ts: Date.now()
  });

  req.on('close', () => removeClient(clientId));
  req.on('aborted', () => removeClient(clientId));
};

const publishChange = (change = {}) => {
  const payload = {
    ...change,
    ts: Date.now()
  };
  clients.forEach((client, clientId) => {
    const ok = writeEvent(client.res, 'change', payload);
    if (!ok) {
      removeClient(clientId);
    }
  });
};

const getRealtimeStats = () => ({
  clients: clients.size
});

module.exports = {
  openStream,
  publishChange,
  getRealtimeStats
};
