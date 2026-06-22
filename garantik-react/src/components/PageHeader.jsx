import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';

// ============================================================
// PageHeader — bandeau compact universel
// Remplace l'ancien .topbar volumineux. Contient : titre court,
// loupe de recherche rapide, et jusqu'à 2 boutons d'action.
//
// Props :
//   title        — titre court de la page (obligatoire)
//   onSearchClick — callback pour ouvrir la recherche rapide (obligatoire)
//   actions      — tableau optionnel de { label, icon, to, onClick, variant }
// ============================================================

export default function PageHeader({ title, onSearchClick, actions = [] }) {
  const navigate = useNavigate();

  return (
    <div className="page-header">
      <h1 className="page-header-title">{title}</h1>

      <div className="page-header-actions">
        <button
          className="page-header-search-btn"
          onClick={onSearchClick}
          aria-label="Recherche rapide"
        >
          <Icon name="search" />
        </button>

        {actions.map((action, i) => (
          <button
            key={i}
            className={`page-header-action ${action.variant === 'secondary' ? 'secondary' : ''}`}
            onClick={action.onClick || (() => navigate(action.to))}
          >
            <Icon name={action.icon} />
            <span className="page-header-action-label">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
