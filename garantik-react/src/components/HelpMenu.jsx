import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';

// "Poser une question à Did" mène maintenant vers la vraie page de
// discussion (qui répond avec les vraies données de l'utilisateur),
// plus vers le formulaire de remontée générique.
export default function HelpMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="ph-icon-btn"
        onClick={() => setOpen(!open)}
        aria-label="Aide"
        title="Aide"
        style={{ fontWeight: 800 }}
      >
        ?
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={() => setOpen(false)} />
          <div className="sort-dropdown" style={{ minWidth: 220 }}>
            <div
              className="sort-dropdown-item"
              onClick={() => { setOpen(false); navigate('/discussions'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <Icon name="sparkles" style={{ fontSize: 13, color: 'var(--blue)' }} />
              Poser une question à Did
            </div>
            <div
              className="sort-dropdown-item"
              onClick={() => { setOpen(false); navigate('/faq'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <Icon name="info-circle" style={{ fontSize: 13, color: 'var(--blue)' }} />
              Consulter la FAQ
            </div>
          </div>
        </>
      )}
    </div>
  );
}
