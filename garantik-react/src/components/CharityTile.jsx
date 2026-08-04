import React, { useState } from 'react';
import Icon from './Icon.jsx';

// Palette de dégradés chaleureux, choisie de façon stable par association
// (même association = toujours le même dégradé, pas de scintillement au
// rechargement). Icônes en pool restreint mais varié, pour donner de la
// vie sans avoir à connaître le thème exact de chaque association.
const GRADIENTS = [
  'linear-gradient(135deg, #60A5FA 0%, #2563EB 100%)',
  'linear-gradient(135deg, #34D399 0%, #059669 100%)',
  'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)',
  'linear-gradient(135deg, #F472B6 0%, #DB2777 100%)',
  'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
  'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
];
const ICONS = ['heart-handshake', 'sparkles', 'leaf', 'droplet', 'paw-print', 'sun'];

function pickIndex(name, poolSize) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % poolSize;
}

// selected/onSelect : optionnel, pour l'usage "sélecteur" (Mon compte).
// Sans ces props, la tuile est juste informative (landing page).
export default function CharityTile({ charity, selected, onSelect, height = 140 }) {
  const [imgError, setImgError] = useState(false);
  const gradient = GRADIENTS[pickIndex(charity.name, GRADIENTS.length)];
  const iconName = ICONS[pickIndex(charity.name + 'i', ICONS.length)];
  const hasImage = charity.image_url && !imgError;

  return (
    <div
      onClick={onSelect}
      style={{
        position: 'relative', height, borderRadius: 'var(--radius-m)', overflow: 'hidden',
        cursor: onSelect ? 'pointer' : 'default',
        border: selected ? '3px solid var(--blue)' : '3px solid transparent',
        boxShadow: '0 4px 20px rgba(27,36,48,0.08)',
      }}
    >
      {hasImage ? (
        <img
          src={charity.image_url}
          alt={charity.name}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={iconName} style={{ fontSize: Math.round(height * 0.32), color: 'rgba(255,255,255,0.85)' }} />
        </div>
      )}

      {/* Voile sombre en bas pour la lisibilité du nom, sur photo ou dégradé */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)',
        padding: '20px 14px 10px',
      }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 13.5 }}>{charity.name}</div>
      </div>

      {selected && (
        <div style={{
          position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: '50%',
          background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}>
          <Icon name="check" style={{ fontSize: 14, color: '#fff' }} />
        </div>
      )}
    </div>
  );
}
