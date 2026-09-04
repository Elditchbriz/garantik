import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink, useLocation, Link } from 'react-router-dom';
import { supabase, getSession, getCurrentUserProfile, signOut, applyPendingReferralIfAny } from './lib/supabaseClient.js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import Icon from './components/Icon.jsx';
import HelpMenu from './components/HelpMenu.jsx';
import QuickSearchOverlay from './components/QuickSearchOverlay.jsx';
import AccountStatusBanner from './components/AccountStatusBanner.jsx';
import SuspendedScreen from './components/SuspendedScreen.jsx';
import UpdatesPopup from './components/UpdatesPopup.jsx';
import AddTypeSheet from './components/AddTypeSheet.jsx';
import BiometricLockScreen, { isBiometricLockEnabled } from './components/BiometricLockScreen.jsx';

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
  const [alertItems, setAlertItems] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [biometricLocked, setBiometricLocked] = useState(false);

  // Remet le défilement à zéro à chaque changement de page. Sans ça,
  // comme c'est .main qui défile (pas la fenêtre), React Router ne le
  // sait pas et laisse le défilement de l'ancienne page — la nouvelle
  // page s'affiche alors partiellement "coupée" en haut, comme si on
  // avait déjà scrollé, jusqu'à ce qu'on scrolle manuellement.
  useEffect(() => {
    const mainEl = document.querySelector('.main');
    if (mainEl) mainEl.scrollTop = 0;
  }, [location.pathname]);

  // Verrouillage biométrique — vérifié à l'ouverture de l'app ET chaque
  // fois qu'elle revient au premier plan. Un "verifyingRef" évite un piège
  // classique : l'affichage de la boîte de dialogue biométrique fait
  // passer l'app brièvement en arrière-plan puis revenir au premier plan,
  // ce qui redéclencherait le verrou juste après l'avoir levé avec succès.
  const biometricVerifyingRef = React.useRef(false);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (isBiometricLockEnabled()) {
      biometricVerifyingRef.current = true;
      setBiometricLocked(true);
    }

    const sub = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (biometricVerifyingRef.current) return; // ignore le va-et-vient de la boîte de dialogue elle-même
      if (isActive && isBiometricLockEnabled()) {
        biometricVerifyingRef.current = true;
        setBiometricLocked(true);
      }
    });
    return () => { sub.then((s) => s.remove()); };
  }, []);

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
      // Récupère les échéances à surveiller : bientôt expirées ET déjà
      // expirées (pas de borne basse) — alimente à la fois le badge de la
      // cloche et son menu déroulant, donc toujours cohérents entre eux.
      if (p?.organization_id) {
        const in60 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const [{ data: pd }, { data: cd }] = await Promise.all([
          supabase.from('purchases').select('id, object_name, warranty_end_date')
            .eq('organization_id', p.organization_id)
            .not('warranty_end_date', 'is', null)
            .lte('warranty_end_date', in60),
          supabase.from('contracts').select('id, name, end_date')
            .eq('organization_id', p.organization_id)
            .is('cancelled_at', null)
            .not('end_date', 'is', null)
            .lte('end_date', in60),
        ]);
        const items = [
          ...(pd || []).map((p2) => ({ id: p2.id, type: 'purchase', name: p2.object_name, endDate: p2.warranty_end_date })),
          ...(cd || []).map((c) => ({ id: c.id, type: 'contract', name: c.name, endDate: c.end_date })),
        ].sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
        setAlertItems(items);
        setAlertCount(items.length);
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
    <>
      {biometricLocked && (
        <BiometricLockScreen onUnlock={() => { biometricVerifyingRef.current = false; setBiometricLocked(false); }} />
      )}
    <div className={`shell ${collapsed ? 'collapsed' : ''}`} id="shell">

      <div className="mobile-topbar">
        <Link to="/dashboard" className="mobile-topbar-logo">
          <div className="word"><span className="word-hey">Hey</span> <span className="word-did">Did</span></div>
        </Link>
        <div className="mobile-topbar-icons">
          <button className="ph-icon-btn" onClick={() => setQuickSearchOpen(true)} aria-label="Recherche rapide">
            <Icon name="search" />
          </button>
          <HelpMenu />
          <div style={{ position: 'relative' }}>
            <button className="ph-icon-btn ph-bell" onClick={() => setNotifOpen(!notifOpen)} aria-label="Échéances">
              <Icon name="bell" />
              {alertCount > 0 && <span className="ph-badge">{alertCount > 9 ? '9+' : alertCount}</span>}
            </button>
            {notifOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={() => setNotifOpen(false)} />
                <div className="sort-dropdown" style={{ minWidth: 280, right: 0 }}>
                  <div style={{ padding: '12px 14px 8px', fontSize: 12.5, fontWeight: 800, color: 'var(--navy)', borderBottom: '1px solid var(--line)' }}>
                    Échéances
                  </div>
                  {alertItems.length === 0 ? (
                    <div style={{ padding: '20px 14px', fontSize: 12.5, color: 'var(--ink-faint)', textAlign: 'center' }}>
                      👍 Tout est sous contrôle, rien à signaler.
                    </div>
                  ) : (
                    alertItems.slice(0, 5).map((item) => {
                      const isExpired = new Date(item.endDate) < new Date();
                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          className="sort-dropdown-item"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}
                          onClick={() => { setNotifOpen(false); navigate(item.type === 'purchase' ? `/purchase/${item.id}` : `/contract/${item.id}`); }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                              {isExpired ? 'Expirée' : 'fin'} {new Date(item.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                          <span className={`badge ${isExpired ? 'red' : 'amber'}`} style={{ flexShrink: 0 }}>{isExpired ? 'Expirée' : 'Bientôt'}</span>
                        </div>
                      );
                    })
                  )}
                  {alertItems.length > 0 && (
                    <div
                      className="sort-dropdown-item"
                      style={{ textAlign: 'center', fontWeight: 700, color: 'var(--blue)', cursor: 'pointer', borderTop: '1px solid var(--line)' }}
                      onClick={() => { setNotifOpen(false); navigate('/search?sort=expiry_asc'); }}
                    >
                      Voir toutes les échéances
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
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
    </>
  );
}
