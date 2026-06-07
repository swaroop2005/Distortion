import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  getDashboard, getBridges, healBridge,
  getChurnAlerts, getUrgentAlerts,
  getAgentEvents, getAgentLearning,
  getRegionalSupply, getSupplyOverview,
} from '../../services/api';
import { Icon, Spinner, ErrBox, IntegrityBadge } from '../../design';
import BridgesPage from './BridgesPage';
import AgentsPage from './AgentsPage';
import SupplyPage from './SupplyPage';

/* ── palette / tokens — matches dashboard.html ─────────────── */
const C = {
  ink: '#16202c', soft: '#6b7a8d', faint: '#9aa5b2',
  line: '#e3e9f0', bg: '#eef2f7', surface: '#fff',
  red: '#e63148', redSoft: '#fef2f2', redText: '#c53030',
  green: '#17b26a', greenSoft: '#e2f3ea', greenText: '#1c7a52',
  amber: '#f5a524', amberSoft: '#fffbeb',
  blue: '#1f5fa6', blueSoft: '#e8f1fb',
  purple: '#5b3fa8', purpleSoft: '#f2eeff',
  navy: '#0a2540', navy2: '#13355c',
};

/* ── micro helpers ─────────────────────────────────────────── */
function Ic({ n, z = 18, fill, col, style }) {
  return (
    <span
      className={'ms' + (fill ? ' fill' : '')}
      style={{ fontSize: z, color: col, fontFamily: 'Material Symbols Rounded', lineHeight: 1, display: 'inline-flex', userSelect: 'none', ...style }}
    >
      {n}
    </span>
  );
}

function Bdg({ children, tone = 'neutral', dot, style }) {
  const m = {
    neutral: { c: C.soft, bg: '#f0f0f3' },
    green: { c: C.greenText, bg: C.greenSoft },
    amber: { c: C.amber, bg: C.amberSoft },
    red: { c: C.redText, bg: C.redSoft },
    blue: { c: C.blue, bg: C.blueSoft },
    purple: { c: C.purple, bg: C.purpleSoft },
  };
  const s = m[tone] || m.neutral;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, color: s.c, background: s.bg, ...style }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 99, background: s.c }} />}
      {children}
    </span>
  );
}

function IntBdg({ v }) {
  const normalized = (v || '').toLowerCase().replace(/[\s-]/g, '');
  if (normalized === 'full') return <Bdg tone="green"><Ic n="check_circle" z={12} fill />&nbsp;Full</Bdg>;
  if (normalized === 'atrisk') return <Bdg tone="amber"><Ic n="warning" z={12} fill />&nbsp;At risk</Bdg>;
  return <Bdg tone="red"><Ic n="cancel" z={12} fill />&nbsp;Broken</Bdg>;
}

function Ava({ nm, sz = 32 }) {
  const ini = (nm || '?').split(' ').map(w => w[0]).slice(0, 2).join('');
  const hue = [...(nm || '')].reduce((h, c) => Math.abs(c.charCodeAt(0) + ((h << 5) - h)), 0) % 360;
  return (
    <div style={{ width: sz, height: sz, borderRadius: 99, display: 'grid', placeItems: 'center', background: `oklch(0.9 0.05 ${hue})`, color: `oklch(0.38 0.09 ${hue})`, fontWeight: 700, fontSize: sz * 0.38, flexShrink: 0 }}>
      {ini}
    </div>
  );
}

function ScoreBar({ v, col }) {
  const c = col || (v > 0.6 ? C.red : v > 0.35 ? C.amber : C.green);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: C.line, overflow: 'hidden', minWidth: 60 }}>
        <div style={{ width: (v * 100) + '%', height: '100%', background: c, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: c, minWidth: 30, fontVariantNumeric: 'tabular-nums' }}>{Math.round(v * 100)}%</span>
    </div>
  );
}

const NAV = [
  { path: '/admin', label: 'Dashboard', icon: 'space_dashboard', exact: true },
  { path: '/admin/bridges', label: 'Bridges', icon: 'hub' },
  { path: '/admin/agents', label: 'Agent Log', icon: 'terminal', live: true },
  { path: '/admin/supply', label: 'Supply', icon: 'local_hospital' },
];

