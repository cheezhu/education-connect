'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const RELAY_PORT = parsePositiveInteger(process.env.C2_RELAY_PORT) || 18791;
const MAX_BODY_BYTES = parsePositiveInteger(process.env.C2_RELAY_MAX_BODY_BYTES) || 256 * 1024;
const REQUEST_TIMEOUT_MS = parsePositiveInteger(process.env.C2_RELAY_TIMEOUT_MS) || 90_000;
const OPENCLAW_RESPONSES_URL = process.env.C2_OPENCLAW_RESPONSES_URL || 'http://127.0.0.1:18789/v1/responses';
const OPENCLAW_CONFIG_PATH = process.env.C2_OPENCLAW_CONFIG_PATH || '/root/.openclaw/openclaw.json';
const OPENCLAW_AGENT_ID = process.env.C2_OPENCLAW_AGENT_ID || 'cheezhu5';

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function normalizeRemoteIp(address) {
  const text = String(address || '').trim();
  if (!text) return '';
  if (text.startsWith('::ffff:')) {
    return text.slice('::ffff:'.length);
  }
  return text;
}

function isPrivateIpv4(ip) {
  const octets = ip.split('.');
  if (octets.length !== 4) return false;

  const parts = octets.map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;

  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  const firstHextet = normalized.split(':')[0] || '';
  if (/^fe[89ab]/.test(firstHextet)) {
    return true;
  }

  return false;
}

function isPrivateSourceIp(address) {
  const ip = normalizeRemoteIp(address);
  if (!ip) return false;
  if (ip.includes(':')) return isPrivateIpv6(ip);
  return isPrivateIpv4(ip);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let finished = false;

    const fail = (error) => {
      if (finished) return;
      finished = true;
      reject(error);
    };

    req.on('data', (chunk) => {
      if (finished) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        fail({ statusCode: 413, message: `request body exceeds ${MAX_BODY_BYTES} bytes` });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (finished) return;
      finished = true;

      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject({ statusCode: 400, message: 'invalid JSON body' });
      }
    });

    req.on('error', (error) => {
      fail({ statusCode: 400, message: error.message || 'request stream error' });
    });
  });
}

function loadOpenClawToken() {
  const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8');
  const config = JSON.parse(raw);
  const token = config?.gateway?.auth?.token;
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('missing gateway.auth.token in OpenClaw config');
  }
  return token.trim();
}

function buildResponsesPayload(inputBody) {
  const groupId = parsePositiveInteger(inputBody?.groupId);
  const text = typeof inputBody?.text === 'string' ? inputBody.text.trim() : '';
  const activeTabLabel = typeof inputBody?.context?.activeTabLabel === 'string'
    ? inputBody.context.activeTabLabel.trim()
    : '';

  if (!groupId) {
    throw { statusCode: 400, message: 'groupId must be a positive integer' };
  }
  if (!text) {
    throw { statusCode: 400, message: 'text cannot be empty' };
  }

  const composedPrompt = [
    `Group ID: ${groupId}`,
    `Active Tab: ${activeTabLabel || 'unknown'}`,
    'User Request:',
    text
  ].join('\n');

  return {
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: composedPrompt
          }
        ]
      }
    ]
  };
}

function postJson(urlText, payload, headers) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(urlText);
    const transport = targetUrl.protocol === 'https:' ? https : http;
    const payloadText = JSON.stringify(payload);

    const req = transport.request({
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      method: 'POST',
      path: `${targetUrl.pathname}${targetUrl.search}`,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payloadText),
        ...headers
      },
      timeout: REQUEST_TIMEOUT_MS
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        let body = null;
        if (rawBody.trim()) {
          try {
            body = JSON.parse(rawBody);
          } catch (error) {
            body = null;
          }
        }
        resolve({
          statusCode: res.statusCode || 0,
          body,
          rawBody
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('upstream timeout'));
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(payloadText);
    req.end();
  });
}

function collectOutputTextParts(responseBody) {
  const parts = [];

  if (typeof responseBody?.output_text === 'string') {
    parts.push(responseBody.output_text);
  }

  const outputItems = Array.isArray(responseBody?.output) ? responseBody.output : [];
  for (const item of outputItems) {
    if (item?.type === 'output_text' && typeof item.text === 'string') {
      parts.push(item.text);
    }

    const contentItems = Array.isArray(item?.content) ? item.content : [];
    for (const content of contentItems) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text);
      }
    }
  }

  return parts.map((part) => String(part).trim()).filter(Boolean);
}

function firstNonEmptyString(values) {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return '';
}

function toRelayError(error) {
  if (!error || typeof error !== 'object') {
    return { statusCode: 500, message: 'internal relay error' };
  }
  const statusCode = parsePositiveInteger(error.statusCode) || 500;
  const message = typeof error.message === 'string' && error.message.trim()
    ? error.message.trim()
    : 'internal relay error';
  return { statusCode, message };
}

async function handleTurn(req, res) {
  let inputBody;
  try {
    inputBody = await readJsonBody(req);
  } catch (error) {
    const relayError = toRelayError(error);
    jsonResponse(res, relayError.statusCode, { error: relayError.message });
    return;
  }

  let responsesPayload;
  try {
    responsesPayload = buildResponsesPayload(inputBody);
  } catch (error) {
    const relayError = toRelayError(error);
    jsonResponse(res, relayError.statusCode, { error: relayError.message });
    return;
  }

  let token;
  try {
    token = loadOpenClawToken();
  } catch (error) {
    jsonResponse(res, 500, {
      error: 'failed to load OpenClaw token',
      message: error.message
    });
    return;
  }

  let upstream;
  try {
    upstream = await postJson(OPENCLAW_RESPONSES_URL, responsesPayload, {
      authorization: `Bearer ${token}`,
      'x-openclaw-agent-id': OPENCLAW_AGENT_ID
    });
  } catch (error) {
    jsonResponse(res, 502, {
      error: 'failed to call OpenClaw responses API',
      message: error.message
    });
    return;
  }

  if (upstream.statusCode >= 400) {
    const bodyMessage = firstNonEmptyString([
      upstream.body?.error?.message,
      upstream.body?.message,
      upstream.rawBody
    ]);
    jsonResponse(res, upstream.statusCode, {
      error: 'OpenClaw responses API returned an error',
      message: bodyMessage || 'unknown upstream error'
    });
    return;
  }

  const textParts = collectOutputTextParts(upstream.body);
  const replyText = textParts.join('\n\n') || firstNonEmptyString([upstream.rawBody]);
  jsonResponse(res, 200, { replyText });
}

const server = http.createServer(async (req, res) => {
  const remoteIp = normalizeRemoteIp(req.socket?.remoteAddress);
  if (!isPrivateSourceIp(remoteIp)) {
    jsonResponse(res, 403, { error: 'source ip is not allowed' });
    return;
  }

  const target = new URL(req.url || '/', 'http://localhost');

  if (req.method === 'GET' && target.pathname === '/healthz') {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && target.pathname === '/c2/turn') {
    await handleTurn(req, res);
    return;
  }

  if (target.pathname === '/c2/turn') {
    jsonResponse(res, 405, { error: 'method not allowed' });
    return;
  }

  jsonResponse(res, 404, { error: 'not found' });
});

server.listen(RELAY_PORT, () => {
  console.log(`[c2-relay] listening on :${RELAY_PORT}`);
  console.log(`[c2-relay] forwarding to ${OPENCLAW_RESPONSES_URL} (agent=${OPENCLAW_AGENT_ID})`);
});

