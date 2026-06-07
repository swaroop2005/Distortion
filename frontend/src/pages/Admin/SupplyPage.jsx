import { useState, useEffect } from 'react';
import { getSupplyOverview, getChurnAlerts, getUrgentAlerts } from '../../services/api';
import { LoadingState, ErrorState } from './AdminDashboard';

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
    ])
      .then(([s, c, u]) => {
        setSupply(s);
        setChurn(c);
        setUrgent(u);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState msg={error} />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Supply & Alerts</h1>
        <p className="text-sm text-gray-500">National blood stock, shortage forecast, and risk alerts</p>
      </div>

      <div className="flex gap-2">
        {['supply', 'alerts'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors ${
              tab === t ? 'bg-rose-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'supply' && supply && (
        <div className="space-y-6">
          {/* Recommendation banner */}
          {supply.recommendation && (
            <div className={`rounded-2xl p-4 text-sm font-semibold ${
              supply.action_required ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            }`}>
              {supply.recommendation}
            </div>
          )}

          {/* National KPIs */}
          {supply.kpis && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI label="Banks Indexed" value={supply.kpis.total_banks_indexed?.toLocaleString()} />
              <KPI label="Total Units" value={supply.kpis.total_units_nationwide?.toLocaleString()} />
              <KPI label="States Covered" value={supply.kpis.states_covered} />
              <KPI label="To Mobilize" value={supply.kpis.donors_to_mobilize?.toLocaleString()} accent />
            </div>
          )}

          {/* Shortage report */}
          {supply.shortage && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ShortageCard title="Critical" items={supply.shortage.critical} color="rose" />
              <ShortageCard title="Low" items={supply.shortage.low} color="amber" />
            </div>
          )}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Churn Alerts */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-extrabold text-gray-900">Churn Risk Alerts</h3>
              {churn && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{churn.count}</span>}
            </div>
            {churn && churn.donors && churn.donors.length > 0 ? (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {churn.donors.slice(0, 20).map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 text-xs border-b border-gray-100 last:border-0">
                    <div>
                      <span className="font-mono font-bold text-gray-700">{d.user_id.slice(0, 12)}...</span>
                      <span className="text-gray-400 ml-2">{d.blood_group}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-600">{(d.churn_risk * 100).toFixed(0)}%</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.action === 'do-not-disturb' ? 'bg-rose-100 text-rose-700' :
                        d.action === 'send-appreciation' ? 'bg-purple-100 text-purple-700' :
                        d.action === 'wait' ? 'bg-gray-100 text-gray-600' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {d.action}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No high-churn donors</p>
            )}
          </div>

          {/* Urgent Patients */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-extrabold text-gray-900">Urgent Transfusions</h3>
              {urgent && <span className="text-xs font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{urgent.count}</span>}
            </div>
            {urgent && urgent.patients && urgent.patients.length > 0 ? (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {urgent.patients.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 text-xs border-b border-gray-100 last:border-0">
                    <div>
                      <span className="font-mono font-bold text-gray-700">{p.user_id.slice(0, 12)}...</span>
                      <span className="text-gray-400 ml-2">{p.blood_group}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-600">{p.quantity_required} units</span>
                      <span className="text-gray-400 ml-2">by {p.expected_next_transfusion_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No urgent cases</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, accent }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-4 shadow-sm ${accent ? 'ring-2 ring-rose-100' : ''}`}>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-black tabular-nums tracking-tight ${accent ? 'text-rose-600' : 'text-gray-900'}`}>{value ?? '—'}</p>
    </div>
  );
}

function ShortageCard({ title, items, color }) {
  if (!items || items.length === 0) return null;
  const bg = color === 'rose' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200';
  const text = color === 'rose' ? 'text-rose-800' : 'text-amber-800';

  return (
    <div className={`rounded-2xl border p-5 ${bg}`}>
      <h3 className={`text-sm font-extrabold mb-3 ${text}`}>{title} ({items.length})</h3>
      <div className="space-y-2">
        {items.map((r, i) => (
          <div key={i} className="flex items-center justify-between text-xs bg-white/60 rounded-lg p-2">
            <span className="font-mono font-bold text-gray-800">{r.blood_group}</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-600">{Math.round(r.supply_units)} units</span>
              <span className={`font-bold ${text}`}>{r.days_of_coverage?.toFixed(1)}d coverage</span>
              <span className="text-gray-500">short {Math.round(r.shortfall_units)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