/* ── sidebar ───────────────────────────────────────────────── */
function Sidebar({ onLogout }) {
  const location = useLocation();
  return (
    <nav style={{ width: 220, minWidth: 220, background: C.navy, display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid #163660' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="#ff5269">
            <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/>
          </svg>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.03em', color: '#fff' }}>Thal<span style={{ color: C.red }}>Net</span></div>
            <div style={{ fontSize: 10.5, color: '#aebfd4', fontWeight: 600, letterSpacing: '.04em', marginTop: 2 }}>COMMAND CENTER</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(item => {
          const active = item.exact
            ? (location.pathname === '/admin' || location.pathname === '/admin/')
            : location.pathname.startsWith(item.path);
          return (
            <Link key={item.path} to={item.path} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9,
              background: active ? C.red : 'transparent', color: active ? '#fff' : '#aebfd4',
              fontWeight: active ? 700 : 500, fontSize: 13.5, textDecoration: 'none', transition: 'all .15s',
            }}>
              <Ic n={item.icon} z={18} fill={active} col={active ? '#fff' : '#6b8bad'} />
              {item.label}
              {item.live && <span style={{ marginLeft: 'auto', background: 'rgba(127,211,168,.15)', color: '#7fd3a8', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>live</span>}
            </Link>
          );
        })}
      </div>
      <div style={{ padding: '12px 14px', borderTop: '1px solid #163660' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 99, background: '#163660', display: 'grid', placeItems: 'center' }}>
            <Ic n="person" z={16} col="#aebfd4" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#e2eaf4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Coordinator</div>
            <div style={{ fontSize: 11, color: '#6b8bad' }}>Blood Warriors</div>
          </div>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Ic n="logout" z={16} col="#6b8bad" />
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ── topbar — navy gradient matching dashboard.html header ──── */
function TopBar({ page }) {
  const now = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const labels = {
    dashboard: { title: 'Blood Supply Command Center', sub: 'Autonomous coordination · Hyderabad Region' },
    bridges: { title: 'Bridge Management', sub: 'Auto-Bridge Builder · 8→1 donor coverage' },
    agents: { title: 'Agent Activity Log', sub: 'Triage → Outreach → Escalate → Learn' },
    supply: { title: 'Supply Intelligence', sub: 'National blood stock · e-RaktKosh data' },
  };
  const lbl = labels[page] || labels.dashboard;
  return (
    <div style={{
      background: `linear-gradient(100deg, ${C.navy}, ${C.navy2})`,
      color: '#fff', padding: '14px 26px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 2px 14px rgba(10,37,64,.22)',
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#ff5269" style={{ flexShrink: 0 }}>
        <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/>
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.02em' }}>{lbl.title}</div>
        <div style={{ fontSize: 12, color: '#aebfd4', marginTop: 2 }}>{lbl.sub} · {now}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#7fd3a8' }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: '#7fd3a8', animation: 'pulse-slow 1.6s infinite', flexShrink: 0 }} />
        Agents live
      </div>
    </div>
  );
}

/* ── stats row — dashboard.html .kpi style ─────────────────── */
function KpiCard({ v, l, t, tone }) {
  const valColor = tone === 'alert' ? C.red : tone === 'warn' ? C.amber : tone === 'good' ? C.green : C.ink;
  return (
    <div style={{ background: C.surface, borderRadius: 14, padding: '15px 17px', border: `1px solid ${C.line}`, boxShadow: '0 1px 3px rgba(16,32,44,.05)' }}>
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: valColor }}>{v}</div>
      <div style={{ fontSize: 11.5, color: C.soft, marginTop: 5, textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600 }}>{l}</div>
      <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{t}</div>
    </div>
  );
}

function StatsRow({ data, bridges, churn, urgent }) {
  if (!data) return null;
  const h = data.bridge_health || {};
  const atRisk = h.at_risk || h['at-risk'] || 0;
  const broken = h.broken || 0;
  const highChurn = churn?.donors?.filter(d => d.churn_risk > 0.6).length || data.high_churn_count || 0;
  const urgentCount = urgent?.count || 0;
  const eligible = data.eligible_donors || 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 18 }}>
      <KpiCard v={(data.total_patients || 0).toLocaleString('en-IN')} l="Patients" t="in network" tone="good" />
      <KpiCard v={(data.total_donors || 0).toLocaleString('en-IN')} l="Donors enrolled" t={`${eligible.toLocaleString('en-IN')} eligible now`} tone="good" />
      <KpiCard v={broken} l="Broken bridges" t={`${atRisk} at-risk`} tone={broken > 0 ? 'alert' : atRisk > 0 ? 'warn' : 'good'} />
      <KpiCard v={urgentCount} l="Urgent transfusions" t="next 7 days" tone={urgentCount > 0 ? 'alert' : 'good'} />
      <KpiCard v={highChurn} l="High churn risk" t="donors to contact" tone={highChurn > 3 ? 'alert' : highChurn > 0 ? 'warn' : 'good'} />
    </div>
  );
}

