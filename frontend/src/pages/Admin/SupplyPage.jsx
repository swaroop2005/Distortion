import { useState, useEffect } from 'react';
import { getRegionalSupply, getMobilization, getChurnAlerts, getUrgentAlerts } from '../../services/api';
import { LoadingState, ErrorState } from './AdminDashboard';

export default function SupplyPage() {
  const [regional, setRegional] = useState(null);
  const [mobilization, setMobilization] = useState(null);
  const [churn, setChurn] = useState(null);
  const [urgent, setUrgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('supply');

  useEffect(() => {
    Promise.all([
      getRegionalSupply().catch(() => null),
      getMobilization().catch(() => null),
      getChurnAlerts().catch(() => null),
      getUrgentAlerts().catch(() => null),
    ])
      .then(([r, m, c, u]) => {
        setRegional(r);
        setMobilization(m);
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
        <p className="text-sm text-gray-500">Regional blood stock, mobilization plan, and risk alerts</p>
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

      {tab === 'supply' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Regional Supply */}
          {regional && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-extrabold text-gray-900 mb-4">Regional Supply — {regional.state || 'Telangana'}</h3>
              {regional.groups ? (
                <div className="space-y-2">
                  {Object.entries(regional.groups).map(([group, data]) => (
                    <div key={group} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <span className="font-mono font-bold text-sm text-gray-900">{group}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-700">{typeof data === 'number' ? data : data.units || data.total || '—'}</span>
                        <span className="text-xs text-gray-400 ml-1">units</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto max-h-64">{JSON.stringify(regional, null, 2)}</pre>
              )}
            </div>
          )}

          {/* Mobilization */}
          {mobilization && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-extrabold text-gray-900 mb-4">Mobilization Plan</h3>
              {mobilization.donors && mobilization.donors.length > 0 ? (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {mobilization.donors.slice(0, 20).map((d, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 text-xs">
                      <span className="font-mono font-bold text-gray-700">{d.user_id || d.donor_id}</span>
                      <span className="font-mono text-gray-500">{d.blood_group}</span>
                      <span className={`font-bold ${d.eligible ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {d.eligible ? 'Eligible' : 'Cooling'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No mobilization data</p>
              )}
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
                      <span className="font-mono font-bold text-gray-700">{d.user_id}</span>
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
                      <span className="font-mono font-bold text-gray-700">{p.user_id}</span>
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
