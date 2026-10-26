import React from 'react';
import { Link } from 'react-router-dom';
import { safeBackTo } from '../lib/safeBackTo.js';

// Bloc de titre commun aux pages « document » du site (pages légales, rétractation, suppression de compte) :
// lien « ← Retour » (seulement si l'on vient de l'application, via « ?from= », et seulement vers une adresse interne), titre, sous-titre.
export default function PublicPageTitle({ title, subtitle, backTo }) {
  const to = safeBackTo(backTo);
  return (
    <>
      {to && (
        <Link to={to} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--blue)', textDecoration: 'none',
          marginBottom: 28, fontWeight: 600, padding: '8px 14px', background: 'var(--blue-pale-2)', borderRadius: 'var(--radius-s)',
        }}>
          ← Retour
        </Link>
      )}
      <h1 style={{ fontSize: 28, fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontWeight: 800, color: 'var(--navy)', margin: '0 0 8px' }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: '0 0 40px' }}>{subtitle}</p>
      )}
    </>
  );
}