/* ── bridge board ──────────────────────────────────────────── */
function BridgeBoard({ bridges = [], full = false, onHeal }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [healing, setHealing] = useState(null);

  const rows = bridges.filter(b => {
    const integ = (b.integrity || '').toLowerCase().replace(/[\s-]/g, '');
    const matchFilter = filter === 'all' || integ === filter.replace('-', '');
    const matchSearch = !search || b.bridge_id?.includes(search) || b.patient_id?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });
  const show = full ? rows : rows.slice(0, 10);

  const handleHeal = async (bridgeId) => {
    setHealing(bridgeId);
    try { await healBridge(bridgeId); if (onHeal) onHeal(); }
    catch (_) {}
    finally { setHealing(null); }
  };

  const integ_norm = v => (v || '').toLowerCase().replace(/[\s-]/g, '');

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,30,.04)' }}>
      <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '.5px', textTransform: 'uppercase', color: C.navy }}>Bridge Health Board</div>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>Every patient bridge · updated live</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'full', 'at-risk', 'broken'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 13px', borderRadius: 99, border: `1px solid ${filter === f ? 'transparent' : C.line}`, background: filter === f ? C.red : '#fff', color: filter === f ? '#fff' : C.soft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>{f}</button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bridge…" style={{ padding: '7px 12px', borderRadius: 99, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', background: '#f6f6f8', width: 160, outline: 'none' }} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: '#f6f6f8' }}>
              {['Patient ID', 'Group', 'Bridge', 'Integrity', 'Coverage', 'Alarms', 'Action'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: C.faint, fontSize: 12, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.line}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {show.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: C.faint, fontSize: 13 }}>No bridges yet — trigger a transfusion cycle to build one.</td></tr>
            ) : show.map(b => {
              const ig = integ_norm(b.integrity);
              const rowBg = ig === 'broken' ? '#fff9f9' : ig === 'atrisk' ? '#fffbf3' : '#fff';
              const dc = b.donor_count || (b.donors?.length || 0);
              const target = b.target_size || 8;
              const pct = Math.round((dc / target) * 100);
              return (
                <tr key={b.bridge_id} style={{ background: rowBg, borderBottom: `1px solid #f0f0f3` }}>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 700, color: C.soft }}>{b.bridge_id}</div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{b.patient_id?.slice(0, 12)}…</div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontFamily: 'var(--ff-mono)', fontWeight: 700, fontSize: 14, color: C.ink }}>{b.blood_group || '—'}</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ height: 6, width: 70, borderRadius: 99, background: C.line, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: ig === 'broken' ? C.red : ig === 'atrisk' ? C.amber : C.green, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.soft, fontVariantNumeric: 'tabular-nums' }}>{dc}/{target}</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px' }}><IntBdg v={b.integrity} /></td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, fontWeight: 600, color: C.soft }}>{b.coverage_days || 0}d</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {b.alarms?.length > 0
                      ? <Bdg tone="amber">{b.alarms.length} alarm{b.alarms.length > 1 ? 's' : ''}</Bdg>
                      : <span style={{ color: C.faint, fontSize: 12 }}>clear</span>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {ig !== 'full' && (
                        <button onClick={() => handleHeal(b.bridge_id)} disabled={healing === b.bridge_id} style={{ padding: '6px 12px', borderRadius: 99, background: C.red, color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: healing === b.bridge_id ? 0.6 : 1 }}>
                          {healing === b.bridge_id ? '…' : 'Heal'}
                        </button>
                      )}
                      <Link to="/admin/bridges" style={{ padding: '6px 12px', borderRadius: 99, background: '#f0f0f3', color: C.soft, border: 'none', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block' }}>View</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!full && rows.length > 10 && (
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.line}`, textAlign: 'center' }}>
          <Link to="/admin/bridges" style={{ fontSize: 13, color: C.red, fontWeight: 700, textDecoration: 'none' }}>View all {rows.length} bridges →</Link>
        </div>
      )}
    </div>
  );
}

/* ── agent feed ────────────────────────────────────────────── */
const PHASE_STYLE = {
  TRIAGE: { bg: '#e8f1fb', col: '#1f5fa6' },
  OUTREACH: { bg: '#e2f3ea', col: '#1c7a52' },
  ESCALATE: { bg: '#fbe3e4', col: '#9e1420' },
  LEARN: { bg: '#f2eeff', col: '#5b3fa8' },
};

function AgentFeed({ events = [] }) {
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current && !paused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, paused]);

  return (
    <div style={{ background: '#16171c', border: '1px solid #24262e', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #24262e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#c3c6cf', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: '#7fd3a8', animation: paused ? 'none' : 'pulse-slow 1.6s infinite' }} />
            Agent Activity · Live
          </div>
          <div style={{ fontSize: 11.5, color: '#5a5d68', marginTop: 2 }}>Autonomous loop — visible to coordinators</div>
        </div>
        <button onClick={() => setPaused(p => !p)} style={{ padding: '5px 12px', borderRadius: 99, border: '1px solid #24262e', background: '#23252c', color: '#7a7d87', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
      <div ref={scrollRef} style={{ padding: '12px 0', maxHeight: 340, overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#5a5d68', fontSize: 13 }}>
            No events yet. Go to <Link to="/admin/agents" style={{ color: '#7fd3a8', textDecoration: 'none', fontWeight: 700 }}>Agent Log</Link> to trigger a cycle.
          </div>
        ) : events.map((ev, i) => {
          const ps = PHASE_STYLE[ev.phase] || PHASE_STYLE.TRIAGE;
          return (
            <div key={i} style={{ display: 'flex', gap: 11, padding: '8px 16px', borderBottom: '1px solid #1c1e25' }}>
              <span style={{ fontSize: 11.5, color: '#5a5d68', flexShrink: 0, paddingTop: 1, fontFamily: 'var(--ff-mono)', minWidth: 60 }}>{ev.ts || ev.timestamp || ''}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, height: 'fit-content', flexShrink: 0, letterSpacing: '.04em', fontFamily: 'var(--ff-mono)', background: ps.bg, color: ps.col }}>{ev.phase || 'INFO'}</span>
              <span style={{ fontSize: 12.5, color: ev.ok === false ? '#e8a14c' : '#c3c6cf', lineHeight: 1.4 }}>{ev.msg || ev.message || String(ev)}</span>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid #24262e', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(PHASE_STYLE).map(([phase, s]) => (
          <span key={phase} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, letterSpacing: '.04em', fontFamily: 'var(--ff-mono)', background: s.bg, color: s.col }}>{phase}</span>
        ))}
        <Link to="/admin/agents" style={{ marginLeft: 'auto', fontSize: 11.5, color: '#5a5d68', textDecoration: 'none', fontFamily: 'var(--ff-mono)' }}>Full log →</Link>
      </div>
    </div>
  );
}

/* ── churn alerts ──────────────────────────────────────────── */
function ChurnAlerts({ donors = [] }) {
  const [done, setDone] = useState({});
  const top = donors.slice(0, 6);

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,30,.04)' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-.02em' }}>Donor Churn Alerts</div>
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>ML-flagged · AI recommends next action</div>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
        {top.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: C.faint, fontSize: 13 }}>No high-risk donors flagged.</div>
        ) : top.map(d => {
          const isDone = done[d.user_id];
          const actionMap = { contact: { l: 'Contact now', bg: C.red, col: '#fff' }, wait: { l: 'Wait', bg: '#f0f0f3', col: C.soft }, appreciate: { l: 'Send thanks', bg: C.green, col: '#fff' }, dnd: { l: 'Do not disturb', bg: '#f0f0f3', col: C.faint } };
          const act = actionMap[d.action] || actionMap.wait;
          return (
            <div key={d.user_id} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: '13px 14px', opacity: isDone ? 0.5 : 1, transition: 'opacity .3s', background: isDone ? '#f6f6f8' : '#fff' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Ava nm={d.user_id} sz={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{d.blood_group || 'Unknown'} donor</span>
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: C.faint }}>{d.user_id?.slice(0, 8)}…</span>
                  </div>
                  <ScoreBar v={d.churn_risk || 0} />
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11.5, color: C.faint }}>
                    <span>Churn: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round((d.churn_risk || 0) * 100)}%</b></span>
                    <span>Response: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round((d.responsiveness || 0) * 100)}%</b></span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: C.faint }}>✦ Recommended: {act.l}</span>
                {isDone
                  ? <Bdg tone="green">Done</Bdg>
                  : <button onClick={() => setDone(p => ({ ...p, [d.user_id]: true }))} style={{ padding: '7px 14px', borderRadius: 99, background: act.bg, color: act.col, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{act.l}</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── urgent transfusions ───────────────────────────────────── */
function UrgentTx({ patients = [] }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,30,.04)' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-.02em' }}>Urgent Transfusions</div>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>Within the next 7 days</div>
        </div>
        <Bdg tone={patients.length > 0 ? 'red' : 'neutral'}>{patients.length} upcoming</Bdg>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f6f6f8' }}>
              {['Patient', 'Group', 'Date', 'Bridge', 'Action'].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: C.faint, fontSize: 11.5, letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: C.faint, fontSize: 13 }}>No urgent transfusions in the next 7 days.</td></tr>
            ) : patients.map((t, i) => {
              const ig = (t.integrity || t.bridge_integrity || 'full').toLowerCase().replace(/[\s-]/g, '');
              const crit = ig === 'broken';
              return (
                <tr key={t.user_id || i} style={{ background: crit ? '#fff9f9' : '#fff', borderBottom: `1px solid #f0f0f3` }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {crit && <span style={{ width: 8, height: 8, borderRadius: 99, background: C.red, animation: 'pulse-slow 1.4s infinite', flexShrink: 0 }} />}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{t.user_id?.slice(0, 10)}…</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}><span style={{ fontFamily: 'var(--ff-mono)', fontWeight: 700, fontSize: 13 }}>{t.blood_group || '—'}</span></td>
                  <td style={{ padding: '10px 14px' }}><span style={{ fontWeight: 600, color: crit ? C.redText : C.ink, fontSize: 13 }}>{t.expected_next_transfusion_date || '—'}</span></td>
                  <td style={{ padding: '10px 14px' }}><IntBdg v={t.bridge_integrity || 'full'} /></td>
                  <td style={{ padding: '10px 14px' }}>
                    <button style={{ padding: '6px 12px', borderRadius: 99, background: crit ? C.red : '#f0f0f3', color: crit ? '#fff' : C.soft, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {crit ? 'Escalate' : 'View'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── supply panel ──────────────────────────────────────────── */
function SupplyPanel({ regional, overview }) {
  const byGroup = regional?.by_group || {};
  const groups = Object.entries(byGroup).sort((a, b) => a[0].localeCompare(b[0]));
  const maxUnits = Math.max(...Object.values(byGroup), 1);
  const shortage = overview?.shortage || {};
  const critical = shortage.critical || [];
  const low = shortage.low || [];
  const alerts = [...critical.map(s => ({ ...s, sev: 'critical' })), ...low.map(s => ({ ...s, sev: 'low' }))];

  const statusCol = (units) => {
    const pct = units / maxUnits;
    return pct > 0.5 ? C.green : pct > 0.2 ? C.amber : C.red;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,30,.04)' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-.02em' }}>Regional Blood Stock</div>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 2, fontFamily: 'var(--ff-mono)' }}>{regional?.active_banks || 0} banks · {regional?.state || 'Telangana'}</div>
        </div>
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {groups.map(([grp, units]) => {
            const col = statusCol(units);
            const pct = Math.round((units / maxUnits) * 100);
            return (
              <div key={grp} style={{ border: `1px solid ${C.line}`, borderRadius: 11, padding: '10px 10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.02em', fontFamily: 'var(--ff-mono)' }}>{grp}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: col, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{units.toLocaleString('en-IN')}</div>
                <div style={{ height: 5, borderRadius: 99, background: C.line, overflow: 'hidden', marginTop: 6 }}>
                  <div style={{ width: pct + '%', height: '100%', background: col, borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>
        {alerts.length > 0 && (
          <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {alerts.slice(0, 3).map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 10, background: s.sev === 'critical' ? C.redSoft : C.amberSoft, border: `1px solid ${s.sev === 'critical' ? '#f3c6c9' : '#f5dec5'}` }}>
                <span style={{ fontSize: 12, color: s.sev === 'critical' ? C.red : C.amber, flexShrink: 0, marginTop: 1 }}>●</span>
                <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.4 }}>
                  <b style={{ fontFamily: 'var(--ff-mono)', color: s.sev === 'critical' ? C.red : C.amber }}>{s.blood_group}</b> — {s.days_of_coverage?.toFixed(1)}d coverage · {Math.round(s.shortfall_units || 0)} units short
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── learning insights ─────────────────────────────────────── */
function LearningInsights({ learning }) {
  const acceptRate = learning?.accept_rate || 0;
  const patterns = learning?.patterns || [];

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,30,.04)' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-.02em' }}>Learning Insights</div>
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>What the agent learned from recent outreach</div>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {patterns.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: C.faint, fontSize: 13 }}>No patterns yet — trigger an agent cycle from <Link to="/admin/agents" style={{ color: C.red, textDecoration: 'none', fontWeight: 700 }}>Agent Log</Link>.</div>
        ) : patterns.slice(0, 4).map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 12, background: '#f6f6f8', border: `1px solid ${C.line}` }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: C.blueSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Ic n="insights" z={18} fill col={C.blue} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.4 }}>{p.pattern || p.description || String(p)}</div>
              {p.count && <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 700, color: C.blue, marginTop: 5 }}>{p.count} cases</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 18px 14px', borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: C.faint }}>Accept rate (recent outreach)</div>
        <span style={{ fontSize: 18, fontWeight: 800, color: acceptRate > 0.5 ? C.green : acceptRate > 0.3 ? C.amber : C.red, fontVariantNumeric: 'tabular-nums' }}>{Math.round((acceptRate || 0) * 100)}%</span>
      </div>
    </div>
  );
}

