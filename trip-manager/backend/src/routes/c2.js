const express = require('express');
const fs = require('fs');
const { request } = require('undici');

const router = express.Router();

const C2_RELAY_PORT = 18791;
const RELAY_TIMEOUT_MS = 90_000;

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const parseGatewayHex = (gatewayHex) => {
  if (typeof gatewayHex !== 'string' || !/^[0-9A-Fa-f]{8}$/.test(gatewayHex)) {
    return null;
  }

  const octets = gatewayHex.match(/../g);
  if (!octets) return null;

  const parsedOctets = octets.map((chunk) => Number.parseInt(chunk, 16));
  if (parsedOctets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }

  return parsedOctets.reverse().join('.');
};

const readDockerHostGateway = () => {
  try {
    const routeRaw = fs.readFileSync('/proc/net/route', 'utf8');
    const lines = routeRaw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      return null;
    }

    for (const line of lines.slice(1)) {
      const columns = line.split(/\s+/);
      if (columns.length < 4) continue;

      const destination = columns[1];
      const gatewayHex = columns[2];
      const flagsHex = columns[3];
      const flags = Number.parseInt(flagsHex, 16);
      if (destination !== '00000000' || !Number.isFinite(flags)) continue;
      if ((flags & 0x2) === 0) continue;

      const gateway = parseGatewayHex(gatewayHex);
      if (gateway) {
        return gateway;
      }
    }
  } catch (error) {
    return null;
  }

  return null;
};

const normalizeRelayBaseUrl = (value) => {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  if (!normalized) return null;
  return normalized;
};

const resolveRelayBaseUrl = () => {
  const configured = normalizeRelayBaseUrl(process.env.C2_RELAY_URL);
  if (configured) {
    return configured;
  }

  const gateway = readDockerHostGateway();
  if (!gateway) {
    return null;
  }

  return `http://${gateway}:${C2_RELAY_PORT}`;
};

const parseJsonText = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return null;
  }
};

router.post('/turn', async (req, res) => {
  const groupId = parsePositiveInteger(req.body?.groupId);
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const activeTabLabel = typeof req.body?.context?.activeTabLabel === 'string'
    ? req.body.context.activeTabLabel.trim()
    : '';

  if (!groupId) {
    return res.status(400).json({ error: 'groupId 必须是正整数' });
  }
  if (!text) {
    return res.status(400).json({ error: 'text 不能为空' });
  }

  const relayBaseUrl = resolveRelayBaseUrl();
  if (!relayBaseUrl) {
    return res.status(500).json({
      error: '无法解析 C2_RELAY_URL',
      message: '未设置 C2_RELAY_URL，且无法从 /proc/net/route 解析 Docker host gateway。'
    });
  }

  const relayUrl = `${relayBaseUrl}/c2/turn`;
  const relayPayload = {
    groupId,
    text,
    context: {
      activeTabLabel
    }
  };

  try {
    const upstream = await request(relayUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(relayPayload),
      headersTimeout: RELAY_TIMEOUT_MS,
      bodyTimeout: RELAY_TIMEOUT_MS
    });

    const rawBody = await upstream.body.text();
    const parsedBody = parseJsonText(rawBody);

    if (upstream.statusCode >= 400) {
      if (parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)) {
        return res.status(upstream.statusCode).json(parsedBody);
      }
      return res.status(upstream.statusCode).json({
        error: 'C2 relay 请求失败',
        message: rawBody || 'relay 返回空错误信息'
      });
    }

    if (parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)) {
      return res.status(200).json(parsedBody);
    }

    return res.status(200).json({
      replyText: typeof rawBody === 'string' ? rawBody : ''
    });
  } catch (error) {
    console.error('C2 relay 转发失败:', error);
    return res.status(502).json({
      error: 'C2 relay 不可用',
      message: error.message
    });
  }
});

module.exports = router;
