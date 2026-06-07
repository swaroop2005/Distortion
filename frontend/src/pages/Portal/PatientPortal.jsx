import { useState, useEffect } from 'react';
import {
  getPatient, createBridge,
  createRequest, getRequestMatches, sendConnection, listConnections, cancelConnection,
} from '../../services/api';
import { Icon, Card, Btn, Badge, Eyebrow, IntegrityBadge, Spinner, ErrBox } from '../../design';
import StatusBadge from '../../components/StatusBadge';
import ConnectionChat from '../../components/ConnectionChat';

/* ── ID input screen ─────────────────────────────────────── */
function IdInputScreen({ onLookup, loading, error }) {
  const [id, setId] = useState('');
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 36, width: 'min(440px, 100%)', boxShadow: 'var(--sh-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ width: 58, height: 58, borderRadius: 16, background: 'var(--red-50)', display: 'grid', placeItems: 'center' }}>
            <Icon name="favorite" size={30} fill color="var(--red-500)" />
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>Patient Portal</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
            Enter your patient ID to view your bridge and care status
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Patient ID</label>
          <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${error ? 'var(--red-500)' : 'var(--line)'}`, borderRadius: 10, overflow: 'hidden', background: '#fff', transition: 'border-color .2s' }}>
            <div style={{ padding: '11px 12px', borderRight: '1px solid var(--line-soft)' }}>
              <Icon name="person" size={18} color="var(--muted)" />
            </div>
            <input
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="e.g. PT-001"
              style={{ flex: 1, border: 'none', padding: '11px 14px', fontSize: 14, fontFamily: 'var(--ff-sans)', outline: 'none', background: 'transparent' }}
              onKeyDown={e => e.key === 'Enter' && id.trim() && onLookup(id.trim())}
            />
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--red-500)', marginTop: 8 }}>{error}</div>}
        </div>

        <button
          onClick={() => id.trim() && onLookup(id.trim())}
          disabled={loading || !id.trim()}
          style={{
            width: '100%', padding: '13px', borderRadius: 10,
            background: loading || !id.trim() ? 'var(--red-100)' : 'var(--red-500)',
            color: loading || !id.trim() ? 'var(--red-300)' : '#fff',
            border: 'none', fontSize: 15, fontWeight: 700,
            cursor: loading || !id.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'all .2s',
          }}
        >
          {loading ? 'Loading...' : 'View My Care'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--faint)' }}>
          New patient? Speak to a Blood Warriors coordinator.
        </div>

        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Try demo IDs</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['PT-001', 'PT-002', 'PT-003'].map(demo => (
              <button key={demo} onClick={() => { setId(demo); onLookup(demo); }}
                style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--line)', background: '#fff', fontSize: 12, fontFamily: 'var(--ff-mono)', fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)' }}>
                {demo}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Bridge visualization ─────────────────────────────────── */
function BridgeViz({ donors = [], target = 8 }) {
  const slots = Array(target).fill(null).map((_, i) => donors[i] || null);
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {slots.map((d, i) => (
        <div key={i} style={{
          width: 46, height: 46, borderRadius: 13,
          background: d ? (d.eligible !== false ? 'var(--green-100)' : 'var(--amber-50)') : 'var(--bg)',
          border: `1.5px solid ${d ? (d.eligible !== false ? 'var(--green-100)' : 'var(--amber-100)') : 'var(--line)'}`,
          display: 'grid', placeItems: 'center',
        }}>
          <Icon name="person" size={24} fill
            color={d ? (d.eligible !== false ? 'var(--green-600)' : 'var(--amber-600)') : 'var(--faint)'} />
        </div>
      ))}
    </div>
  );
}

/* ── Patient data view ────────────────────────────────────── */
function PatientView({ patient, patientId, onBuildBridge, building }) {
  const [urgent, setUrgent] = useState(false);
  const [requested, setRequested] = useState(false);

  const nextDate = patient.expected_next_transfusion_date;
  const daysTo = nextDate
    ? Math.max(0, Math.ceil((new Date(nextDate) - new Date()) / 86400000))
    : null;

  const bridges = patient.bridges || [];
  const topBridge = bridges[0] || null;
  const donorCount = topBridge ? (topBridge.donor_count || (topBridge.donors || []).length) : 0;
  const target = topBridge?.target_size || 8;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 22px 80px' }}>
      {/* greeting */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>Good day,</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', marginTop: 2 }}>{patientId}'s care</h1>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>
          {patient.blood_group} · {patient.quantity_required} units/cycle · Blood Warriors network
        </div>
      </div>

      {/* next transfusion headline */}
      <Card pad={0} style={{ overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 70, height: 70, borderRadius: 18, background: 'var(--red-50)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="calendar_month" size={34} color="var(--red-500)" fill />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>Next transfusion</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginTop: 2 }}>
              {nextDate || 'Not scheduled'}
              {daysTo !== null && <span style={{ color: 'var(--red-500)' }}> · in {daysTo} days</span>}
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 4 }}>
              {patient.quantity_required} units needed · {donorCount} of {target} bridge slots filled
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Btn variant="primary" icon="bloodtype" onClick={() => setRequested(true)} disabled={requested}>
              {requested ? 'Request sent' : 'Request blood'}
            </Btn>
            <Btn variant="soft" icon="emergency" onClick={() => setUrgent(true)}>Flag urgent need</Btn>
          </div>
        </div>
        {requested && (
          <div style={{ padding: '12px 24px', background: 'var(--green-50)', borderTop: '1px solid var(--green-100)', display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: 'var(--green-600)', fontWeight: 600 }}>
            <Icon name="check_circle" size={18} fill color="var(--green-600)" />
            Your care team and the bridge have been notified. We'll keep you posted here.
          </div>
        )}
      </Card>

      {/* 2-col grid: bridge + actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)', gap: 18 }}>
        {/* Bridge card */}
        <Card pad={24}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <Eyebrow color="var(--muted)">Your blood bridge</Eyebrow>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', marginTop: 6 }}>
                The donors keeping you covered
              </div>
            </div>
            {topBridge && <IntegrityBadge status={topBridge.integrity} />}
          </div>

          {topBridge ? (
            <>
              <BridgeViz donors={topBridge.donors || []} target={target} />
              <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 16, display: 'flex', gap: 14, textAlign: 'center' }}>
                {[
                  { v: donorCount, l: 'Donors in bridge' },
                  { v: target, l: 'Target size' },
                  { v: topBridge.integrity || '—', l: 'Status' },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1 }}>
                    <div className="tnum" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>{s.v}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>No bridge built yet</div>
              <Btn variant="primary" icon="hub" onClick={onBuildBridge} disabled={building}>
                {building ? 'Building...' : 'Build Auto-Bridge (8→1)'}
              </Btn>
            </div>
          )}

          {topBridge && (
            <div style={{ marginTop: 14 }}>
              <Btn variant="ghost" size="sm" icon="hub" onClick={onBuildBridge} disabled={building}>
                {building ? 'Building...' : 'Rebuild bridge'}
              </Btn>
            </div>
          )}
        </Card>

        {/* Right: bridge list + reassurance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {bridges.length > 1 && (
            <Card pad={22}>
              <Eyebrow color="var(--muted)">All bridges</Eyebrow>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bridges.map((b, i) => {
                  const sz = b.donor_count || (b.donors?.length || 0);
                  return (
                    <div key={i} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 700, color: 'var(--muted)', flex: 1 }}>{b.bridge_id}</div>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sz}/{b.target_size || 8}</span>
                      <IntegrityBadge status={b.integrity} />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card pad={22} style={{ background: 'var(--bg-warm)', border: '1px solid var(--line-soft)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Icon name="shield" size={26} color="var(--red-500)" fill style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>You don't have to chase donors.</div>
                <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 6, lineHeight: 1.5 }}>
                  That's our job. If a slot opens up, we fill it quietly.
                  You'll only hear from us when there's something genuinely useful to share.
                </p>
              </div>
            </div>
          </Card>

          <Card pad={22}>
            <Eyebrow color="var(--muted)">What's happening</Eyebrow>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { icon: 'check_circle', color: 'var(--green-500)', text: 'Bridge auto-built successfully', time: 'Today' },
                { icon: 'auto_awesome', color: '#1f5fa6', text: 'AI agent contacted bridge donors', time: 'Ongoing' },
                { icon: 'hub', color: 'var(--amber-500)', text: 'Eligibility windows staggered', time: '3 days ago' },
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 13 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 99, background: '#fff', border: `2px solid ${t.color}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name={t.icon} size={15} color={t.color} fill />
                    </div>
                    {i < 2 && <div style={{ width: 2, flex: 1, background: 'var(--line)', margin: '3px 0', minHeight: 12 }} />}
                  </div>
                  <div style={{ paddingBottom: 14 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{t.text}</div>
                    <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>{t.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Blood request + connect section */}
      <div style={{ marginTop: 18 }}>
        <PatientConnect patient={patient} />
      </div>

      {urgent && <UrgentModal patientId={patientId} blood_group={patient.blood_group} onClose={() => setUrgent(false)} />}
    </div>
  );
}

/* ── Urgent modal ─────────────────────────────────────────── */
function UrgentModal({ patientId, blood_group, onClose }) {
  const [stage, setStage] = useState(0);
  const [units, setUnits] = useState(2);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,20,.45)', backdropFilter: 'blur(3px)', zIndex: 900, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px,100%)', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--sh-lg)' }}>
        <div style={{ padding: '18px 22px', background: 'var(--red-500)', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="emergency" size={24} fill color="#fff" />
          <div style={{ fontWeight: 700, fontSize: 17, flex: 1 }}>Urgent blood need</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" size={22} color="#fff" /></button>
        </div>
        {stage === 0 ? (
          <div style={{ padding: 22 }}>
            <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>This alerts your care team and the nearest available donors right away. Only use it when blood is needed soon.</p>
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[{ label: 'Blood group', value: blood_group }, { label: 'Patient ID', value: patientId }].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{f.label}</div>
                  <div style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', fontWeight: 600, fontSize: 14 }}>{f.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>Units needed</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1,2,3,4].map(u => (
                  <button key={u} onClick={() => setUnits(u)} style={{
                    flex: 1, padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: 'pointer',
                    border: `1.5px solid ${units === u ? 'var(--red-500)' : 'var(--line)'}`,
                    background: units === u ? 'var(--red-50)' : '#fff',
                    color: units === u ? 'var(--red-600)' : 'var(--ink)',
                    fontFamily: 'inherit',
                  }}>{u}</button>
                ))}
              </div>
            </div>
            <Btn full variant="primary" size="lg" icon="bolt" style={{ marginTop: 20 }} onClick={() => setStage(1)}>Send urgent request</Btn>
          </div>
        ) : (
          <div style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--red-500)', animation: 'blink 1.4s infinite', display: 'inline-block' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--red-600)' }}>Live · {units} units · {blood_group}</span>
            </div>
            {[
              { icon: 'send', label: 'Request received', done: true },
              { icon: 'groups', label: 'Nearby compatible donors ranked & notified', done: true },
              { icon: 'forum', label: 'Donors replying…', done: false },
              { icon: 'local_hospital', label: 'Awaiting blood bank confirmation', done: false },
            ].map((s, i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 13 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 99, display: 'grid', placeItems: 'center', background: s.done ? 'var(--green-500)' : '#fff', border: s.done ? 'none' : '2px solid var(--amber-500)' }}>
                    <Icon name={s.done ? 'check' : s.icon} size={16} color={s.done ? '#fff' : 'var(--amber-500)'} fill={!s.done} />
                  </div>
                  {i < arr.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 18, background: 'var(--line)' }} />}
                </div>
                <div style={{ paddingBottom: 14, paddingTop: 5 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{s.label}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg-warm)', fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 6 }}>
              Stay calm — help is moving. Your care team can see this too.
            </div>
            <Btn full variant="ghost" style={{ marginTop: 16 }} onClick={onClose}>Close — keep tracking in background</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── PatientConnect (blood request + connections) ─────────── */
function PatientConnect({ patient }) {
  const pid = patient.user_id;
  const GROUPS = ['O Positive','O Negative','A Positive','A Negative','B Positive','B Negative','AB Positive','AB Negative'];
  const [form, setForm] = useState({ blood_group: patient.blood_group || 'O Positive', city: 'Hyderabad', units_required: 2, need_by: '' });
  const [request, setRequest] = useState(null);
  const [matches, setMatches] = useState([]);
  const [connections, setConnections] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const refreshConnections = async () => {
    try { const r = await listConnections(pid, 'patient'); setConnections(r.connections || []); } catch (_) {}
  };
  useEffect(() => { refreshConnections(); /* eslint-disable-next-line */ }, [pid]);

  const submitRequest = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      const req = await createRequest({ patient_id: pid, blood_group: form.blood_group, city: form.city, units_required: Number(form.units_required), need_by: form.need_by });
      setRequest(req);
      const m = await getRequestMatches(req.request_id, 20);
      setMatches(m.matches || []);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const connect = async (donorId) => {
    try { await sendConnection(request.request_id, pid, donorId); setNotice(`Connection request sent to ${donorId}.`); await refreshConnections(); }
    catch (e) { setError(e.message); }
  };

  const cancel = async (connId) => {
    try { await cancelConnection(connId, pid); await refreshConnections(); }
    catch (e) { setError(e.message); }
  };

  const INPUT_STYLE = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 14, fontFamily: 'var(--ff-sans)', outline: 'none', background: '#fff' };
  const LABEL_STYLE = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 };

  return (
    <Card pad={24}>
      <Eyebrow color="var(--muted)">Request blood &amp; connect with donors</Eyebrow>
      <h3 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', marginTop: 8, marginBottom: 20 }}>Find compatible donors nearby</h3>

      <form onSubmit={submitRequest} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div>
          <label style={LABEL_STYLE}>Blood group</label>
          <select value={form.blood_group} onChange={e => setForm({ ...form, blood_group: e.target.value })} style={INPUT_STYLE}>
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label style={LABEL_STYLE}>City</label>
          <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} style={INPUT_STYLE} />
        </div>
        <div>
          <label style={LABEL_STYLE}>Units needed</label>
          <input type="number" min="1" value={form.units_required} onChange={e => setForm({ ...form, units_required: e.target.value })} style={INPUT_STYLE} />
        </div>
        <div>
          <label style={LABEL_STYLE}>Need by</label>
          <input type="date" value={form.need_by} onChange={e => setForm({ ...form, need_by: e.target.value })} required style={INPUT_STYLE} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Btn type="submit" full variant="primary" size="lg" disabled={busy}>
            {busy ? 'Finding donors…' : 'Create Request & Find Compatible Donors'}
          </Btn>
        </div>
      </form>

      {error && <div style={{ color: 'var(--red-600)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {notice && <div style={{ color: 'var(--green-600)', fontSize: 13, marginBottom: 12 }}>{notice}</div>}

      {request && matches.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>
            {matches.length} compatible donor{matches.length === 1 ? '' : 's'} found
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
            {matches.map(m => (
              <div key={m.donor_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 16px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{m.donor_id}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                    {m.blood_group} · {m.distance_km != null ? `${m.distance_km} km` : 'distance n/a'} · {m.eligible ? 'eligible now' : `eligible in ${m.days_until_eligible}d`}
                  </div>
                </div>
                <Btn variant="primary" size="sm" icon="link" onClick={() => connect(m.donor_id)}>Connect</Btn>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connections */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>My connections</div>
          <button onClick={refreshConnections} style={{ fontSize: 12, fontWeight: 700, color: 'var(--red-500)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Refresh</button>
        </div>
        {connections.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>No connection requests yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {connections.map(c => (
              <div key={c.connection_id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 700 }}>{c.donor_id}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusBadge status={c.status} />
                    {(c.status === 'pending' || c.status === 'accepted') && (
                      <button onClick={() => cancel(c.connection_id)} style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    )}
                  </div>
                </div>
                {c.status === 'accepted' && <ConnectionChat connectionId={c.connection_id} selfId={pid} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── Main export ──────────────────────────────────────────── */
export default function PatientPortal({ userId, setUserId }) {
  const [patientId, setPatientId] = useState('');
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [building, setBuilding] = useState(false);

  const lookup = async (id) => {
    setLoading(true); setError(null);
    try {
      const p = await getPatient(id);
      setPatient(p);
      setPatientId(id);
      if (setUserId) setUserId(p.user_id);
    } catch (e) {
      setError(e.message);
      setPatient(null);
    } finally { setLoading(false); }
  };

  const handleBuildBridge = async () => {
    setBuilding(true);
    try {
      await createBridge(patientId);
      const p = await getPatient(patientId).catch(() => null);
      if (p) setPatient(p);
    } catch (e) { alert(e.message); }
    finally { setBuilding(false); }
  };

  if (!patient) {
    return <IdInputScreen onLookup={lookup} loading={loading} error={error} />;
  }

  return <PatientView patient={patient} patientId={patientId} onBuildBridge={handleBuildBridge} building={building} />;
}
