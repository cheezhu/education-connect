import React, { useMemo, useState } from 'react';

const defaultMessages = [
  {
    id: 'intro',
    role: 'ai',
    text: '你好！我是排程助手。我看您还有 3 个方案行程点未安排。',
    suggestions: ['帮我安排到周三', '先排海洋公园']
  },
  {
    id: 'user-demo',
    role: 'user',
    text: '帮我把周二下午的时间排满，优先户外活动。'
  },
  {
    id: 'ai-demo',
    role: 'ai',
    text: '好的，已为您在周二 14:00-17:00 安排了“华南植物园自然笔记”。'
  }
];

const AICoPilot = ({
  messages,
  suggestions,
  onSend,
  onAutoPlan,
  onOptimizeRoute,
  onCheckConflicts,
  onClearAndReplan,
  previewItems,
  blockedItems,
  onApplyPreview,
  onClearPreview,
  loading = false,
  summary
}) => {
  const [input, setInput] = useState('');
  const safePreviewItems = Array.isArray(previewItems) ? previewItems : [];
  const safeBlockedItems = Array.isArray(blockedItems) ? blockedItems : [];
  const hasPreview = safePreviewItems.length > 0 || safeBlockedItems.length > 0;
  const resolvedSummary = summary || {
    total: safePreviewItems.length + safeBlockedItems.length,
    planned: safePreviewItems.length,
    blocked: safeBlockedItems.length
  };

  const resolvedMessages = useMemo(() => {
    if (Array.isArray(messages) && messages.length > 0) return messages;
    return defaultMessages;
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSend?.(trimmed);
    setInput('');
  };

  return (
    <>
      <div className="magic-actions">
        <button className="btn-magic" onClick={onAutoPlan}>⚡ 自动填满</button>
        <button className="btn-magic" onClick={onOptimizeRoute}>🔄 优化路线</button>
        <button className="btn-magic" onClick={onCheckConflicts}>⚠️ 检查冲突</button>
        <button className="btn-magic" onClick={onClearAndReplan}>🧹 清空重排</button>
      </div>

      <div className="ai-chat-area">
        {resolvedMessages.map((msg) => (
          <div key={msg.id} className={`chat-msg ${msg.role === 'user' ? 'user' : 'ai'}`}>
            {msg.text}
            {msg.role === 'ai' && (msg.suggestions || suggestions) && (
              <div style={{ marginTop: 8 }}>
                {(msg.suggestions || suggestions || []).map((item) => (
                  <span
                    key={item}
                    className="chat-suggestion"
                    onClick={() => {
                      if (loading) return;
                      onSend?.(item);
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-msg ai">
            正在生成建议，请稍候...
          </div>
        )}
      </div>

      {hasPreview && (
        <div className="ai-preview-panel">
          <div className="ai-preview-header">
            <div className="ai-preview-title">AI 预览</div>
            <div className="ai-preview-meta">
              共 {resolvedSummary.total || 0} 条，拟安排 {resolvedSummary.planned || 0} 条
              {resolvedSummary.blocked ? `，未排入 ${resolvedSummary.blocked}` : ''}
            </div>
          </div>
          {safePreviewItems.length === 0 ? (
            <div className="ai-preview-empty">暂无可安排内容</div>
          ) : (
            <div className="ai-preview-list">
              {safePreviewItems.slice(0, 8).map((item, index) => (
                <div key={item.clientId || item.id || `${item.date}-${item.startTime}-${index}`} className="ai-preview-item">
                  <div className="ai-preview-main">
                    <div className="ai-preview-title">{item.title || item.label || '补充'}</div>
                    <div className="ai-preview-sub">
                      <span>{item.date}</span>
                      {item.startTime && item.endTime && (
                        <span> · {item.startTime}-{item.endTime}</span>
                      )}
                      {item.location && <span> · {item.location}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {safePreviewItems.length > 8 && (
            <div className="ai-preview-more">仅展示前 8 条</div>
          )}
          {safeBlockedItems.length > 0 && (
            <div className="ai-preview-blocked">
              未排入 {safeBlockedItems.length} 条
            </div>
          )}
          <div className="ai-preview-actions">
            <button
              className="btn-magic btn-primary"
              onClick={onApplyPreview}
              disabled={safePreviewItems.length === 0}
            >
              应用到日历
            </button>
            <button className="btn-magic" onClick={onClearPreview}>清空预览</button>
          </div>
        </div>
      )}

      <div className="ai-input-area">
        <textarea
          className="ai-input"
          rows={2}
          value={input}
          placeholder="输入指令，例如：周三上午空出来..."
          onChange={(event) => setInput(event.target.value)}
          disabled={loading}
        />
        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <button
            className="btn-magic"
            style={{ background: 'var(--accent)', color: 'white', border: 'none', width: 'auto', padding: '4px 12px' }}
            onClick={handleSend}
            disabled={loading}
          >
            {loading ? '生成中...' : '发送'}
          </button>
        </div>
      </div>
    </>
  );
};

export default AICoPilot;
