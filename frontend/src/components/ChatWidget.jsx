import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/api';
import { Icon } from '../design';

export default function ChatWidget({ role = 'public', userId = null }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([
    { from: 'bot', text: "Blood Warriors assistant. Ask me about donation eligibility, your bridge, blood banks near you, thalassemia, or pre-donation questions (tired, cold, medication, nerves, etc.)." },
  ]);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages(m => [...m, { from: 'user', text }]);
    setSending(true);
    try {
      const res = await sendChatMessage(text, role, userId);
      setMessages(m => [...m, { from: 'bot', text: res.reply, sources: res.sources, intent: res.intent }]);
    } catch (e) {
      setMessages(m => [...m, { from: 'bot', text: `Sorry — ${e.message}`, error: true }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* FAB launcher */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open assistant"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          width: 52, height: 52, borderRadius: '50%',
          background: open ? 'var(--ink)' : 'var(--red-500)',
          color: '#fff', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(225,29,42,.35)', transition: 'all .2s',
        }}
      >
        <Icon name={open ? 'close' : 'chat_bubble'} size={22} fill color="#fff" />
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 199,
          width: 348, maxWidth: 'calc(100vw - 32px)',
          background: 'var(--surface)', borderRadius: 18,
          border: '1px solid var(--line)', boxShadow: '0 12px 40px rgba(0,0,0,.16)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          height: 440,
        }}>
          {/* Header */}
          <div style={{ padding: '14px 18px', background: 'var(--red-500)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,.15)', display: 'grid', placeItems: 'center' }}>
              <Icon name="water_drop" size={18} fill color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Blood Warriors Assistant</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', marginTop: 1 }}>
                {role !== 'public' ? `${role}${userId ? ` · ${userId}` : ''}` : 'general help'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '9px 13px', borderRadius: m.from === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                  fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  background: m.from === 'user' ? 'var(--red-500)' : m.error ? 'var(--red-50)' : 'var(--surface)',
                  color: m.from === 'user' ? '#fff' : m.error ? 'var(--red-700)' : 'var(--ink)',
                  border: m.from === 'user' ? 'none' : `1px solid ${m.error ? 'var(--red-100)' : 'var(--line)'}`,
                  boxShadow: 'var(--sh-sm)',
                }}>
                  {m.text}
                  {m.sources && m.sources.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 10.5, color: m.from === 'user' ? 'rgba(255,255,255,.6)' : 'var(--muted)' }}>
                      Source: {m.sources.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '9px 14px', borderRadius: '14px 14px 14px 3px', background: 'var(--surface)', border: '1px solid var(--line)', fontSize: 18, color: 'var(--muted)' }}>
                  <span style={{ animation: 'pulse-slow 1s infinite' }}>···</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, background: 'var(--surface)' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask a question…"
              style={{ flex: 1, padding: '9px 14px', borderRadius: 12, border: '1.5px solid var(--line)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', background: 'var(--bg)' }}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              style={{
                width: 38, height: 38, borderRadius: 10, border: 'none', cursor: sending ? 'wait' : 'pointer',
                background: input.trim() ? 'var(--red-500)' : 'var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s', flexShrink: 0,
              }}
            >
              <Icon name="send" size={17} fill color={input.trim() ? '#fff' : 'var(--muted)'} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
