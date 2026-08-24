import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink, useLocation, Link } from 'react-router-dom';
import { supabase, getSession, getCurrentUserProfile, signOut, applyPendingReferralIfAny } from './lib/supabaseClient.js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import Icon from './components/Icon.jsx';
import QuickSearchOverlay from './components/QuickSearchOverlay.jsx';
import AccountStatusBanner from './components/AccountStatusBanner.jsx';
import SuspendedScreen from './components/SuspendedScreen.jsx';
import UpdatesPopup from './components/UpdatesPopup.jsx';
import AddTypeSheet from './components/AddTypeSheet.jsx';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  // Intercepte le retour vers l'app après une authentification externe
  // (Google via Chrome Custom Tabs, ou lien de confirmation d'email) —
  // sans ça, Google/Supabase renvoient l'utilisateur vers hey-did.fr dans
  // le navigateur, en le laissant "sorti" de l'app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const sub = CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
      await Browser.close().catch(() => {});
      try {
        const parsed = new URL(url.replace('fr.heydid.app://', 'https://placeholder/'));
        const code = parsed.searchParams.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else {
          // Repli sur l'ancien format (jetons dans le fragment d'URL)
          const hash = url.split('#')[1];
          if (hash) {
            const params = new URLSearchParams(hash);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            if (access_token && refresh_token) {
              await supabase.auth.setSession({ access_token, refresh_token });
            }
          }
        }
        navigate('/dashboard', { replace: true });
        window.location.reload(); // s'assure que le profil se recharge avec la nouvelle session
      } catch (err) {
        console.error('Erreur lors du retour d\'authentification :', err);
      }
    });

    return () => { sub.then((s) => s.remove()); };
  }, []);

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
      // Compte les échéances à surveiller : bientôt expirées ET déjà
      // expirées (pas de borne basse) — doit correspondre exactement à
      // ce que le popover de la cloche affiche, sinon le badge et son
      // contenu se contredisent (ex: badge "2" mais 3 items affichés).
      if (p?.organization_id) {
        const in60 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const [{ count: pc }, { count: cc }] = await Promise.all([
          supabase.from('purchases').select('id', { count: 'exact', head: true })
            .eq('organization_id', p.organization_id)
            .not('warranty_end_date', 'is', null)
            .lte('warranty_end_date', in60),
          supabase.from('contracts').select('id', { count: 'exact', head: true })
            .eq('organization_id', p.organization_id)
            .is('cancelled_at', null)
            .not('end_date', 'is', null)
            .lte('end_date', in60),
        ]);
        setAlertCount((pc || 0) + (cc || 0));
      }
    })();
  }, [navigate]);

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

  // Blocage complet pour un compte suspendu : aucune donnée, aucune
  // navigation — seulement un écran de contact. Le statut 'read_only'
  // n'est volontairement PAS bloqué ici : il reste géré par
  // AccountStatusBanner plus bas, qui laisse l'accès en lecture.
  if (profile?.organizations?.status === 'suspended') {
    return <SuspendedScreen profile={profile} onSignOut={handleSignOut} />;
  }

  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  // Navigation unifiée : les mêmes 5 destinations, que ce soit dans la
  // sidebar (desktop) ou la bottom nav (mobile) — plus de contenu
  // "exclusif" caché dans un tiroir, ce qui a fini par ne plus rien
  // contenir d'utile une fois Inviter/FAQ/Paramètres déplacés dans
  // Mon compte et Docs en attente accessible depuis le tableau de bord.
  const navItems = [
    { to: '/dashboard', icon: 'layout-dashboard', label: "Aujourd'hui" },
    { to: '/discussions', icon: 'sparkles', label: 'Did' },
    { to: '/documents', icon: 'folder', label: 'Documents' },
  ];

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''}`} id="shell">

      <div className="mobile-topbar">
        <Link to="/dashboard" className="mobile-topbar-logo">
          <div className="mark"></div>
          <div className="word">Hey Did</div>
        </Link>
        <div className="mobile-topbar-icons">
          <button className="ph-icon-btn" onClick={() => setQuickSearchOpen(true)} aria-label="Recherche rapide">
            <Icon name="search" />
          </button>
          <button className="ph-icon-btn" onClick={() => navigate('/faq')} aria-label="Aide">
            <Icon name="info-circle" />
          </button>
          <button className="ph-icon-btn ph-bell" onClick={() => navigate('/search?sort=expiry_asc')} aria-label="Échéances">
            <Icon name="bell" />
            {alertCount > 0 && <span className="ph-badge">{alertCount > 9 ? '9+' : alertCount}</span>}
          </button>
        </div>
      </div>

      <aside className="sidebar">
        <div className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          <Icon name="chevron-left" />
        </div>
        <div className="sidebar-logo">
          <div className="mark"></div>
          <div className="word">Hey Did</div>
        </div>

        {/* Zone de navigation : seule cette partie défile si le contenu
            dépasse la hauteur disponible — le pied de compte, lui, reste
            toujours à sa place en bas, sans jamais avoir besoin de scroller. */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setQuickSearchOpen(true)}
            className="nav-item"
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            <Icon name="search" />
            <span>Rechercher</span>
          </button>
          <button
            type="button"
            onClick={() => setAddSheetOpen(true)}
            className="nav-item"
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            <Icon name="plus" />
            <span>Scanner</span>
          </button>
        </div>

        {/* Pied de compte : nom visible en permanence, les 3 actions
            n'apparaissent qu'au clic (comme avant), pour ne pas surcharger
            visuellement la sidebar en permanence. */}
        <div
          className="sidebar-footer"
          style={{ cursor: 'pointer', position: 'relative', flexShrink: 0 }}
          onClick={() => setAccountMenuOpen(!accountMenuOpen)}
        >
          <div className="avatar">{initials}</div>
          {!collapsed && (
            <div>
              <div className="name">{profile?.full_name || 'Mon compte'}</div>
              <div className="role">{profile?.organizations?.name || 'Mon foyer'}</div>
            </div>
          )}
          {!collapsed && <Icon name="chevron-up" className="collapse-hide" style={{ marginLeft: 'auto', color: 'var(--ink-faint)', fontSize: 16 }} />}

          {accountMenuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={(e) => { e.stopPropagation(); setAccountMenuOpen(false); }} />
              <div style={{
                position: 'absolute', bottom: 56, left: 0, width: 220,
                background: 'var(--white)', borderRadius: 'var(--radius-m)',
                boxShadow: '0 14px 32px rgba(10,11,40,0.3)', overflow: 'hidden', zIndex: 20,
              }}>
                <NavLink to="/account" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>
                  <Icon name="user-circle" /> Mon compte
                </NavLink>
                <NavLink to="/settings" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', borderTop: '1px solid var(--line)' }}>
                  <Icon name="settings" /> Paramètres
                </NavLink>
                <div onClick={handleSignOut} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                  fontSize: 13.5, fontWeight: 500, color: 'var(--red-text)',
                  borderTop: '1px solid var(--line)',
                }}>
                  <Icon name="logout" /> Déconnexion
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      <main className="main">
        <AccountStatusBanner profile={profile} />
        <Outlet context={{ profile, setProfile, openQuickSearch: () => setQuickSearchOpen(true), alertCount }} />
      </main>

      <UpdatesPopup profileId={profile?.id} />

      <nav className="bottom-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Icon name="layout-dashboard" />
          <span>Aujourd'hui</span>
        </NavLink>
        <NavLink to="/discussions" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Icon name="sparkles" />
          <span>Did</span>
        </NavLink>
        <NavLink to="/add-purchase" className="bottom-nav-item primary" onClick={(e) => { e.preventDefault(); setAddSheetOpen(true); }}>
          <Icon name="plus" />
          <span>Scanner</span>
        </NavLink>
        <NavLink to="/documents" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Icon name="folder" />
          <span>Documents</span>
        </NavLink>
        <NavLink to="/account" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <div className="avatar" style={{ width: 20, height: 20, fontSize: 9.5 }}>{initials}</div>
          <span>Compte</span>
        </NavLink>
      </nav>

      {addSheetOpen && <AddTypeSheet onClose={() => setAddSheetOpen(false)} />}

      {quickSearchOpen && (
        <QuickSearchOverlay orgId={profile?.organization_id} onClose={() => setQuickSearchOpen(false)} />
      )}

    </div>
  );
}
