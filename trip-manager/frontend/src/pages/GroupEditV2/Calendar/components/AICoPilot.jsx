import React, { useState } from 'react';

const AICoPilot = ({
  onAutoPlan,
  onOptimizeRoute,
  onCheckConflicts,
  onClearPlan,
  onSend
}) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const message = input.trim();
    if (!message) return;
    onSend?.(message);
    setInput('');
  };

  return (
    <>
      <div className="magic-actions">
        <button className="btn-magic" onClick={onAutoPlan}>自动填满</button>
        <button className="btn-magic" onClick={onOptimizeRoute}>优化路线</button>
        <button className="btn-magic" onClick={onCheckConflicts}>检查冲突</button>
        <button className="btn-magic" onClick={onClearPlan}>清空重排</button>
      </div>

      <div className="ai-chat-area">
        <div className="chat-msg ai">
          你好！我可以帮你检查冲突、优化路线或自动补齐空档。
          <div style={{ marginTop: 8 }}>
            <span className="chat-suggestion">帮我排满周三</span>
            <span className="chat-suggestion">优先安排景点</span>
          </div>
        </div>
        <div className="chat-msg user">把下午的空档补齐，优先室内活动。</div>
        <div className="chat-msg ai">好的，我会尝试补齐并标注冲突。</div>
      </div>

      <div className="ai-input-area">
        <textarea
          className="ai-input"
          rows="2"
          placeholder="输入指令，例如：周四上午安排科技馆"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        ></textarea>
        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <button
            className="btn-magic"
            style={{ background: 'var(--accent)', color: 'white', border: 'none', width: 'auto', padding: '4px 12px' }}
            onClick={handleSend}
          >
            发送
          </button>
        </div>
      </div>
    </>
  );
};

export default AICoPilot;

