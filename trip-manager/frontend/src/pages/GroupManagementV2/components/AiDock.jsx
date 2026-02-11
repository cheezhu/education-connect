import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../services/api';

const AiDock = ({ open, onToggle, activeGroup, activeTabLabel }) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState(() => ([
    {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      text: '请输入需求，我会通过 C2 relay 调用 AI 并返回文本回复。'
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

    setSending(true);
    try {
      const response = await api.post('/c2/turn', {
        groupId: activeGroup.id,
        text,
        context: {
          activeTabLabel: activeTabLabel || ''
        }
      });

      const data = response?.data || {};
      const replyText = typeof data.replyText === 'string' ? data.replyText.trim() : '';
      pushMessage('assistant', replyText || '助手暂未返回文本。');
    } catch (error) {
      const data = error?.response?.data || {};
      pushMessage('assistant', data.message || data.error || '请求失败，请稍后重试。');
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
