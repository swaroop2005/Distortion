import { useState, useEffect } from 'react';
import { getSupplyOverview, getChurnAlerts, getUrgentAlerts } from '../../services/api';
import { Icon, Card, Btn, Badge, Eyebrow, Spinner, ErrBox } from '../../design';

const ACTION_CFG = {
  'do-not-disturb': { tone: 'red',     label: 'DND' },
  'send-appreciation': { tone: 'blue', label: 'Appreciate' },
  'wait':              { tone: 'neutral', label: 'Wait' },
  'contact-now':       { tone: 'green', label: 'Contact now' },
};

export default function SupplyPage() {
  const [supply, setSupply] = useState(null);
  const [churn, setChurn] = useState(null);
  const [urgent, setUrgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('supply');

  useEffect(() => {
    Promise.all([
      getSupplyOverview().catch(() => null),
      getChurnAlerts().catch(() => null),
      getUrgentAlerts().catch(() => null),
    ]).then(([s, c, u]) => { setSupply(s); setChurn(c); setUrgent(u); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (error) return <div style={{ padding: 28 }}><ErrBox msg={error} /></div>;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Eyebrow style={{ marginBottom: 4 }}>National Supply</Eyebrow>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.02em', color: 'var(--ink)', margin: 0 }}>Supply & Alerts</h1>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>National blood stock, shortage forecast, risk alerts</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1.5px solid var(--line)', paddingBottom: 0 }}>
        {[{ k: 'supply', l: 'Supply', icon: 'bloodtype' }, { k: 'alerts', l: 'Alerts', icon: 'notifications' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: '10px 10px 0 0', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            border: 'none', fontFamily: 'inherit', transition: 'all .15s',
            background: tab === t.k ? 'var(--surface)' : 'transparent',
            color: tab === t.k ? 'var(--red-500)' : 'var(--muted)',
            borderBottom: tab === t.k ? '2px solid var(--red-500)' : '2px solid transparent',
            marginBottom: -1.5,
          }}>
            <Icon name={t.icon} size={16} fill color={tab === t.k ? 'var(--red-500)' : 'var(--muted)'} />
            {t.l}
          </button>
        ))}
      </div>

      {/* Supply tab */}
      {tab === 'supply' && supply && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {supply.recommendation && (
            <div style={{
              padding: '14px 18px', borderRadius: 12, fontSize: 13.5, fontWeight: 600,
              background: supply.action_required ? 'var(--red-50)' : '#e2f3ea',
              border: `1px solid ${supply.action_required ? 'var(--red-100)' : '#b3dfc8'}`,
              color: supply.action_required ? 'var(--red-700)' : '#1c7a52',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <Icon name={supply.action_required ? 'warning' : 'check_circle'} size={18} fill color="currentColor" />
              {supply.recommendation}
            </div>
          )}

          {/* KPI grid */}
          {supply.kpis && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              {[
                { label: 'Banks indexed', value: supply.kpis.total_banks_indexed?.toLocaleString(), accent: false },
                { label: 'Total units', value: supply.kpis.total_units_nationwide?.toLocaleString(), accent: false },
                { label: 'States covered', value: supply.kpis.states_covered, accent: false },
                { label: 'To mobilize', value: supply.kpis.donors_to_mobilize?.toLocaleString(), accent: true },
              ].map(k => (
                <Card key={k.label} pad={18} style={{ borderLeft: k.accent ? '3px solid var(--red-500)' : undefined }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-.03em', color: k.accent ? 'var(--red-500)' : 'var(--ink)' }}>{k.value ?? '—'}</div>
                </Card>
              ))}
            </div>
          )}

          {/* Shortage cards */}
          {supply.shortage && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ShortageCard title="Critical shortage" items={supply.shortage.critical} tone="red" />
              <ShortageCard title="Low supply" items={supply.shortage.low} tone="amber" />
            </div>
          )}
        </div>
      )}

      {/* Alerts tab */}
      {tab === 'alerts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Churn */}
          <Card pad={20}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Icon name="trending_down" size={18} fill color="var(--amber-600)" />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>Churn Risk Donors</span>
              {churn && <Badge tone="amber">{churn.count}</Badge>}
            </div>
            {churn?.donors?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 380, overflowY: 'auto' }}>
                {churn.donors.slice(0, 20).map((d, i) => {
                  const act = ACTION_CFG[d.action] || { tone: 'neutral', label: d.action };
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 8, background: 'var(--line-soft)' }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--ff-mono)', color: 'var(--ink)' }}>{d.user_id.slice(0, 12)}…</span>
                        <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 8 }}>{d.blood_group}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--amber-600)', fontFamily: 'var(--ff-mono)' }}>{(d.churn_risk * 100).toFixed(0)}%</span>
                        <Badge tone={act.tone}>{act.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>No high-churn donors</p>
            )}
          </Card>

          {/* Urgent */}
          <Card pad={20}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Icon name="emergency" size={18} fill color="var(--red-500)" />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>Urgent Transfusions</span>
              {urgent && <Badge tone="red">{urgent.count}</Badge>}
            </div>
            {urgent?.patients?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 380, overflowY: 'auto' }}>
                {urgent.patients.map((p, i) => (
                  <div key={i} style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--line-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--ff-mono)', color: 'var(--ink)' }}>{p.user_id.slice(0, 12)}…</span>
                      <span style={{ fontSize: 11.5, color: 'var(--red-600)', marginLeft: 8, fontWeight: 700 }}>{p.blood_group}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{p.quantity_required} units</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>by {p.expected_next_transfusion_date}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>No urgent cases</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function ShortageCard({ title, items, tone }) {
  if (!items || items.length === 0) return null;
  const colors = {
    red:   { bg: 'var(--red-50)',   border: 'var(--red-100)',  text: 'var(--red-700)',  val: 'var(--red-600)' },
    amber: { bg: 'var(--amber-50)', border: 'var(--amber-100)', text: 'var(--amber-600)', val: 'var(--amber-600)' },
  };
  const c = colors[tone];
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: c.text, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name={tone === 'red' ? 'crisis_alert' : 'warning'} size={15} fill color={c.text} />
        {title} ({items.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,.65)', borderRadius: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--ff-mono)' }}>{r.blood_group}</span>
            <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
              <span style={{ color: 'var(--muted)' }}>{Math.round(r.supply_units)} units</span>
              <span style={{ color: c.val, fontWeight: 700 }}>{r.days_of_coverage?.toFixed(1)}d coverage</span>
              <span style={{ color: 'var(--muted)' }}>short {Math.round(r.shortfall_units)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
