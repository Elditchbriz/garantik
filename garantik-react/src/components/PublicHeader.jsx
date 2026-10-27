import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isNativeApp } from '../lib/platform.js';

// En-tête COMMUN du site vitrine (accueil, blog, articles, associations, pages légales) : mêmes liens, même menu mobile, partout.
// Il ne s'affiche qu'à un VISITEUR : une personne connectée voit les menus de l'application (voir PublicShell).
// - Le lien de la page affichée est mis en évidence (déduit de l'adresse, ou imposé par la prop « active »).
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
  const native = isNativeApp();
  const current = active !== undefined ? active : (pathname.startsWith('/blog') ? 'blog' : pathname.startsWith('/associations') ? 'associations' : null);

  const items = [
    ...(native ? [] : SECTIONS.map((s) => ({ key: s.hash, label: s.label, to: { pathname: '/', hash: `#${s.hash}` } }))),
    ...PAGES,
  ];
  const close = () => setOpen(false);
  const activeStyle = (key) => (key === current ? { color: 'var(--navy)', fontWeight: 600 } : undefined);
  const onLogo = () => { close(); if (pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <header className="lp-header">
      <div className="lp-header-inner">
        <Link to="/" className="lp-logo" onClick={onLogo}>
          <div className="word"><span className="word-hey">Hey</span> <span className="word-did">Did</span></div>
        </Link>
        <nav className="lp-nav" aria-label="Navigation principale">
          {items.map((it) => (
            <Link key={it.key} to={it.to} style={activeStyle(it.key)} aria-current={it.key === current ? 'page' : undefined}>{it.label}</Link>
          ))}
        </nav>
        <div className="lp-header-actions">
          <Link to="/auth" className="btn btn-ghost lp-btn-login">Se connecter</Link>
          <Link to="/auth?mode=signup" className="btn btn-primary lp-btn-signup">Commencer avec Did</Link>
          <button className="lp-burger" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      {open && (
        <div className="lp-mobile-nav">
          {items.map((it) => (
            <Link key={it.key} to={it.to} onClick={close} style={activeStyle(it.key)} aria-current={it.key === current ? 'page' : undefined}>{it.label}</Link>
          ))}
          <Link to="/auth" className="btn btn-ghost" style={{ justifyContent: 'center' }} onClick={close}>Se connecter</Link>
          <Link to="/auth?mode=signup" className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={close}>Commencer avec Did</Link>
        </div>
      )}
    </header>
  );
}
