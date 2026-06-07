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
  // Shared signed-in id: portals set it on lookup; assistant + community use it.
  const [userId, setUserId] = useState(null);

  if (!role) {
    return <LandingPage onSelectRole={setRole} />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navbar role={role} onLogout={() => { setRole(null); setUserId(null); }} />
        <Routes>
          <Route path="/" element={
            role === 'admin' ? <Navigate to="/admin" replace /> :
            role === 'donor' ? <Navigate to="/donor" replace /> :
            <Navigate to="/patient" replace />
          } />
          <Route path="/admin/*" element={role === 'admin' ? <AdminDashboard /> : <Navigate to="/" replace />} />
          <Route path="/donor/*" element={<DonorPortal userId={userId} setUserId={setUserId} />} />
          <Route path="/patient/*" element={<PatientPortal userId={userId} setUserId={setUserId} />} />
        </Routes>
        <ChatWidget role={role} userId={userId} />
      </div>
    </BrowserRouter>
  );
}
