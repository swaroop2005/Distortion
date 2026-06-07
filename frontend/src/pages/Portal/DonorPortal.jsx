import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { getDonor, getDonorClock, registerDonor, listConnections, respondConnection } from '../../services/api';
import { Icon, Card, Btn, Badge, Eyebrow, Spinner, ErrBox, IntegrityBadge } from '../../design';
import StatusBadge from '../../components/StatusBadge';
import ConnectionChat from '../../components/ConnectionChat';

/* ── ID input screen ─────────────────────────────────────── */
function IdInputScreen({ onLookup, loading, error }) {
  const [id, setId] = useState('');
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 36, width: 'min(440px, 100%)', boxShadow: 'var(--sh-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ width: 58, height: 58, borderRadius: 16, background: 'var(--green-50)', display: 'grid', placeItems: 'center' }}>
            <Icon name="volunteer_activism" size={30} fill color="var(--green-600)" />
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>Donor Portal</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
            Enter your donor ID to view your eligibility clock and connection requests
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Donor ID</label>
          <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${error ? 'var(--red-500)' : 'var(--line)'}`, borderRadius: 10, overflow: 'hidden', background: '#fff', transition: 'border-color .2s' }}>
            <div style={{ padding: '11px 12px', borderRight: '1px solid var(--line-soft)' }}>
              <Icon name="water_drop" size={18} color="var(--muted)" />
            </div>
            <input
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="e.g. DN-001"
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
            background: loading || !id.trim() ? 'var(--green-100)' : 'var(--green-500)',
            color: loading || !id.trim() ? 'var(--green-600)' : '#fff',
            border: 'none', fontSize: 15, fontWeight: 700,
            cursor: loading || !id.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'all .2s',
          }}
        >
          {loading ? 'Loading...' : 'View My Status'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--faint)' }}>
          Not registered yet?{' '}
          <a href="/donor/register" style={{ color: 'var(--red-500)', fontWeight: 700 }}>Sign up here →</a>
        </div>

        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Try demo IDs</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['DN-001', 'DN-002', 'DN-003'].map(demo => (
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

/* ── Clock hero ──────────────────────────────────────────── */
function ClockHero({ clock }) {
  if (!clock) return null;
  const eligible = clock.eligible_now;
  const pct = eligible ? 100 : Math.max(5, 100 - (clock.days_to_eligible / 90 * 100));

  return (
    <Card pad={28} style={{ marginBottom: 18, background: eligible ? 'var(--green-600)' : '#1a1b1f', color: '#fff', border: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, opacity: 0.75, marginBottom: 8 }}>Donation clock</div>
          {eligible ? (
            <>
              <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1 }}>Eligible now</div>
              <p style={{ marginTop: 10, fontSize: 15, opacity: 0.85, lineHeight: 1.5, maxWidth: 360 }}>{clock.message}</p>
            </>
          ) : (
            <>
              <div className="tnum" style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1 }}>{clock.days_to_eligible} days</div>
              <p style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>Next eligible: {clock.next_eligible_date}</p>
              <p style={{ marginTop: 4, fontSize: 14.5, opacity: 0.85, maxWidth: 360 }}>{clock.message}</p>
            </>
          )}
        </div>
        <div style={{ width: 72, height: 72, borderRadius: 99, border: '3px solid rgba(255,255,255,.3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name={eligible ? 'check_circle' : 'schedule'} size={36} fill color={eligible ? '#fff' : 'rgba(255,255,255,.6)'} />
        </div>
      </div>
      {!eligible && (
        <div style={{ marginTop: 20, width: '100%', height: 6, borderRadius: 99, background: 'rgba(255,255,255,.15)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'rgba(255,255,255,.7)', borderRadius: 99, transition: 'width .8s ease' }} />
        </div>
      )}
    </Card>
  );
}

/* ── Donor view ──────────────────────────────────────────── */
function DonorView({ donor, clock, donorId }) {
  const unitsDonated = donor.donations_till_date || 0;
  const patientsHelped = Math.max(1, Math.floor(unitsDonated / 2));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 22px 80px' }}>
      {/* greeting */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>Welcome back,</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', marginTop: 2 }}>{donorId}</h1>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>
          {donor.blood_group} donor · {donor.donor_type || 'Regular'} · giving since {donor.first_donation_date || 'the beginning'}
        </div>
      </div>

      {/* clock hero */}
      <ClockHero clock={clock} />

      {/* 2-column */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18 }}>
        {/* left: connection inbox */}
        <DonorInbox donorId={donorId} />

        {/* right: impact + profile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* quiet impact */}
          <Card pad={22}>
            <Eyebrow color="var(--muted)">Your quiet impact</Eyebrow>
            <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div className="tnum" style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em' }}>{unitsDonated}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>units donated</div>
              </div>
              <div style={{ width: 1, background: 'var(--line)' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div className="tnum" style={{ fontSize: 32, fontWeight: 800, color: 'var(--green-600)', letterSpacing: '-.03em' }}>{patientsHelped}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>patients helped</div>
              </div>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 16, lineHeight: 1.5, padding: '12px 14px', background: 'var(--bg-warm)', borderRadius: 12 }}>
              That's real. Each unit is roughly one more month a child didn't have to worry. Thank you — that's all, just thank you.
            </p>
          </Card>

          {/* donor profile */}
          <Card pad={22}>
            <Eyebrow color="var(--muted)">Your donor profile</Eyebrow>
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { l: 'Blood group', v: donor.blood_group },
                { l: 'Type', v: donor.donor_type || 'Regular' },
                { l: 'Total donations', v: donor.donations_till_date },
                { l: 'Total calls', v: donor.total_calls },
                { l: 'Responsiveness', v: `${Math.round((donor.responsiveness || 0) * 100)}%`, col: 'var(--green-600)' },
                { l: 'Churn risk', v: `${Math.round((donor.churn_risk || 0) * 100)}%`, col: donor.churn_risk > 0.5 ? 'var(--red-500)' : 'var(--ink)' },
              ].map(f => (
                <div key={f.l}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{f.l}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: f.col || 'var(--ink)' }}>{f.v ?? '—'}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── DonorInbox ──────────────────────────────────────────── */
function DonorInbox({ donorId }) {
  const [connections, setConnections] = useState([]);
  const [error, setError] = useState(null);

  const refresh = async () => {
    try {
      const r = await listConnections(donorId, 'donor');
      setConnections(r.connections || []);
      setError(null);
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [donorId]);

  const respond = async (connId, action) => {
    try { await respondConnection(connId, donorId, action); await refresh(); }
    catch (e) { setError(e.message); }
  };

  return (
    <Card pad={22}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow color="var(--muted)">When you're ready</Eyebrow>
        <Badge tone="neutral">{connections.filter(c => c.status === 'pending').length} pending</Badge>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
        Patients who've requested your help. There's no pressure — say yes only when it suits you.
      </p>
      {error && <div style={{ fontSize: 13, color: 'var(--red-500)', marginTop: 8 }}>{error}</div>}
      {connections.length === 0 ? (
        <div style={{ marginTop: 20, padding: '24px 0', textAlign: 'center' }}>
          <Icon name="notifications_none" size={32} color="var(--faint)" />
          <p style={{ fontSize: 13, color: 'var(--faint)', marginTop: 8 }}>No patients have requested you yet.</p>
        </div>
      ) : (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {connections.map(c => (
            <div key={c.connection_id} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16, background: c.status === 'pending' ? '#fff' : 'var(--bg)' }}>
              <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--red-50)', display: 'grid', placeItems: 'center', border: '1px solid var(--red-100)', flexShrink: 0 }}>
                  <Icon name="favorite" size={22} fill color="var(--red-500)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>Patient {c.patient_id}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              </div>
              {c.status === 'pending' && (
                <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
                  <Btn variant="green" size="sm" icon="check" onClick={() => respond(c.connection_id, 'accept')} style={{ flex: 1, justifyContent: 'center' }}>I can help</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => respond(c.connection_id, 'decline')}>Not this time</Btn>
                </div>
              )}
              {c.status === 'accepted' && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--green-600)', fontWeight: 600, fontSize: 13.5 }}>
                  <Icon name="check_circle" size={18} fill color="var(--green-600)" /> Thank you — we'll send details closer to the date.
                </div>
              )}
              {c.status === 'accepted' && <ConnectionChat connectionId={c.connection_id} selfId={donorId} />}
            </div>
          ))}
        </div>
      )}
      <button onClick={refresh} style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
        ↻ Refresh inbox
      </button>
    </Card>
  );
}

/* ── DonorLookup ─────────────────────────────────────────── */
function DonorLookup({ setUserId }) {
  const [donorId, setDonorId] = useState('');
  const [donor, setDonor] = useState(null);
  const [clock, setClock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lookup = async (id) => {
    setLoading(true); setError(null);
    try {
      const [d, c] = await Promise.all([getDonor(id), getDonorClock(id)]);
      setDonor(d); setClock(c);
      setDonorId(id);
      if (setUserId) setUserId(d.user_id);
    } catch (e) {
      setError(e.message);
      setDonor(null); setClock(null);
    } finally { setLoading(false); }
  };

  if (!donor) return <IdInputScreen onLookup={lookup} loading={loading} error={error} />;
  return <DonorView donor={donor} clock={clock} donorId={donorId} />;
}

/* ── DonorRegister ───────────────────────────────────────── */
function DonorRegister() {
  const [form, setForm] = useState({ blood_group: '', gender: 'Male', latitude: 17.385, longitude: 78.486 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true); setError(null);
    try { const r = await registerDonor(form); setResult(r); }
    catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const INPUT_STYLE = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 14, fontFamily: 'var(--ff-sans)', outline: 'none', background: '#fff' };
  const LABEL_STYLE = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 36, width: 'min(480px, 100%)', boxShadow: 'var(--sh-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ width: 58, height: 58, borderRadius: 16, background: 'var(--green-50)', display: 'grid', placeItems: 'center' }}>
            <Icon name="person_add" size={30} fill color="var(--green-600)" />
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>Register as Donor</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>Join the Blood Bridge network</div>
        </div>

        {result ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 99, background: 'var(--green-100)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <Icon name="check_circle" size={28} fill color="var(--green-600)" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green-700)', marginBottom: 8 }}>{result.message}</div>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>Blood group: {result.blood_group}</div>
            {result.note && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8 }}>{result.note}</div>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Blood Group</label>
              <select value={form.blood_group} onChange={e => setForm({ ...form, blood_group: e.target.value })} required style={INPUT_STYLE}>
                <option value="">Select...</option>
                {['O Positive','O Negative','A Positive','A Negative','B Positive','B Negative','AB Positive','AB Negative'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Gender</label>
              <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} style={INPUT_STYLE}>
                {['Male','Female','Other'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            {error && <div style={{ fontSize: 13, color: 'var(--red-600)' }}>{error}</div>}
            <button type="submit" disabled={submitting} style={{
              width: '100%', padding: '13px', borderRadius: 10,
              background: submitting ? 'var(--green-100)' : 'var(--green-500)',
              color: submitting ? 'var(--green-600)' : '#fff',
              border: 'none', fontSize: 15, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>
              {submitting ? 'Registering...' : 'Register as Donor'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function DonorPortal({ setUserId }) {
  return (
    <Routes>
      <Route index element={<DonorLookup setUserId={setUserId} />} />
      <Route path="register" element={<DonorRegister />} />
    </Routes>
  );
}
