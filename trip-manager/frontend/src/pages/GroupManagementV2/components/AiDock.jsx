import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../services/api';

const MEMBER_INTENT_REGEX = /(团员|成员|名单)/;
const MEMBER_COVER_REGEX = /(覆盖|重置|清空)/;

const formatInjectSummary = (data = {}) => {
  const confidence = Number(data.confidence);
  const changes = data.changes && typeof data.changes === 'object' ? data.changes : {};
  const details = [
    Number.isFinite(confidence) ? `置信度 ${confidence.toFixed(2)}` : null,
    Number.isFinite(changes.mealsUpdated) ? `餐饮 ${changes.mealsUpdated}` : null,
    Number.isFinite(changes.transfersUpdated) ? `接送 ${changes.transfersUpdated}` : null,
    Number.isFinite(changes.schedulesReplaced)
      ? `日程 ${changes.schedulesReplaced}`
      : (Number.isFinite(changes.otherSchedulesReplaced) ? `其他日程 ${changes.otherSchedulesReplaced}` : null)
  ].filter(Boolean);

  return details.length > 0
    ? `注入成功：${details.join('，')}`
    : '注入成功。';
};

const formatMembersSummary = (data = {}) => {
  const inserted = Number(data.inserted);
  const updated = Number(data.updated);
  const total = Number(data.total);
  const mode = data.mode || 'append';

  const details = [
    Number.isFinite(inserted) ? `新增 ${inserted}` : null,
    Number.isFinite(updated) ? `更新 ${updated}` : null,
    Number.isFinite(total) ? `当前总数 ${total}` : null
  ].filter(Boolean);

  return `成员写入成功（${mode}）：${details.join('，') || '已处理。'}`;
};

const formatConflictSummary = (data = {}) => {
  const base = data.message || data.error || '发生冲突，请重试。';
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  if (candidates.length === 0) return base;
  const names = candidates.slice(0, 5).map((item) => item?.name || `#${item?.id}`).filter(Boolean);
  return `${base} 候选团组：${names.join('、')}`;
};

const buildClarificationSummary = (data = {}) => {
  const questions = Array.isArray(data.questions) ? data.questions.filter(Boolean) : [];
  if (questions.length === 0) {
    return '需要补充信息，请补充后重试。';
  }

  return `需要补充信息：\n${questions.map((q) => `- ${q}`).join('\n')}\n请补充后再发送。`;
};

const AiDock = ({ open, onToggle, activeGroup, activeTabLabel }) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState(() => ([
    {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      text: '输入自然语言后我会写入食行卡片/日程；若包含“团员/成员/名单”则写入成员。'
    }
  ]));

  const bodyRef = useRef(null);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, open]);

  const contextText = useMemo(() => {
    const groupName = activeGroup?.name || '未选择团组';
    return `${groupName} · ${activeTabLabel || '未知标签页'}`;
  }, [activeGroup, activeTabLabel]);

  const pushMessage = (role, text) => {
    setMessages((prev) => ([
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        text: String(text || '')
      }
    ]));
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    pushMessage('user', text);
    setInput('');

    if (!activeGroup?.id) {
      pushMessage('assistant', '请先在左侧选择团组，再发送指令。');
      return;
    }

    const isMembersIntent = MEMBER_INTENT_REGEX.test(text);
    const endpoint = isMembersIntent ? '/agent/members/upsert' : '/agent/inject-one-shot';
    const payload = isMembersIntent
      ? {
        groupId: activeGroup.id,
        mode: MEMBER_COVER_REGEX.test(text) ? 'cover' : 'append',
        text
      }
      : {
        groupId: activeGroup.id,
        mode: 'cover',
        text
      };

    setSending(true);
    try {
      const response = await api.post(endpoint, payload);
      const data = response?.data || {};
      if (isMembersIntent) {
        pushMessage('assistant', formatMembersSummary(data));
      } else {
        pushMessage('assistant', formatInjectSummary(data));
      }
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data || {};

      if (status === 422 && data.needsClarification) {
        pushMessage('assistant', buildClarificationSummary(data));
      } else if (status === 409) {
        pushMessage('assistant', formatConflictSummary(data));
      } else {
        pushMessage('assistant', data.message || data.error || '请求失败，请稍后重试。');
      }
    } finally {
      setSending(false);
    }
  };

  const onInputKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        type="button"
        className={`ai-dock-fab ${open ? 'open' : ''}`}
        onClick={onToggle}
      >
        {open ? '收起 AI' : 'AI 助手'}
      </button>

      <aside className={`ai-dock-panel ${open ? 'open' : ''}`}>
        <div className="ai-dock-header">
          <div className="ai-dock-title">智能助手</div>
          <div className="ai-dock-context">{contextText}</div>
        </div>

        <div className="ai-dock-messages" ref={bodyRef}>
          {messages.map((item) => (
            <div key={item.id} className={`ai-dock-msg ${item.role === 'user' ? 'user' : 'assistant'}`}>
              <pre>{item.text}</pre>
            </div>
          ))}
        </div>

        <div className="ai-dock-input">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="例如：第二天下午去立法会参观；或：成员名单 张三 男 12 13800000000"
            disabled={sending}
          />
          <button type="button" onClick={handleSend} disabled={sending || !input.trim()}>
            {sending ? '发送中...' : '发送'}
          </button>
        </div>
      </aside>
    </>
  );
};

export default AiDock;
