import { useState } from 'react';

export default function LandingPage({ onSelectRole }) {
  const [hoveredRole, setHoveredRole] = useState(null);

  const roles = [
    {
      id: 'admin',
      title: 'Command Center',
      subtitle: 'Blood Bank Administrator',
      desc: 'Live bridge monitoring, autonomous agent feed, supply analytics, churn alerts.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
        </svg>
      ),
    },
    {
      id: 'donor',
      title: 'Donor Portal',
      subtitle: 'Blood Donor',
      desc: 'Track donation eligibility, view your clock countdown, respond to bridge requests.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      ),
    },
    {
      id: 'patient',
      title: 'Patient Portal',
      subtitle: 'Thalassemia Patient',
      desc: 'View your Auto-Bridge, track transfusion schedule, see assigned donors.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-rose-50 flex flex-col">
      <header className="pt-8 pb-4 px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-200">
            <span className="text-white font-black text-xl">T</span>
          </div>
        </div>
        <h1 className="text-5xl sm:text-6xl font-black text-gray-900 tracking-tight mb-3">
          Thal<span className="text-rose-600">Net</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-md mx-auto leading-relaxed">
          AI-powered blood support network for thalassemia patients.
          Every bridge saves a life.
        </p>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 pt-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full">
          {roles.map(role => (
            <button
              key={role.id}
              onClick={() => onSelectRole(role.id)}
              onMouseEnter={() => setHoveredRole(role.id)}
              onMouseLeave={() => setHoveredRole(null)}
              className={`group relative text-left p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                hoveredRole === role.id
                  ? 'border-rose-300 bg-white shadow-xl shadow-rose-100 scale-[1.02]'
                  : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'
              }`}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                hoveredRole === role.id ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-600'
              }`}>
                {role.icon}
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 mb-1">{role.title}</h3>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{role.subtitle}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{role.desc}</p>
              <div className={`mt-4 flex items-center gap-1 text-sm font-bold transition-colors ${
                hoveredRole === role.id ? 'text-rose-600' : 'text-gray-400'
              }`}>
                Enter
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </main>

      <footer className="py-6 text-center border-t border-gray-100">
        <p className="text-xs text-gray-400">
          ThalNet — AI4Good 2.0 Hackathon, Team Distortion
        </p>
      </footer>
    </div>
  );
}
