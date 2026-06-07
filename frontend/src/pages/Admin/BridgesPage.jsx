import { useState, useEffect } from 'react';
import { getBridges, healBridge } from '../../services/api';
import { Icon, Card, Btn, Badge, Eyebrow, IntegrityBadge, Spinner, ErrBox } from '../../design';

const FILTER_OPTS = ['all', 'full', 'at-risk', 'broken'];

export default function BridgesPage() {
  const [bridges, setBridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [healing, setHealing] = useState(null);

  const fetchData = () => {
    setLoading(true);
    getBridges()
      .then(setBridges)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleHeal = async (id) => {
    setHealing(id);
    try { await healBridge(id); fetchData(); }
    catch (e) { alert(e.message); }
    finally { setHealing(null); }
  };

  if (loading) return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (error) return <div style={{ padding: 28 }}><ErrBox msg={error} /></div>;

  const norm = s => (s || '').toLowerCase().replace('_', '-');
  const filtered = bridges.filter(b =>
    (filter === 'all' || norm(b.integrity) === filter) &&
    (!search || (b.patient_id || '').toLowerCase().includes(search.toLowerCase()))
  );

  const counts = { full: 0, 'at-risk': 0, broken: 0 };
  bridges.forEach(b => { const k = norm(b.integrity); if (counts[k] !== undefined) counts[k]++; });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Eyebrow style={{ marginBottom: 4 }}>Bridge Management</Eyebrow>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.02em', color: 'var(--ink)', margin: 0 }}>Bridge Health Board</h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>Every patient bridge — live</p>
        </div>
        <Btn variant="ghost" size="sm" icon="refresh" onClick={fetchData}>Refresh</Btn>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ padding: '8px 16px', borderRadius: 999, background: '#e2f3ea', color: '#1c7a52', fontSize: 13, fontWeight: 700 }}>
          {counts.full} Full
        </div>
        <div style={{ padding: '8px 16px', borderRadius: 999, background: 'var(--amber-100)', color: 'var(--amber-600)', fontSize: 13, fontWeight: 700 }}>
          {counts['at-risk']} At-risk
        </div>
        <div style={{ padding: '8px 16px', borderRadius: 999, background: 'var(--red-100)', color: 'var(--red-600)', fontSize: 13, fontWeight: 700 }}>
          {counts.broken} Broken
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTER_OPTS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            border: filter === f ? 'none' : '1px solid var(--line)',
            background: filter === f ? 'var(--red-500)' : 'var(--surface)',
            color: filter === f ? '#fff' : 'var(--muted)',
            textTransform: 'capitalize', transition: 'all .15s',
          }}>{f}</button>
        ))}
        <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
          <Icon name="search" size={15} color="var(--faint)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient ID…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, borderRadius: 999, border: '1px solid var(--line)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Table */}
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: 'var(--line-soft)' }}>
                {['Patient', 'Blood', 'Bridge fill', 'Integrity', 'Donors', 'Action'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const size = b.donor_count || (b.donors ? b.donors.length : 0);
                const target = b.target_size || 8;
                const pct = Math.min(100, (size / target) * 100);
                const integ = norm(b.integrity);
                const barColor = integ === 'broken' ? 'var(--red-500)' : integ === 'at-risk' ? 'var(--amber-500)' : 'var(--green-500)';
                const rowBg = integ === 'broken' ? 'rgba(225,29,42,.03)' : integ === 'at-risk' ? 'rgba(201,138,30,.03)' : 'transparent';
                const bid = b.bridge_id || b.pid;

                return (
                  <tr key={bid} style={{ background: rowBg, borderBottom: '1px solid var(--line-soft)', transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--line-soft)'}
                    onMouseLeave={e => e.currentTarget.style.background = rowBg}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'var(--ff-mono)', fontWeight: 700, fontSize: 12.5, color: 'var(--ink)' }}>{b.patient_id || b.pid}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'var(--ff-mono)', fontWeight: 800, color: 'var(--red-600)', fontSize: 13 }}>{b.blood_group || b.group}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 72, height: 5, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 999, background: barColor, width: `${pct}%`, transition: 'width .3s' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', fontFamily: 'var(--ff-mono)' }}>{size}/{target}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}><IntegrityBadge status={b.integrity} /></td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--ff-mono)' }}>
                      {b.donors ? b.donors.slice(0, 3).map(d => d.donor_id || d).join(', ') : '—'}
                      {b.donors && b.donors.length > 3 && <span style={{ color: 'var(--faint)' }}> +{b.donors.length - 3}</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {integ !== 'full' && (
                        <Btn
                          size="sm"
                          variant={integ === 'broken' ? 'danger' : 'soft'}
                          icon="healing"
                          onClick={() => handleHeal(bid)}
                          disabled={healing === bid}
                        >
                          {healing === bid ? 'Healing…' : 'Heal'}
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>
                    No bridges match this filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', background: 'var(--line-soft)', fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{filtered.length} bridge{filtered.length !== 1 ? 's' : ''} shown</span>
          <span>{bridges.length} total</span>
        </div>
      </Card>
    </div>
  );
}
