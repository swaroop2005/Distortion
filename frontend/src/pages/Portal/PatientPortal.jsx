import { useState } from 'react';
import { getPatient, createBridge } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function PatientPortal() {
  const [patientId, setPatientId] = useState('');
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [building, setBuilding] = useState(false);

  const lookup = async () => {
    if (!patientId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const p = await getPatient(patientId.trim());
      setPatient(p);
    } catch (e) {
      setError(e.message);
      setPatient(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildBridge = async () => {
    setBuilding(true);
    try {
      await createBridge(patientId.trim());
      const p = await getPatient(patientId.trim());
      setPatient(p);
    } catch (e) {
      alert(e.message);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Patient Portal</h1>
        <p className="text-sm text-gray-500">View your Auto-Bridge and transfusion schedule</p>
      </div>

      <div className="flex gap-2">
        <input
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
          placeholder="Enter your Patient ID (e.g. PT-001)"
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          onKeyDown={e => e.key === 'Enter' && lookup()}
        />
        <button
          onClick={lookup}
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold text-sm transition-colors"
        >
          {loading ? 'Loading...' : 'Look Up'}
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">{error}</div>
      )}

      {patient && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-extrabold text-gray-900 mb-4">Your Profile</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">ID</p>
                <p className="font-bold font-mono text-xs text-gray-900">{patient.user_id}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Blood Group</p>
                <p className="font-bold text-gray-900">{patient.blood_group}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Quantity Required</p>
                <p className="font-bold text-gray-900">{patient.quantity_required} units</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Next Transfusion</p>
                <p className="font-bold text-gray-900">{patient.expected_next_transfusion_date || '—'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-gray-900">Your Bridges</h3>
              <button
                onClick={handleBuildBridge}
                disabled={building}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold transition-colors"
              >
                {building ? 'Building...' : 'Build New Bridge (8→1)'}
              </button>
            </div>

            {patient.bridges && patient.bridges.length > 0 ? (
              <div className="space-y-3">
                {patient.bridges.map((b, i) => {
                  const size = b.donors ? b.donors.length : 0;
                  const target = b.target_size || 8;
                  const pct = Math.min(100, (size / target) * 100);
                  return (
                    <div key={i} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-gray-700">{b.bridge_id}</span>
                        <StatusBadge status={b.integrity} />
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              b.integrity === 'broken' ? 'bg-rose-500' :
                              b.integrity === 'at-risk' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-500 tabular-nums">{size}/{target} donors</span>
                      </div>
                      {b.donors && b.donors.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {b.donors.map((d, j) => (
                            <span key={j} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] font-mono font-bold text-gray-600">
                              {d.donor_id || d}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400 mb-2">No bridges yet</p>
                <p className="text-xs text-gray-400">Click "Build New Bridge" to create your first Auto-Bridge</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
