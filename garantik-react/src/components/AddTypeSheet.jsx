import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import useFocusTrap from '../hooks/useFocusTrap.js';

// Tiroir déclenché par le bouton "+" central de la bottom nav et par
// l'action rapide "Ajouter" du tableau de bord. Remplace l'ancien accès
// direct à /add-purchase : l'utilisateur choisit d'abord le type, ce qui
// évite de se retrouver sur le mauvais formulaire (garantie vs contrat).
export default function AddTypeSheet({ onClose }) {
  const navigate = useNavigate();
  const trapRef = useFocusTrap(onClose);

  function go(path) {
    onClose();
    navigate(path);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" ref={trapRef} tabIndex={-1} style={{ maxWidth: 420, width: '95vw' }}>
        <div className="modal-top">
          <div className="modal-close" onClick={onClose}><Icon name="x" /></div>
          <div className="modal-icon"><Icon name="plus" /></div>
          <h3>Que voulez-vous ajouter ?</h3>
          <p>Choisissez le type, on s'occupe du scan juste après</p>
        </div>
        <div className="modal-body">
          <div className="item-card" onClick={() => go('/add-purchase')} style={{ cursor: 'pointer' }}>
            <div className="dash-add-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}>
              <Icon name="shield-check" />
            </div>
            <div className="dash-item-body">
              <div className="dash-item-name">Une garantie</div>
              <div className="dash-item-meta">Achat, appareil, produit…</div>
            </div>
            <Icon name="chevron-right" style={{ color: 'var(--ink-faint)' }} />
          </div>
          <div className="item-card" onClick={() => go('/add-contract')} style={{ cursor: 'pointer', marginTop: 10 }}>
            <div className="dash-add-icon" style={{ background: 'var(--green-pale)', color: 'var(--green-text)' }}>
              <Icon name="file-text" />
            </div>
            <div className="dash-item-body">
              <div className="dash-item-name">Un contrat</div>
              <div className="dash-item-meta">Assurance, box, énergie…</div>
            </div>
            <Icon name="chevron-right" style={{ color: 'var(--ink-faint)' }} />
          </div>
          <div className="item-card" onClick={() => go('/add-contract?type=Abonnement')} style={{ cursor: 'pointer', marginTop: 10 }}>
            <div className="dash-add-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}>
              <Icon name="repeat" />
            </div>
            <div className="dash-item-body">
              <div className="dash-item-name">Un abonnement</div>
              <div className="dash-item-meta">Netflix, salle de sport…</div>
            </div>
            <Icon name="chevron-right" style={{ color: 'var(--ink-faint)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
