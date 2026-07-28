import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { FeedbackModal } from './FeedbackButton.jsx';

// Remplace l'ancien bouton "?" qui menait directement à la FAQ.
// "Poser une question à Didier" réutilise le vrai formulaire de contact
// déjà existant (submit-feedback) — pas de fausse fonctionnalité de chat
// qui n'existe pas encore dans l'app.
export default function HelpMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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
              onClick={() => { setOpen(false); setFeedbackOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <Icon name="sparkles" style={{ fontSize: 13, color: 'var(--blue)' }} />
              Poser une question à Didier
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
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}
