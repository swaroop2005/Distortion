import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { getDashboard } from '../../services/api';
import BridgesPage from './BridgesPage';
import AgentsPage from './AgentsPage';
import SupplyPage from './SupplyPage';

function KPICard({ label, value, sub, accent }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-5 shadow-sm ${accent ? 'ring-2 ring-rose-100' : ''}`}>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-black tabular-nums tracking-tight ${accent ? 'text-rose-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function BloodGroupChart({ distribution }) {
  if (!distribution) return null;
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(e => e[1]));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-extrabold text-gray-900 mb-4">Blood Group Distribution</h3>
      <div className="space-y-2">
        {entries.map(([group, count]) => (
          <div key={group} className="flex items-center gap-3">
            <span className="w-10 text-xs font-bold text-gray-600 font-mono">{group}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs font-bold text-gray-500 tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BridgeHealthSummary({ health }) {
  if (!health) return null;
  const atRisk = health.at_risk || health['at-risk'] || 0;
  const total = (health.full || 0) + atRisk + (health.broken || 0);
  if (total === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-extrabold text-gray-900 mb-4">Bridge Health</h3>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex">
          {health.full > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(health.full / total) * 100}%` }} />}
          {atRisk > 0 && <div className="h-full bg-amber-500" style={{ width: `${(atRisk / total) * 100}%` }} />}
          {health.broken > 0 && <div className="h-full bg-rose-500" style={{ width: `${(health.broken / total) * 100}%` }} />}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-black text-emerald-600 tabular-nums">{health.full || 0}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase">Full</p>
        </div>
        <div>
          <p className="text-2xl font-black text-amber-600 tabular-nums">{atRisk}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase">At-Risk</p>
        </div>
        <div>
          <p className="text-2xl font-black text-rose-600 tabular-nums">{health.broken || 0}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase">Broken</p>
        </div>
      </div>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-rose-200 border-t-rose-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading live data...</p>
      </div>
    </div>
  );
}

export function ErrorState({ msg }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center bg-rose-50 border border-rose-200 rounded-2xl p-6 max-w-sm">
        <p className="text-sm font-bold text-rose-700 mb-1">Connection Error</p>
        <p className="text-xs text-rose-600">{msg}</p>
        <p className="text-xs text-gray-500 mt-3">Make sure backend is running on :8000</p>
      </div>
    </div>
  );
}

function DashboardHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState msg={error} />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Command Center</h1>
        <p className="text-sm text-gray-500">ThalNet autonomous operations overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Donors" value={data.total_donors} />
        <KPICard label="Eligible Now" value={data.eligible_donors} sub={`${data.total_donors ? Math.round((data.eligible_donors / data.total_donors) * 100) : 0}% of pool`} />
        <KPICard label="Patients" value={data.total_patients} />
        <KPICard label="High Churn" value={data.high_churn_count} accent={data.high_churn_count > 0} sub="donors at risk" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BloodGroupChart distribution={data.blood_group_distribution} />
        <BridgeHealthSummary health={data.bridge_health} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Routes>
      <Route index element={<DashboardHome />} />
      <Route path="bridges" element={<BridgesPage />} />
      <Route path="agents" element={<AgentsPage />} />
      <Route path="supply" element={<SupplyPage />} />
    </Routes>
  );
}
