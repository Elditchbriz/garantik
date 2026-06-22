import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';

// showSearch et showBell sont false par défaut.
// Seul le Dashboard les active explicitement.
export default function PageHeader({
  title,
  subtitle,
  onSearchClick,
  alertCount = 0,
  onBellClick,
  actions = [],
  backTo,
  showSearch = false,
  showBell = false,
}) {
  const navigate = useNavigate();

  return (
    <div className="ph">
      <div className="ph-left">
        {backTo && (
          <button className="ph-back" onClick={() => navigate(backTo)} aria-label="Retour">
            <Icon name="arrow-left" />
          </button>
        )}
        <div>
          <h1 className="ph-title">{title}</h1>
          {subtitle && <p className="ph-sub">{subtitle}</p>}
        </div>
      </div>

      <div className="ph-right">
        {showSearch && (
          <button className="ph-icon-btn" onClick={onSearchClick} aria-label="Recherche rapide (⌘K)">
            <Icon name="search" />
          </button>
        )}

        {showBell && (
          <button
            className="ph-icon-btn ph-bell"
            onClick={onBellClick || (() => navigate('/contracts'))}
            aria-label="Alertes et échéances"
          >
            <Icon name="bell" />
            {alertCount > 0 && <span className="ph-badge">{alertCount > 9 ? '9+' : alertCount}</span>}
          </button>
        )}

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
