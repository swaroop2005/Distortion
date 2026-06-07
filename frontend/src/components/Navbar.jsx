import { Link, useLocation } from 'react-router-dom';
import { Icon, Badge } from '../design';

const ROLE_LINKS = {
  donor: [
    { to: '/donor', label: 'My Status', icon: 'water_drop' },
    { to: '/donor/register', label: 'Register', icon: 'person_add' },
  ],
  patient: [
    { to: '/patient', label: 'My Bridge', icon: 'favorite' },
  ],
};

const ROLE_LABELS = { donor: 'Donor', patient: 'Patient' };

export default function Navbar({ role, onLogout }) {
  const location = useLocation();

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--line)',
      boxShadow: '0 1px 3px rgba(20,20,30,.04)',
    }}>
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 22px', display: 'flex', alignItems: 'center', height: 56, gap: 6 }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 20, textDecoration: 'none' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--red-500)', display: 'grid', placeItems: 'center' }}>
            <Icon name="water_drop" size={16} fill color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.03em', color: 'var(--ink)' }}>
            Dis<span style={{ color: 'var(--red-500)' }}>tortion</span>
          </span>
        </Link>

        {/* Role badge */}
        <Badge tone={role === 'patient' ? 'red' : 'green'} style={{ marginRight: 10 }}>
          {ROLE_LABELS[role]}
        </Badge>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {(ROLE_LINKS[role] || []).map(link => {
            const active = location.pathname === link.to ||
              (link.to !== `/${role}` && location.pathname.startsWith(link.to));
            return (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 13px', borderRadius: 10, textDecoration: 'none',
                  background: active ? 'var(--red-50)' : 'transparent',
                  color: active ? 'var(--red-600)' : 'var(--muted)',
                  fontWeight: active ? 700 : 500, fontSize: 13.5,
                  transition: 'all .15s',
                }}
              >
                <Icon name={link.icon} size={16} fill={active} color={active ? 'var(--red-500)' : 'var(--faint)'} />
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Exit */}
        <button
          onClick={onLogout}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 13px', borderRadius: 10, border: 'none',
            background: 'transparent', color: 'var(--muted)',
            fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
            transition: 'all .15s',
          }}
        >
          <Icon name="logout" size={16} color="var(--faint)" />
          Exit
        </button>
      </div>
    </nav>
  );
}
