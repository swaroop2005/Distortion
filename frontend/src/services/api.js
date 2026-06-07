const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
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
export const getBridges = () => request('/admin/bridges').then(d => Array.isArray(d) ? d : (d.bridges || []));
export const getBridge = (id) => request(`/admin/bridges/${id}`);
export const healBridge = (id) => request(`/admin/bridges/${id}/heal`, { method: 'POST' });
export const getChurnAlerts = (threshold = 0.5) => request(`/admin/alerts/churn?threshold=${threshold}`);
export const getUrgentAlerts = () => request('/admin/alerts/urgent');

// Registration
export const registerDonor = (data) => request('/donors/register', { method: 'POST', body: JSON.stringify(data) });
export const registerPatient = (data) => request('/patients/register', { method: 'POST', body: JSON.stringify(data) });

// Donor portal
export const getDonor = (id) => request(`/donors/${id}`);
export const getDonorClock = (id) => request(`/donors/${id}/clock`);

// Patient portal
export const getPatient = (id) => request(`/patients/${id}`);
export const createBridge = (patientId, size = 8) => request(`/patients/${patientId}/bridge`, { method: 'POST', body: JSON.stringify({ size }) });

// Agent / orchestrator
export const triggerTransfusion = (patientId) => request(`/agent/transfusion-due/${patientId}`, { method: 'POST' });
export const triggerNewDonor = (donorId) => request(`/agent/new-donor/${donorId}`, { method: 'POST' });
export const triggerEmergency = (data) => request('/agent/emergency', { method: 'POST', body: JSON.stringify(data) });
export const getAgentRequests = () => request('/agent/requests');
export const getAgentEvents = (limit = 50) => request(`/agent/events?limit=${limit}`);
export const getAgentLearning = () => request('/agent/learning');
export const getAgentOutcomes = () => request('/agent/outcomes');

// Supply
export const getRegionalSupply = (state = 'Telangana') => request(`/supply/regional?state=${encodeURIComponent(state)}`);
export const getMobilization = () => request('/supply/mobilization');
export const getSupplyBanks = (district, bloodGroup) => {
  const params = new URLSearchParams();
  if (district) params.set('district', district);
  if (bloodGroup) params.set('blood_group', bloodGroup);
  return request(`/supply/banks?${params}`);
};
export const getPatientMap = (patientId) => request(`/supply/patient-map?patient_id=${encodeURIComponent(patientId)}`);

// Chatbot
export const sendChatMessage = (message, role = 'public', userId = null) =>
  request('/chat', { method: 'POST', body: JSON.stringify({ message, role, user_id: userId }) });
export const learnFaq = (question, answer, source = 'Admin') =>
  request('/chat/learn', { method: 'POST', body: JSON.stringify({ question, answer, source }) });
export const getUnanswered = (limit = 50) => request(`/chat/unanswered?limit=${limit}`);

// Community — blood requests
export const createRequest = (data) =>
  request('/community/requests', { method: 'POST', body: JSON.stringify(data) });
export const getRequest = (requestId) => request(`/community/requests/${requestId}`);
export const getRequestMatches = (requestId, limit = 20) =>
  request(`/community/requests/${requestId}/matches?limit=${limit}`);

// Community — connections (the mutual-accept handshake)
export const sendConnection = (requestId, patientId, donorId) =>
  request('/community/connections', {
    method: 'POST',
    body: JSON.stringify({ request_id: requestId, patient_id: patientId, donor_id: donorId }),
  });
export const respondConnection = (connectionId, donorId, action) =>
  request(`/community/connections/${connectionId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ donor_id: donorId, action }),
  });
export const cancelConnection = (connectionId, patientId) =>
  request(`/community/connections/${connectionId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ patient_id: patientId }),
  });
export const listConnections = (userId, role) =>
  request(`/community/connections?user_id=${encodeURIComponent(userId)}&role=${role}`);

// Community — private messages (only on accepted connections)
export const getThread = (connectionId, userId) =>
  request(`/community/connections/${connectionId}/messages?user_id=${encodeURIComponent(userId)}`);
export const postMessage = (connectionId, senderId, text) =>
  request(`/community/connections/${connectionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ sender_id: senderId, text }),
  });
