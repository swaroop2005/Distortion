import { useState, useEffect } from 'react';
import { getBridges, healBridge } from '../../services/api';
import { LoadingState, ErrorState } from './AdminDashboard';
import StatusBadge from '../../components/StatusBadge';

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
    try {
      await healBridge(id);
      fetchData();
    } catch (e) {
      alert(e.message);
    } finally {
      setHealing(null);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState msg={error} />;

  const filtered = bridges.filter(b =>
    (filter === 'all' || b.integrity === filter) &&
    (!search || (b.patient_id || b.pid || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Bridge Health Board</h1>
          <p className="text-sm text-gray-500">Every patient bridge, updated live</p>
        </div>
        <div className="flex items-center gap-2">
          {['all', 'full', 'at-risk', 'broken'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                filter === f ? 'bg-rose-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient..."
            className="px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 w-40"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-bold">
              <tr>
                <th className="px-4 py-3 border-b border-gray-200">Patient</th>
                <th className="px-4 py-3 border-b border-gray-200">Group</th>
                <th className="px-4 py-3 border-b border-gray-200">Bridge</th>
                <th className="px-4 py-3 border-b border-gray-200">Integrity</th>
                <th className="px-4 py-3 border-b border-gray-200">Donors</th>
                <th className="px-4 py-3 border-b border-gray-200">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(b => {
                const size = b.donors ? b.donors.length : (b.size || 0);
                const target = b.target_size || b.target || 8;
                const pct = Math.min(100, (size / target) * 100);
                const barColor = b.integrity === 'broken' ? 'bg-rose-500' : b.integrity === 'at-risk' ? 'bg-amber-500' : 'bg-emerald-500';
                const rowBg = b.integrity === 'broken' ? 'bg-rose-50/40' : b.integrity === 'at-risk' ? 'bg-amber-50/40' : '';

                return (
                  <tr key={b.bridge_id || b.pid} className={`${rowBg} hover:bg-gray-50 transition-colors`}>
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900 font-mono text-xs">{b.patient_id || b.pid}</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{b.blood_group || b.group}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-500 tabular-nums">{size}/{target}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={b.integrity} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {b.donors ? b.donors.slice(0, 3).map(d => d.donor_id || d).join(', ') : '—'}
                      {b.donors && b.donors.length > 3 && ` +${b.donors.length - 3}`}
                    </td>
                    <td className="px-4 py-3">
                      {b.integrity !== 'full' && (
                        <button
                          onClick={() => handleHeal(b.bridge_id || b.pid)}
                          disabled={healing === (b.bridge_id || b.pid)}
                          className="px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold transition-colors"
                        >
                          {healing === (b.bridge_id || b.pid) ? 'Healing...' : 'Heal'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No bridges match filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
          {filtered.length} bridge{filtered.length !== 1 ? 's' : ''} shown
        </div>
      </div>
    </div>
  );
}
