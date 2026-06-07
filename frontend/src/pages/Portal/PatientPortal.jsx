import { useState, useEffect } from 'react';
import {
  getPatient, createBridge,
  createRequest, getRequestMatches, sendConnection, listConnections, cancelConnection,
} from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import ConnectionChat from '../../components/ConnectionChat';

export default function PatientPortal({ userId, setUserId }) {
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
      if (setUserId) setUserId(p.user_id);
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
      try {
        const p = await getPatient(patientId.trim());
        setPatient(p);
      } catch (_) {
        // Bridge created but refresh failed — show stale data with success note
      }
      setError(null);
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
                  const size = b.donor_count || (b.donors ? b.donors.length : 0);
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
                              (b.integrity || '').toLowerCase().includes('broken') ? 'bg-rose-500' :
                              (b.integrity || '').toLowerCase().includes('risk') ? 'bg-amber-500' : 'bg-emerald-500'
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
          <PatientConnect patient={patient} />
        </>
      )}
    </div>
  );
}

function PatientConnect({ patient }) {
  const pid = patient.user_id;
  const GROUPS = ['O Positive', 'O Negative', 'A Positive', 'A Negative', 'B Positive', 'B Negative', 'AB Positive', 'AB Negative'];
  const [form, setForm] = useState({ blood_group: patient.blood_group || 'O Positive', city: 'Hyderabad', units_required: 2, need_by: '' });
  const [request, setRequest] = useState(null);
  const [matches, setMatches] = useState([]);
  const [connections, setConnections] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const refreshConnections = async () => {
    try {
      const r = await listConnections(pid, 'patient');
      setConnections(r.connections || []);
    } catch (_) { /* ignore */ }
  };

  useEffect(() => { refreshConnections(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pid]);

  const submitRequest = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      const req = await createRequest({
        patient_id: pid,
        blood_group: form.blood_group,
        city: form.city,
        units_required: Number(form.units_required),
        need_by: form.need_by,
      });
      setRequest(req);
      const m = await getRequestMatches(req.request_id, 20);
      setMatches(m.matches || []);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const connect = async (donorId) => {
    try {
      await sendConnection(request.request_id, pid, donorId);
      setNotice(`Connection request sent to ${donorId}.`);
      await refreshConnections();
    } catch (e) { setError(e.message); }
  };

  const cancel = async (connId) => {
    try { await cancelConnection(connId, pid); await refreshConnections(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-extrabold text-gray-900 mb-4">Request Blood &amp; Connect with Donors</h3>

      <form onSubmit={submitRequest} className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Blood group</label>
          <select value={form.blood_group} onChange={e => setForm({ ...form, blood_group: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500">
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">City</label>
          <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Units</label>
          <input type="number" min="1" value={form.units_required} onChange={e => setForm({ ...form, units_required: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Need by</label>
          <input type="date" value={form.need_by} onChange={e => setForm({ ...form, need_by: e.target.value })} required
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
        </div>
        <div className="col-span-2">
          <button type="submit" disabled={busy}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold text-sm transition-colors">
            {busy ? 'Finding donors…' : 'Create Request & Find Compatible Donors'}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-rose-600 mb-2">{error}</p>}
      {notice && <p className="text-sm text-emerald-600 mb-2">{notice}</p>}

      {request && (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            {matches.length} compatible donor{matches.length === 1 ? '' : 's'} found
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {matches.map(m => (
              <div key={m.donor_id} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                <div className="text-sm">
                  <span className="font-mono text-xs font-bold text-gray-700">{m.donor_id}</span>
                  <span className="ml-2 text-gray-500">{m.blood_group}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {m.distance_km != null ? `${m.distance_km} km` : 'distance n/a'} ·{' '}
                    {m.eligible ? 'eligible now' : `eligible in ${m.days_until_eligible}d`}
                  </span>
                </div>
                <button onClick={() => connect(m.donor_id)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors">
                  Connect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">My Connections</p>
          <button onClick={refreshConnections} className="text-[11px] font-bold text-rose-600 hover:text-rose-700">Refresh</button>
        </div>
        {connections.length === 0 ? (
          <p className="text-xs text-gray-400">No connection requests yet.</p>
        ) : (
          <div className="space-y-2">
            {connections.map(c => (
              <div key={c.connection_id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-gray-700">{c.donor_id}</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    {(c.status === 'pending' || c.status === 'accepted') && (
                      <button onClick={() => cancel(c.connection_id)}
                        className="text-[11px] font-bold text-gray-400 hover:text-rose-600">Cancel</button>
                    )}
                  </div>
                </div>
                {c.status === 'accepted' && <ConnectionChat connectionId={c.connection_id} selfId={pid} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
