import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { getSession, getCurrentUserProfile, signOut, applyPendingReferralIfAny } from './lib/supabaseClient.js';
import Icon from './components/Icon.jsx';
import QuickSearchOverlay from './components/QuickSearchOverlay.jsx';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) { navigate('/auth', { replace: true }); return; }
      const p = await getCurrentUserProfile();
      if (!p) { navigate('/auth', { replace: true }); return; }
      if (p.organization_id) {
        await applyPendingReferralIfAny(p.organization_id);
      }
      setProfile(p);
      setLoading(false);
    })();
  }, [navigate]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Raccourci clavier Ctrl/Cmd+K pour ouvrir la recherche rapide
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setQuickSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate('/auth', { replace: true });
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--ink-faint)' }}>
        Chargement…
      </div>
    );
  }

  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  const navItems = [
    { to: '/dashboard', icon: 'layout-dashboard', label: 'Accueil' },
    { to: '/search', icon: 'search', label: 'Rechercher' },
    { to: '/documents', icon: 'folder', label: 'Documents' },
    { to: '/settings', icon: 'settings', label: 'Paramètres' },
  ];

  const sidebarItems = [
    { section: 'Principal', items: [
      { to: '/dashboard', icon: 'layout-dashboard', label: 'Tableau de bord' },
      { to: '/search', icon: 'search', label: 'Recherche avancée' },
      { to: '/contracts', icon: 'calendar-check', label: 'Échéances' },
      { to: '/documents', icon: 'folder', label: 'Documents' },
    ]},
    { section: 'Compte', items: [
      { to: '/invite', icon: 'heart-handshake', label: 'Inviter des amis' },
      { to: '/settings', icon: 'settings', label: 'Paramètres' },
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

        {sidebarItems.map((section) => (
          <React.Fragment key={section.section}>
            {!collapsed && <div className="nav-section-label">{section.section}</div>}
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
          {!collapsed && (
            <div>
              <div className="name">{profile?.full_name || 'Mon compte'}</div>
              <div className="role">{profile?.organizations?.name || 'Mon foyer'}</div>
            </div>
          )}
          {!collapsed && <Icon name="chevron-up" className="collapse-hide" style={{ marginLeft: 'auto', color: '#8A9AB8', fontSize: 16 }} />}

          {accountMenuOpen && (
            <div style={{
              position: 'absolute', bottom: 56, left: 0, width: 220,
              background: 'var(--white)', borderRadius: 'var(--radius-m)',
              boxShadow: '0 14px 32px rgba(10,11,40,0.3)', overflow: 'hidden', zIndex: 20,
            }}>
              <NavLink to="/account" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>
                <Icon name="user-circle" /> Mon compte
              </NavLink>
              <div onClick={handleSignOut} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                fontSize: 13.5, fontWeight: 500, color: 'var(--red-text)',
                borderTop: '1px solid var(--line)',
              }}>
                <Icon name="logout" /> Déconnexion
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <Outlet context={{ profile, setProfile, openQuickSearch: () => setQuickSearchOpen(true) }} />
      </main>

      <nav className="bottom-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <NavLink to="/add-purchase" className="bottom-nav-item primary">
          <Icon name="plus" />
          <span>Ajouter</span>
        </NavLink>
      </nav>

      {quickSearchOpen && (
        <QuickSearchOverlay orgId={profile?.organization_id} onClose={() => setQuickSearchOpen(false)} />
      )}

    </div>
  );
}
