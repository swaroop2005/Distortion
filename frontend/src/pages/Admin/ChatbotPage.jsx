import { useState, useEffect } from 'react';
import { getUnanswered, learnFaq } from '../../services/api';
import { LoadingState, ErrorState } from './AdminDashboard';

export default function ChatbotPage() {
  const [unanswered, setUnanswered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ question: '', answer: '', source: 'Admin' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  const load = () => {
    setLoading(true);
    getUnanswered(100)
      .then(r => setUnanswered(r.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const prefill = (query) => setForm(f => ({ ...f, question: query }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) return;
    setSaving(true);
    try {
      const r = await learnFaq(form.question.trim(), form.answer.trim(), form.source.trim() || 'Admin');
      setSaved(r.entry?.id || 'saved');
      setForm({ question: '', answer: '', source: 'Admin' });
      setTimeout(() => setSaved(null), 3000);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState msg={error} />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Chatbot Learning</h1>
        <p className="text-sm text-gray-500">Review unanswered queries and teach the bot new answers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teach form */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-extrabold text-gray-900 mb-4">Add Answer</h3>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Question</label>
              <input
                value={form.question}
                onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                placeholder="e.g. can i donate if i have thalassemia trait"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Answer</label>
              <textarea
                value={form.answer}
                onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
                placeholder="Clear, factual answer — no medical advice beyond known guidelines"
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Source</label>
              <input
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                placeholder="e.g. NHS Give Blood / Blood Warriors"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-sm font-bold transition-colors"
            >
              {saving ? 'Saving…' : 'Save to Bot'}
            </button>
            {saved && (
              <p className="text-xs text-emerald-600 font-bold text-center">Saved — bot will use this answer immediately.</p>
            )}
          </form>
        </div>

        {/* Unanswered queries */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">Unanswered Queries</h3>
              <p className="text-xs text-gray-500 mt-0.5">Click a query to prefill the form</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{unanswered.length}</span>
              <button onClick={load} className="text-xs text-rose-600 font-bold hover:underline">Refresh</button>
            </div>
          </div>
          {unanswered.length === 0 ? (
            <p className="p-6 text-xs text-gray-400 text-center">No unanswered queries yet.</p>
          ) : (
            <div className="divide-y divide-gray-100 overflow-y-auto max-h-[420px]">
              {[...unanswered].reverse().map((item, i) => (
                <button
                  key={i}
                  onClick={() => prefill(item.query)}
                  className="w-full text-left px-5 py-3 hover:bg-rose-50 transition-colors group"
                >
                  <p className="text-xs font-bold text-gray-800 group-hover:text-rose-700 truncate">{item.query}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400 font-mono">{item.ts?.slice(0, 16).replace('T', ' ')}</span>
                    <span className={`text-[10px] font-bold px-1.5 rounded-full ${
                      item.role === 'donor' ? 'bg-blue-100 text-blue-600' :
                      item.role === 'patient' ? 'bg-purple-100 text-purple-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>{item.role}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
