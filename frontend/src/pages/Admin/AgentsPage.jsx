import { useState, useEffect, useRef } from 'react';
import { getAgentEvents, getAgentRequests, getAgentLearning, triggerTransfusion } from '../../services/api';
import { Icon, Card, Btn, Badge, Eyebrow, Spinner, ErrBox } from '../../design';

const PHASE_CFG = {
  triage:          { color: '#1f5fa6', bg: '#e8f1fb' },
  outreach:        { color: '#1c7a52', bg: '#e2f3ea' },
  escalate:        { color: '#9e1420', bg: '#fbe3e4' },
  learn:           { color: '#6b3fa0', bg: '#ede8fb' },
  bridge_built:    { color: '#1f4d90', bg: '#dce8f8' },
  donor_contacted: { color: '#1a6b6b', bg: '#d8f0f0' },
  emergency:       { color: '#9e1420', bg: '#fbe3e4' },
};

function PhasePill({ type }) {
  const cfg = PHASE_CFG[type] || { color: '#6b6e76', bg: '#f0f0f3' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: cfg.color, background: cfg.bg, flexShrink: 0, whiteSpace: 'nowrap', fontFamily: 'var(--ff-mono)' }}>
      {type}
    </span>
  );
}

export default function AgentsPage() {
  const [events, setEvents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [learning, setLearning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [trigPid, setTrigPid] = useState('');
  const [triggering, setTriggering] = useState(false);
  const feedRef = useRef(null);

  const fetchAll = async () => {
    try {
      const [ev, req, learn] = await Promise.all([
        getAgentEvents(30), getAgentRequests(), getAgentLearning(),
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
    const t = setInterval(fetchAll, 5000);
    return () => clearInterval(t);
  }, [isPaused]);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [events]);

  const handleTrigger = async () => {
    if (!trigPid.trim()) return;
    setTriggering(true);
    try { await triggerTransfusion(trigPid.trim()); setTrigPid(''); fetchAll(); }
    catch (e) { alert(e.message); }
    finally { setTriggering(false); }
  };

  if (loading) return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (error) return <div style={{ padding: 28 }}><ErrBox msg={error} /></div>;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Eyebrow style={{ marginBottom: 4 }}>Autonomous Loop</Eyebrow>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.02em', color: 'var(--ink)', margin: 0 }}>Agent Activity</h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>Triage → outreach → escalate → learn</p>
        </div>

        {/* Trigger */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={trigPid}
            onChange={e => setTrigPid(e.target.value)}
            placeholder="Patient ID (PT-001)"
            onKeyDown={e => e.key === 'Enter' && handleTrigger()}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'var(--ff-mono)', fontWeight: 600, outline: 'none', width: 200 }}
          />
          <Btn size="sm" icon="play_arrow" onClick={handleTrigger} disabled={triggering || !trigPid.trim()}>
            {triggering ? 'Running…' : 'Trigger'}
          </Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Live event feed */}
        <Card pad={0} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 580 }}>
          {/* Feed header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.08)', background: '#16171c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: isPaused ? '#555' : '#22c55e', display: 'block', animation: isPaused ? 'none' : 'pulse-slow 2s infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e6ea' }}>Live Event Feed</span>
              <span style={{ fontSize: 11, color: '#555', fontFamily: 'var(--ff-mono)' }}>auto-refreshes 5s</span>
            </div>
            <button onClick={() => setIsPaused(p => !p)} style={{ padding: '4px 12px', borderRadius: 999, border: '1px solid #333', background: '#1e2028', color: '#9a9da4', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
          </div>

          {/* Events */}
          <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', background: '#111214', padding: '8px 0' }}>
            {events.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#555', fontSize: 13 }}>
                No events yet — trigger a cycle above
              </div>
            ) : events.map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,.04)', alignItems: 'flex-start' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: '#4a4e5a', paddingTop: 2, flexShrink: 0 }}>{ev.ts || ev.timestamp || ''}</span>
                <PhasePill type={ev.type || ev.phase || 'event'} />
                <span style={{ fontSize: 13, color: '#c8cad0', lineHeight: 1.4 }}>
                  {ev.detail || ev.msg || ev.message || JSON.stringify(ev)}
                </span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,.06)', background: '#16171c', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['triage', 'outreach', 'escalate', 'learn'].map(p => <PhasePill key={p} type={p} />)}
          </div>
        </Card>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Recent requests */}
          <Card pad={18}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Recent Requests</span>
              {requests.length > 0 && <Badge tone="blue">{requests.length}</Badge>}
            </div>
            {requests.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>No requests yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
                {requests.slice(0, 12).map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: 'var(--line-soft)' }}>
                    <div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--ff-mono)' }}>{(r.request_id || r.id || '').slice(0, 12)}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>{r.patient_id}</span>
                    </div>
                    <Badge tone={r.status === 'completed' ? 'green' : r.status === 'failed' ? 'red' : 'blue'} dot>
                      {r.status || 'active'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Failure learning */}
          {learning && (
            <Card pad={18}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>
                Failure Learning
              </div>
              {learning.patterns && learning.patterns.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {learning.patterns.map((p, i) => (
                    <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--red-50)', border: '1px solid var(--red-100)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red-700)' }}>{p.reason || p.label}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 8 }}>{p.count || p.frequency}×</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>No failure patterns yet</p>
              )}
              {learning.total_failures !== undefined && (
                <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--ff-mono)', padding: '8px 10px', background: 'var(--line-soft)', borderRadius: 8 }}>
                  {learning.total_failures} failures · {learning.success_rate || 'N/A'} success rate
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
