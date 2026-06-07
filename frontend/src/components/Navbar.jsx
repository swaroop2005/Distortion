import { Link, useLocation } from 'react-router-dom';

const roleLabels = { admin: 'Command Center', donor: 'Donor Portal', patient: 'Patient Portal' };

const navLinks = {
  admin: [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/bridges', label: 'Bridges' },
    { to: '/admin/agents', label: 'Agent Feed' },
    { to: '/admin/supply', label: 'Supply' },
  ],
  donor: [
    { to: '/donor', label: 'My Status' },
    { to: '/donor/register', label: 'Register' },
  ],
  patient: [
    { to: '/patient', label: 'My Bridges' },
  ],
};

export default function Navbar({ role, onLogout }) {
  const location = useLocation();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center">
                <span className="text-white font-black text-sm">T</span>
              </div>
              <span className="font-extrabold text-gray-900 tracking-tight">
                Thal<span className="text-rose-600">Net</span>
              </span>
            </Link>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest hidden sm:block">
              {roleLabels[role]}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {(navLinks[role] || []).map(link => {
              const active = location.pathname === link.to ||
                (link.to !== `/${role}` && location.pathname.startsWith(link.to));
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-rose-50 text-rose-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    </nav>
  );
}
