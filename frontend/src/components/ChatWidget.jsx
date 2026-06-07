import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/api';

// Floating assistant available on every page. Surfaces the grounded chatbot,
// wellness suggestions, FAQ and personal (eligibility / bridge / stock) answers.
// role + userId come from App so answers are role-aware and personal.
export default function ChatWidget({ role = 'public', userId = null }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: "Hi! I'm the Blood Warriors assistant. Ask me about donating, your eligibility, your bridge, blood availability, or thalassemia wellness tips.",
    },
  ]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((m) => [...m, { from: 'user', text }]);
    setSending(true);
    try {
      const res = await sendChatMessage(text, role, userId);
      setMessages((m) => [
        ...m,
        { from: 'bot', text: res.reply, sources: res.sources, intent: res.intent },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { from: 'bot', text: `Sorry — ${e.message}`, error: true }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg flex items-center justify-center text-2xl transition-colors"
        aria-label="Open assistant"
      >
        {open ? '×' : '💬'}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[22rem] max-w-[calc(100vw-2.5rem)] h-[28rem] bg-white rounded-2xl border border-gray-200 shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-rose-600 text-white">
            <p className="text-sm font-extrabold">Blood Warriors Assistant</p>
            <p className="text-[11px] text-rose-100">
              {role !== 'public' ? `${role}${userId ? ` · ${userId}` : ''}` : 'general help'}
            </p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                    m.from === 'user'
                      ? 'bg-rose-600 text-white rounded-br-sm'
                      : m.error
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 rounded-bl-sm'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.sources && m.sources.length > 0 && (
                    <p className="mt-1 text-[10px] text-gray-400">Source: {m.sources.join(', ')}</p>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl text-sm bg-white border border-gray-200 text-gray-400">…</div>
              </div>
            )}
          </div>

          <div className="p-2 border-t border-gray-100 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask a question…"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              onClick={send}
              disabled={sending}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-sm font-bold transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