/* ── dashboard home ────────────────────────────────────────── */
function DashboardHome() {
  const [data, setData] = useState(null);
  const [bridges, setBridges] = useState([]);
  const [churn, setChurn] = useState(null);
  const [urgent, setUrgent] = useState(null);
  const [events, setEvents] = useState([]);
  const [learning, setLearning] = useState(null);
  const [regional, setRegional] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const [d, br, ch, ur, ev, ln, rg, ov] = await Promise.allSettled([
        getDashboard(),
        getBridges(),
        getChurnAlerts(0.55),
        getUrgentAlerts(),
        getAgentEvents(30),
        getAgentLearning(),
        getRegionalSupply('Telangana'),
        getSupplyOverview(),
      ]);
      if (d.status === 'fulfilled') setData(d.value);
      if (br.status === 'fulfilled') setBridges(br.value || []);
      if (ch.status === 'fulfilled') setChurn(ch.value);
      if (ur.status === 'fulfilled') setUrgent(ur.value);
      if (ev.status === 'fulfilled') setEvents(ev.value?.events || []);
      if (ln.status === 'fulfilled') setLearning(ln.value);
      if (rg.status === 'fulfilled') setRegional(rg.value);
      if (ov.status === 'fulfilled') setOverview(ov.value);
      if (d.status === 'rejected') setError(d.reason?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;
  if (error && !data) return <div style={{ padding: 26 }}><ErrBox msg={error} /></div>;

  const churnDonors = (churn?.donors || []).filter(d => (d.churn_risk || 0) > 0.55).slice(0, 6);
  const urgentPatients = urgent?.patients || [];

  return (
    <div style={{ padding: '24px 26px 60px', maxWidth: 1400 }}>
      <StatsRow data={data} bridges={bridges} churn={churn} urgent={urgent} />

      {/* Row 1: Bridge board + Agent feed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)', gap: 18, marginBottom: 18 }}>
        <BridgeBoard bridges={bridges} onHeal={load} />
        <AgentFeed events={events} />
      </div>

      {/* Row 2: Churn alerts + Urgent transfusions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <ChurnAlerts donors={churnDonors} />
        <UrgentTx patients={urgentPatients} />
      </div>

      {/* Row 3: Supply + Learning */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 18 }}>
        <SupplyPanel regional={regional} overview={overview} />
        <LearningInsights learning={learning} />
      </div>
    </div>
  );
}

/* ── exports used by BridgesPage / AgentsPage ──────────────── */
export function LoadingState() { return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>; }
export function ErrorState({ msg }) { return <div style={{ padding: 26 }}><ErrBox msg={msg} /></div>; }

/* ── main export ───────────────────────────────────────────── */
export default function AdminDashboard({ onLogout }) {
  const [page, setPage] = useState('dashboard');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar onLogout={onLogout} />
      <div style={{ flex: 1, background: '#eef2f7', overflowY: 'auto', height: '100vh' }}>
        <Routes>
          <Route index element={<><TopBar page="dashboard" /><DashboardHome /></>} />
          <Route path="bridges" element={<><TopBar page="bridges" /><BridgesPage /></>} />
          <Route path="agents" element={<><TopBar page="agents" /><AgentsPage /></>} />
          <Route path="supply" element={<><TopBar page="supply" /><SupplyPage /></>} />
        </Routes>
      </div>
    </div>
  );
}
