import { useState, useEffect, useRef } from 'react';
import { getAgentEvents, getAgentRequests, getAgentLearning, triggerTransfusion } from '../../services/api';
import { LoadingState, ErrorState } from './AdminDashboard';

const PhaseStyle = {
  triage: 'bg-blue-100 text-blue-800',
  outreach: 'bg-emerald-100 text-emerald-800',
  escalate: 'bg-rose-100 text-rose-800',
  learn: 'bg-purple-100 text-purple-800',
  bridge_built: 'bg-indigo-100 text-indigo-800',
  donor_contacted: 'bg-teal-100 text-teal-800',
  emergency: 'bg-red-100 text-red-800',
};

export default function AgentsPage() {
  const [events, setEvents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [learning, setLearning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [triggerPatientId, setTriggerPatientId] = useState('');
  const feedRef = useRef(null);

  const fetchAll = async () => {
    try {
      const [ev, req, learn] = await Promise.all([
        getAgentEvents(30),
        getAgentRequests(),
        getAgentLearning(),
      ]);
      setEvents(ev.events || []);
      setRequests(req.requests || []);
      setLearning(learn);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const handleTrigger = async () => {
    if (!triggerPatientId.trim()) return;
    try {
      await triggerTransfusion(triggerPatientId.trim());
      setTriggerPatientId('');
      fetchAll();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState msg={error} />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Agent Activity</h1>
          <p className="text-sm text-gray-500">Autonomous triage → outreach → learn loop</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={triggerPatientId}
            onChange={e => setTriggerPatientId(e.target.value)}
            placeholder="Patient ID (e.g. PT-001)"
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 w-48"
            onKeyDown={e => e.key === 'Enter' && handleTrigger()}
          />
          <button onClick={handleTrigger} className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors">
            Trigger Cycle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event Feed */}
        <div className="lg:col-span-2 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col" style={{ maxHeight: '600px' }}>
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-gray-200 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full bg-emerald-400 ${!isPaused ? 'animate-pulse' : ''}`} />
                Live Event Feed
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Auto-refreshes every 5s</p>
            </div>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="px-3 py-1.5 rounded-full border border-gray-700 bg-gray-800 text-gray-300 text-xs font-semibold hover:bg-gray-700 transition-colors"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          </div>
          <div ref={feedRef} className="overflow-y-auto flex-1 p-2">
            {events.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No events yet. Trigger a cycle to start.</p>
            ) : events.map((ev, i) => (
              <div key={i} className="flex gap-3 p-2 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <span className="font-mono text-xs text-gray-500 pt-0.5 shrink-0">{ev.ts || ev.timestamp || ''}</span>
                <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full h-fit shrink-0 tracking-wider ${
                  PhaseStyle[ev.type] || PhaseStyle[ev.phase] || 'bg-gray-700 text-gray-300'
                }`}>
                  {(ev.type || ev.phase || 'event').toUpperCase()}
                </span>
                <span className="text-sm text-gray-300 leading-snug">
                  {ev.detail || ev.msg || ev.message || JSON.stringify(ev)}
                </span>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-gray-800 flex flex-wrap gap-2 bg-gray-900">
            {Object.entries(PhaseStyle).slice(0, 4).map(([phase, cls]) => (
              <span key={phase} className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
                {phase.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {/* Requests + Learning sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-extrabold text-gray-900 mb-3">Recent Requests</h3>
            {requests.length === 0 ? (
              <p className="text-xs text-gray-400">No requests yet</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {requests.slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                    <div>
                      <span className="text-xs font-bold text-gray-700 font-mono">{r.request_id || r.id}</span>
                      <span className="text-xs text-gray-400 ml-2">{r.patient_id}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      r.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {r.status || 'active'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {learning && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-extrabold text-gray-900 mb-3">Failure Learning</h3>
              {learning.patterns && learning.patterns.length > 0 ? (
                <div className="space-y-2">
                  {learning.patterns.map((p, i) => (
                    <div key={i} className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                      <span className="font-bold text-gray-700">{p.reason || p.label}:</span>{' '}
                      {p.count || p.frequency} occurrence{(p.count || p.frequency) !== 1 ? 's' : ''}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No failure patterns yet</p>
              )}
              {learning.total_failures !== undefined && (
                <p className="text-xs text-gray-500 mt-3 font-mono">
                  Total failures: {learning.total_failures} | Success rate: {learning.success_rate || 'N/A'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
