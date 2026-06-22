import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';

// ============================================================
// PageHeader — header façon app moderne (Linear / Stripe)
// Titre + sous-titre flottants sur fond de page, sans encadré.
// Loupe et cloche à droite, boutons d'action inline.
//
// Props :
//   title         — titre H1 de la page
//   subtitle      — phrase descriptive sous le titre
//   onSearchClick — callback pour ouvrir la recherche rapide
//   alertCount    — nombre d'alertes actives (badge sur la cloche)
//   actions       — tableau optionnel [{ label, icon, to, onClick, variant }]
//   backTo        — chemin pour un bouton retour (optionnel)
// ============================================================

export default function PageHeader({ title, subtitle, onSearchClick, alertCount = 0, actions = [], backTo }) {
  const navigate = useNavigate();

  return (
    <div className="ph">
      <div className="ph-left">
        {backTo && (
          <button className="ph-back" onClick={() => navigate(backTo || -1)} aria-label="Retour">
            <Icon name="arrow-left" />
          </button>
        )}
        <div>
          <h1 className="ph-title">{title}</h1>
          {subtitle && <p className="ph-sub">{subtitle}</p>}
        </div>
      </div>

      <div className="ph-right">
        <button className="ph-icon-btn" onClick={onSearchClick} aria-label="Recherche rapide (⌘K)">
          <Icon name="search" />
        </button>

        <button className="ph-icon-btn ph-bell" aria-label="Alertes">
          <Icon name="bell" />
          {alertCount > 0 && <span className="ph-badge">{alertCount > 9 ? '9+' : alertCount}</span>}
        </button>

        {actions.map((action, i) => (
          <button
            key={i}
            className={`ph-action ${action.variant === 'ghost' ? 'ghost' : action.variant === 'secondary' ? 'secondary' : ''}`}
            onClick={action.onClick || (() => navigate(action.to))}
          >
            <Icon name={action.icon} />
            <span className="ph-action-label">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
