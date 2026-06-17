import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { getSession, getCurrentUserProfile, signOut } from './lib/supabaseClient.js';
import Icon from './components/Icon.jsx';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) {
        navigate('/auth', { replace: true });
        return;
      }
      const p = await getCurrentUserProfile();
      if (!p) {
        navigate('/auth', { replace: true });
        return;
      }
      setProfile(p);
      setLoading(false);
    })();
  }, [navigate]);

  async function handleSignOut() {
    await signOut();
    navigate('/auth', { replace: true });
  }

  if (loading) {
    return <div style={{ padding: 40 }}>Chargement…</div>;
  }

  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const navItems = [
    { section: 'Principal', items: [
      { to: '/dashboard', icon: 'layout-dashboard', label: 'Tableau de bord' },
      { to: '/add-purchase', icon: 'plus', label: 'Ajouter un achat' },
    ]},
  ];

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} id="shell">

      <div className="mobile-topbar">
        <div className="mobile-topbar-logo">
          <div className="mark"></div>
          <div className="word">Garantik</div>
        </div>
        <div className="mobile-burger" onClick={() => setMobileOpen(!mobileOpen)}>
          <Icon name="menu-2" />
        </div>
      </div>
      <div className="sidebar-overlay" onClick={() => setMobileOpen(false)}></div>

      <aside className="sidebar">
        <div className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          <Icon name="chevron-left" />
        </div>
        <div className="sidebar-logo">
          <div className="mark"></div>
          <div className="word">Garantik</div>
        </div>

        {navItems.map((section) => (
          <React.Fragment key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </React.Fragment>
        ))}

        <div
          className="sidebar-footer"
          style={{ cursor: 'pointer', position: 'relative' }}
          onClick={() => setAccountMenuOpen(!accountMenuOpen)}
        >
          <div className="avatar">{initials}</div>
          <div>
            <div className="name">{profile?.full_name || 'Mon compte'}</div>
            <div className="role">{profile?.organizations?.name || 'Mon foyer'}</div>
          </div>
          <Icon name="chevron-up" className="collapse-hide" style={{ marginLeft: 'auto', color: '#8A9AB8', fontSize: 16 }} />

          {accountMenuOpen && (
            <div style={{
              position: 'absolute', bottom: 56, left: 0, width: 220,
              background: 'var(--white)', borderRadius: 'var(--radius-m)',
              boxShadow: '0 14px 32px rgba(10,11,40,0.3)', overflow: 'hidden', zIndex: 20,
            }}>
              <div onClick={handleSignOut} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                fontSize: 13.5, fontWeight: 500, color: 'var(--red-text)',
              }}>
                <Icon name="logout" /> Déconnexion
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <Outlet context={{ profile, setProfile }} />
      </main>
    </div>
  );
}
