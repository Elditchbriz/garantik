import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';

// ============================================================
// OnboardingWizard — affiché sur le dashboard quand le compte
// est vide (0 achats, 0 contrats). Guide l'utilisateur vers
// sa première action de valeur en 3 étapes claires.
// ============================================================

const STEPS = [
  {
    icon: 'scan',
    color: 'var(--blue)',
    bg: 'var(--blue-pale)',
    title: 'Scannez votre premier ticket',
    description: 'Prenez en photo un ticket de caisse ou une facture. Notre IA extrait automatiquement le produit, la date et la durée de garantie.',
    cta: 'Scanner un ticket',
    route: '/add-purchase',
    skip: true,
  },
  {
    icon: 'shield-check',
    color: 'var(--amber-text)',
    bg: 'var(--amber-pale)',
    title: 'Ajoutez un contrat ou abonnement',
    description: 'Assurance, téléphonie, salle de sport… Garantik vous alerte avant chaque échéance pour ne jamais rater une résiliation.',
    cta: 'Ajouter un contrat',
    route: '/add-contract',
    skip: true,
  },
  {
    icon: 'bell',
    color: 'var(--green-text)',
    bg: 'var(--green-pale)',
    title: 'Activez vos alertes email',
    description: 'Recevez un rappel automatique avant l\'expiration de vos garanties et la date limite de résiliation de vos contrats.',
    cta: 'Configurer les alertes',
    route: '/settings',
    skip: true,
  },
];

export default function OnboardingWizard({ onDismiss, onStart }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Signaler que l'onboarding a démarré pour cette session
    if (onStart) onStart();
  }, []);
  const step = STEPS[currentStep];

  function handleCta() {
    navigate(step.route);
  }

  function handleNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      onDismiss();
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--navy) 0%, #2D5BA3 100%)',
      borderRadius: 'var(--radius-l)', padding: '28px 24px', marginBottom: 20, color: '#fff',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
            Bienvenue sur Garantik 🎉
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            3 étapes pour démarrer
          </div>
        </div>
        <button onClick={onDismiss} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 'var(--radius-s)', color: 'rgba(255,255,255,0.7)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>
          <Icon name="x" />
        </button>
      </div>

      {/* Indicateur de progression */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 99,
            background: i <= currentStep ? '#fff' : 'rgba(255,255,255,0.25)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Étape courante */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>
          <Icon name={step.icon} />
        </div>
        <div>
          <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>
            {step.title}
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            {step.description}
          </p>
        </div>
      </div>

      {/* Boutons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={handleCta} style={{
          flex: 1, minWidth: 160,
          background: '#fff', color: 'var(--navy)', border: 'none',
          borderRadius: 'var(--radius-s)', padding: '12px 18px',
          fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'opacity 0.15s',
        }}>
          <Icon name={step.icon} /> {step.cta}
        </button>
        <button onClick={handleNext} style={{
          background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-s)',
          padding: '12px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>
          {currentStep < STEPS.length - 1 ? 'Étape suivante →' : 'Terminer'}
        </button>
      </div>

      {/* Compteur d'étapes */}
      <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
        Étape {currentStep + 1} sur {STEPS.length}
      </div>
    </div>
  );
}
