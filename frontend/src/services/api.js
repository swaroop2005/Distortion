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
export const getAdminDonors = (limit = 50) => request(`/admin/donors?limit=${limit}`);
export const getAdminDonor = (id) => request(`/admin/donors/${id}`);
export const updateDonor = (id, data) => request(`/admin/donors/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const getAdminPatients = (limit = 50) => request(`/admin/patients?limit=${limit}`);
export const getAdminPatient = (id) => request(`/admin/patients/${id}`);
export const getBridges = () => request('/admin/bridges');
export const getBridge = (id) => request(`/admin/bridges/${id}`);
export const healBridge = (id) => request(`/admin/bridges/${id}/heal`, { method: 'POST' });
export const getChurnAlerts = (threshold = 0.5) => request(`/admin/alerts/churn?threshold=${threshold}`);
export const getUrgentAlerts = () => request('/admin/alerts/urgent');

// Donor portal
export const getDonor = (id) => request(`/donors/${id}`);
export const getDonorClock = (id) => request(`/donors/${id}/clock`);
export const registerDonor = (data) => request('/donors/register', { method: 'POST', body: JSON.stringify(data) });
export const rankEmergency = (data) => request('/donors/rank-emergency', { method: 'POST', body: JSON.stringify(data) });

// Patient portal
export const getPatient = (id) => request(`/patients/${id}`);
export const createBridge = (patientId, size = 8) => request(`/patients/${patientId}/bridge`, { method: 'POST', body: JSON.stringify({ size }) });

// Agent / orchestrator
export const triggerTransfusion = (patientId) => request(`/agent/transfusion-due/${patientId}`, { method: 'POST' });
export const triggerEmergency = (data) => request('/agent/emergency', { method: 'POST', body: JSON.stringify(data) });
export const getAgentRequests = () => request('/agent/requests');
export const getAgentEvents = (limit = 50) => request(`/agent/events?limit=${limit}`);
export const getAgentOutcomes = (requestId) => request(`/agent/outcomes${requestId ? `?request_id=${requestId}` : ''}`);
export const getAgentLearning = () => request('/agent/learning');
export const reviewRequest = (id) => request(`/agent/review/${id}`);

// Supply
export const getSupplyBanks = (bloodGroup, district = 'Hyderabad') => request(`/supply/banks?blood_group=${encodeURIComponent(bloodGroup)}&district=${encodeURIComponent(district)}`);
export const getRegionalSupply = (state = 'Telangana') => request(`/supply/regional?state=${encodeURIComponent(state)}`);
export const getMobilization = () => request('/supply/mobilization');
export const getPatientMap = (bloodGroup, district = 'Hyderabad') => request(`/supply/patient-map?blood_group=${encodeURIComponent(bloodGroup)}&district=${encodeURIComponent(district)}`);
