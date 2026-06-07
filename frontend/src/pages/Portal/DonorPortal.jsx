import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { getDonor, getDonorClock, registerDonor, listConnections, respondConnection } from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import ConnectionChat from '../../components/ConnectionChat';

function DonorLookup({ setUserId }) {
  const [donorId, setDonorId] = useState('');
  const [donor, setDonor] = useState(null);
  const [clock, setClock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lookup = async () => {
    if (!donorId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [d, c] = await Promise.all([
        getDonor(donorId.trim()),
        getDonorClock(donorId.trim()),
      ]);
      setDonor(d);
      setClock(c);
      if (setUserId) setUserId(d.user_id);
    } catch (e) {
      setError(e.message);
      setDonor(null);
      setClock(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Donor Portal</h1>
        <p className="text-sm text-gray-500">Track your eligibility, donation clock, and bridge assignments</p>
      </div>

      <div className="flex gap-2">
        <input
          value={donorId}
          onChange={e => setDonorId(e.target.value)}
          placeholder="Enter your Donor ID (e.g. DN-001)"
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

      {clock && (
        <div className={`rounded-2xl p-8 text-white shadow-lg ${clock.eligible_now ? 'bg-emerald-600' : 'bg-gray-800'}`}>
          <h2 className="text-lg font-extrabold tracking-tight mb-2">Donation Clock</h2>
          {clock.eligible_now ? (
            <>
              <p className="text-5xl font-black tracking-tighter mb-2">Eligible Now</p>
              <p className="text-emerald-100 font-medium">{clock.message}</p>
            </>
          ) : (
            <>
              <p className="text-5xl font-black tabular-nums tracking-tighter mb-2">{clock.days_to_eligible} Days</p>
              <p className="text-gray-300 font-medium">{clock.message}</p>
              <p className="text-xs text-gray-400 mt-1">Next eligible: {clock.next_eligible_date}</p>
              <div className="mt-6 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, 100 - (clock.days_to_eligible / 90 * 100))}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {donor && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-extrabold text-gray-900 mb-4">Your Profile</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Detail label="ID" value={donor.user_id} mono />
            <Detail label="Blood Group" value={donor.blood_group} />
            <Detail label="Type" value={donor.donor_type} />
            <Detail label="Eligible" value={donor.eligible ? 'Yes' : 'No'} color={donor.eligible ? 'text-emerald-600' : 'text-amber-600'} />
            <Detail label="Donations" value={donor.donations_till_date} />
            <Detail label="Total Calls" value={donor.total_calls} />
            <Detail label="Responsiveness" value={`${(donor.responsiveness * 100).toFixed(0)}%`} />
            <Detail label="Churn Risk" value={`${(donor.churn_risk * 100).toFixed(0)}%`} color={donor.churn_risk > 0.5 ? 'text-rose-600' : 'text-gray-700'} />
          </div>
        </div>
      )}

      {donor && <DonorInbox donorId={donor.user_id} />}
    </div>
  );
}

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

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [donorId]);

  const respond = async (connId, action) => {
    try { await respondConnection(connId, donorId, action); await refresh(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-extrabold text-gray-900">Connection Requests</h3>
        <button onClick={refresh} className="text-[11px] font-bold text-rose-600 hover:text-rose-700">Refresh</button>
      </div>
      {error && <p className="text-sm text-rose-600 mb-2">{error}</p>}
      {connections.length === 0 ? (
        <p className="text-xs text-gray-400">No patients have requested you yet.</p>
      ) : (
        <div className="space-y-2">
          {connections.map(c => (
            <div key={c.connection_id} className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-gray-400 text-xs">Patient </span>
                  <span className="font-mono text-xs font-bold text-gray-700">{c.patient_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={c.status} />
                  {c.status === 'pending' && (
                    <>
                      <button onClick={() => respond(c.connection_id, 'accept')}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">Accept</button>
                      <button onClick={() => respond(c.connection_id, 'decline')}
                        className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold">Decline</button>
                    </>
                  )}
                </div>
              </div>
              {c.status === 'accepted' && <ConnectionChat connectionId={c.connection_id} selfId={donorId} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono, color }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`font-bold ${mono ? 'font-mono text-xs' : 'text-sm'} ${color || 'text-gray-900'}`}>
        {value ?? '—'}
      </p>
    </div>
  );
}

function DonorRegister() {
  const [form, setForm] = useState({ blood_group: '', gender: 'Male', latitude: 17.385, longitude: 78.486 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const r = await registerDonor(form);
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Register as Donor</h1>
        <p className="text-sm text-gray-500">Join the Blood Bridge network</p>
      </div>

      {result ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <p className="text-lg font-bold text-emerald-700 mb-2">{result.message}</p>
          <p className="text-sm text-emerald-600">Blood group: {result.blood_group}</p>
          <p className="text-xs text-gray-500 mt-2">{result.note}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Blood Group</label>
            <select
              value={form.blood_group}
              onChange={e => setForm({ ...form, blood_group: e.target.value })}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="">Select...</option>
              {['O Positive', 'O Negative', 'A Positive', 'A Negative', 'B Positive', 'B Negative', 'AB Positive', 'AB Negative'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gender</label>
            <select
              value={form.gender}
              onChange={e => setForm({ ...form, gender: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {['Male', 'Female', 'Other'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold text-sm transition-colors"
          >
            {submitting ? 'Registering...' : 'Register'}
          </button>
        </form>
      )}
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
