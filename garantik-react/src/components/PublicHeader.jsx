import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { isNativeApp } from '../lib/platform.js';

// En-tête COMMUN des pages publiques (accueil, blog, articles, associations) : mêmes liens, même menu mobile, sur toutes les pages.
// Avant, chaque page avait le sien : le blog et les associations perdaient les liens de l'accueil, et le blog n'avait pas de menu mobile.
//
// - « active » met en évidence le lien de la page affichée ('blog' ou 'associations').
// - Un visiteur déjà connecté voit « Mon espace » à la place de « Se connecter / Commencer avec Did ».
// - Dans l'application Android, l'accueil n'est jamais affiché (elle renvoie vers la connexion ou le tableau de bord) : ses sections
//   (Fonctionnalités, Comment ça marche, Tarifs) n'y sont donc pas proposées.
const SECTIONS = [
  { hash: 'fonctionnalites', label: 'Fonctionnalités' },
  { hash: 'comment-ca-marche', label: 'Comment ça marche' },
  { hash: 'tarifs', label: 'Tarifs' },
];
const PAGES = [
  { key: 'blog', label: 'Blog', to: '/blog' },
  { key: 'associations', label: 'Associations', to: '/associations' },
];

export default function PublicHeader({ active }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const native = isNativeApp();

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (alive) setLoggedIn(!!(data && data.session)); })
      .catch(() => {});   // en cas d'échec on garde l'en-tête « visiteur » : il fonctionne dans tous les cas
    return () => { alive = false; };
  }, []);

  const items = [
    ...(native ? [] : SECTIONS.map((s) => ({ key: s.hash, label: s.label, to: { pathname: '/', hash: `#${s.hash}` } }))),
    ...PAGES,
  ];
  const close = () => setOpen(false);
  const activeStyle = (key) => (key === active ? { color: 'var(--navy)', fontWeight: 600 } : undefined);
  const onLogo = () => { close(); if (!loggedIn && pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <header className="lp-header">
      <div className="lp-header-inner">
        <Link to={loggedIn ? '/dashboard' : '/'} className="lp-logo" onClick={onLogo}>
          <div className="mark" style={{ width: 32, height: 32 }}></div>
          <div className="word"><span className="word-hey">Hey</span> <span className="word-did">Did</span></div>
        </Link>
        <nav className="lp-nav" aria-label="Navigation principale">
          {items.map((it) => (
            <Link key={it.key} to={it.to} style={activeStyle(it.key)} aria-current={it.key === active ? 'page' : undefined}>{it.label}</Link>
          ))}
        </nav>
        <div className="lp-header-actions">
          {loggedIn ? (
            <Link to="/dashboard" className="btn btn-primary">Mon espace</Link>
          ) : (
            <>
              <Link to="/auth" className="btn btn-ghost lp-btn-login">Se connecter</Link>
              <Link to="/auth?mode=signup" className="btn btn-primary lp-btn-signup">Commencer avec Did</Link>
            </>
          )}
          <button className="lp-burger" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      {open && (
        <div className="lp-mobile-nav">
          {items.map((it) => (
            <Link key={it.key} to={it.to} onClick={close} style={activeStyle(it.key)} aria-current={it.key === active ? 'page' : undefined}>{it.label}</Link>
          ))}
          {loggedIn ? (
            <Link to="/dashboard" className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={close}>Mon espace</Link>
          ) : (
            <>
              <Link to="/auth" className="btn btn-ghost" style={{ justifyContent: 'center' }} onClick={close}>Se connecter</Link>
              <Link to="/auth?mode=signup" className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={close}>Commencer avec Did</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
