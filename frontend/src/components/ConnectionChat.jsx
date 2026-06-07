import { useState, useEffect, useRef } from 'react';
import { getThread, postMessage } from '../services/api';

// Private message thread for an ACCEPTED connection. Both the patient and the
// donor use this; selfId is whichever party is viewing (so messages align and
// the backend's participant guard is satisfied).
export default function ConnectionChat({ connectionId, selfId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  const load = async () => {
    try {
      const res = await getThread(connectionId, selfId);
      setMessages(res.messages || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, selfId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    try {
      await postMessage(connectionId, selfId, text);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-extrabold text-gray-600">Private conversation</span>
        <button onClick={load} className="text-[11px] font-bold text-rose-600 hover:text-rose-700">Refresh</button>
      </div>
      <div ref={scrollRef} className="max-h-56 overflow-y-auto p-3 space-y-2 bg-white">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No messages yet — say hello.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender_id === String(selfId) ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-sm ${
                m.sender_id === String(selfId)
                  ? 'bg-rose-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              <p className={`text-[9px] mt-0.5 ${m.sender_id === String(selfId) ? 'text-rose-200' : 'text-gray-400'}`}>
                {m.sender_role}
              </p>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="px-3 py-1 text-[11px] text-rose-600">{error}</p>}
      <div className="p-2 border-t border-gray-100 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message…"
          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
        <button
          onClick={send}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
