async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

// Admin
export const getDashboard = () => request('/admin/dashboard');
export const getSupplyOverview = () => request('/admin/supply-overview');
export const getBridges = () => request('/admin/bridges');
export const getBridge = (id) => request(`/admin/bridges/${id}`);
export const healBridge = (id) => request(`/admin/bridges/${id}/heal`, { method: 'POST' });
export const getChurnAlerts = (threshold = 0.5) => request(`/admin/alerts/churn?threshold=${threshold}`);
export const getUrgentAlerts = () => request('/admin/alerts/urgent');

// Donor portal
export const getDonor = (id) => request(`/donors/${id}`);
export const getDonorClock = (id) => request(`/donors/${id}/clock`);
export const registerDonor = (data) => request('/donors/register', { method: 'POST', body: JSON.stringify(data) });

// Patient portal
export const getPatient = (id) => request(`/patients/${id}`);
export const createBridge = (patientId, size = 8) => request(`/patients/${patientId}/bridge`, { method: 'POST', body: JSON.stringify({ size }) });

// Agent / orchestrator
export const triggerTransfusion = (patientId) => request(`/agent/transfusion-due/${patientId}`, { method: 'POST' });
export const getAgentRequests = () => request('/agent/requests');
export const getAgentEvents = (limit = 50) => request(`/agent/events?limit=${limit}`);
export const getAgentLearning = () => request('/agent/learning');

// Supply
export const getRegionalSupply = (state = 'Telangana') => request(`/supply/regional?state=${encodeURIComponent(state)}`);
export const getMobilization = () => request('/supply/mobilization');

// Chatbot
export const sendChatMessage = (message, role = 'public', userId = null) =>
  request('/chat', { method: 'POST', body: JSON.stringify({ message, role, user_id: userId }) });
