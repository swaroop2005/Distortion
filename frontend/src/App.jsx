import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/Landing/LandingPage';
import AdminDashboard from './pages/Admin/AdminDashboard';
import DonorPortal from './pages/Portal/DonorPortal';
import PatientPortal from './pages/Portal/PatientPortal';
import Navbar from './components/Navbar';
import ChatWidget from './components/ChatWidget';

export default function App() {
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const handleLogout = () => { setRole(null); setUserId(null); };

  if (!role) return <LandingPage onSelectRole={setRole} />;

  // Admin gets its own full-page layout with sidebar (no top Navbar, no ChatWidget)
  if (role === 'admin') {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard onLogout={handleLogout} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Navbar role={role} onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={
            role === 'donor' ? <Navigate to="/donor" replace /> : <Navigate to="/patient" replace />
          } />
          <Route path="/donor/*" element={<DonorPortal userId={userId} setUserId={setUserId} />} />
          <Route path="/patient/*" element={<PatientPortal userId={userId} setUserId={setUserId} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ChatWidget role={role} userId={userId} />
      </div>
    </BrowserRouter>
  );
}
