const express = require('express');
const fs = require('fs');
const { request } = require('undici');

const router = express.Router();

const C2_RELAY_PORT = 18791;
// relay -> OpenClaw can be slow for longer prompts; keep this comfortably above nginx/client.
const RELAY_TIMEOUT_MS = 180_000;

const LOCAL_AGENT_TIMEOUT_MS = 12_000;
const LOCAL_AGENT_PORT = (() => {
  const parsed = Number.parseInt(String(process.env.PORT || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3001;
})();

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const parseDayIndexFromLabel = (label) => {
  const text = normalizeText(label);
  if (!text) return null;

  const m1 = text.match(/第\s*(\d{1,3})\s*天/);
  if (m1) return parsePositiveInteger(m1[1]);

  const m2 = text.match(/\bDay\s*(\d{1,3})\b/i);
  if (m2) return parsePositiveInteger(m2[1]);

  const m3 = text.match(/\bD\s*(\d{1,3})\b/i);
  if (m3) return parsePositiveInteger(m3[1]);

  return null;
};

const parseDateFromLabel = (label) => {
  const text = normalizeText(label);
  if (!text) return '';
  const match = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : '';
};

const shouldFastWrite = (text) => {
  const value = normalizeText(text);
  if (!value) return false;

  const hasWriteVerb = /(写入|改成|改为|更新|设置|安排|调整|替换|覆盖|变更|修改)/.test(value);
  const hasArrow = /(→|->)/.test(value);
  const hasDomain = /(早餐|午餐|晚餐|餐|接送|活动|行程|安排|地点|集合|出发|入住|退房|交通)/.test(value);

  // “午餐在哪里吃？”这种问句不应触发直写。
  const looksLikeQuestion = /[?？]/.test(value) || /(怎么|如何|哪里|是什么|能不能|可不可以)/.test(value);

  return !looksLikeQuestion && hasDomain && (hasWriteVerb || hasArrow);
};

const callLocalAgentInjectOneShot = async (payload) => {
  const token = normalizeText(process.env.AGENT_TOOL_TOKEN);
  if (!token) {
    return { ok: false, error: 'missing AGENT_TOOL_TOKEN' };
  }

  const url = `http://127.0.0.1:${LOCAL_AGENT_PORT}/api/agent/inject-one-shot`;
  const upstream = await request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-agent-token': token
    },
    body: JSON.stringify(payload),
    headersTimeout: LOCAL_AGENT_TIMEOUT_MS,
    bodyTimeout: LOCAL_AGENT_TIMEOUT_MS
  });

  const rawBody = await upstream.body.text();
  const parsedBody = parseJsonText(rawBody);
  return {
    ok: upstream.statusCode >= 200 && upstream.statusCode < 300,
    statusCode: upstream.statusCode,
    rawBody,
    body: parsedBody
  };
};

const formatClarificationReply = (body) => {
  const questions = Array.isArray(body?.questions) ? body.questions : [];
  const lines = ['需要补充信息才能写入：'];
  questions.slice(0, 8).forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  return lines.join('\n');
};

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

  // Fast-path: for common "写入/改成" instructions, call local /api/agent/inject-one-shot
  // directly (no OpenClaw roundtrip) to keep writes snappy.
  if (shouldFastWrite(text)) {
    const dayIndex = parseDayIndexFromLabel(activeTabLabel);
    const date = parseDateFromLabel(activeTabLabel);
    const fastPayload = {
      groupId,
      mode: 'cover',
      text
    };
    if (dayIndex) fastPayload.dayIndex = dayIndex;
    if (date) fastPayload.date = date;

    try {
      const fast = await callLocalAgentInjectOneShot(fastPayload);

      // 200: already applied.
      if (fast.ok && fast.body && typeof fast.body === 'object') {
        const changes = fast.body.changes || {};
        const dateText = typeof fast.body.date === 'string' ? fast.body.date : '';
        const mealsUpdated = Number.isFinite(changes.mealsUpdated) ? changes.mealsUpdated : null;
        const transfersUpdated = Number.isFinite(changes.transfersUpdated) ? changes.transfersUpdated : null;
        const schedulesReplaced = Number.isFinite(changes.schedulesReplaced) ? changes.schedulesReplaced : null;

        const extra = [
          mealsUpdated !== null ? `餐饮${mealsUpdated}` : null,
          transfersUpdated !== null ? `接送${transfersUpdated}` : null,
          schedulesReplaced !== null ? `行程${schedulesReplaced}` : null
        ].filter(Boolean).join('，');

        return res.status(200).json({
          replyText: `OK（已写入${dateText ? `：${dateText}` : ''}${extra ? `；${extra}` : ''}）`,
          fastWrite: true,
          applied: true,
          details: fast.body
        });
      }

      // 422: needs clarification — do not fallback to OpenClaw automatically; return the questions.
      if (fast.statusCode === 422 && fast.body && typeof fast.body === 'object') {
        return res.status(200).json({
          replyText: formatClarificationReply(fast.body),
          fastWrite: true,
          needsClarification: true,
          details: fast.body
        });
      }

      // 409 lock conflict etc.
      if (fast.statusCode === 409 && fast.body && typeof fast.body === 'object') {
        const message = normalizeText(fast.body.message) || '编辑锁冲突，请稍后再试';
        return res.status(200).json({
          replyText: message,
          fastWrite: true,
          error: fast.body.error || 'edit_lock_conflict',
          details: fast.body
        });
      }

      // Otherwise fallback to OpenClaw relay.
    } catch (error) {
      console.error('Fast write failed:', error);
      // fallback below
    }
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
