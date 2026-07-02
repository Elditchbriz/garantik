import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';

const SK_STEP = 'garantik_onboarding_step';
const SK_STARTED = 'garantik_onboarding_started';
const SK_DONE = (orgId) => `garantik_onboarding_done_${orgId}`;

const STEPS = [
  {
    icon: 'scan',
    title: 'Scannez votre premier ticket',
    description: 'Prenez en photo un ticket de caisse ou une facture. Notre IA extrait automatiquement le produit, la date et la durée de garantie.',
    cta: 'Scanner un ticket',
    route: '/add-purchase',
    completedWhen: (purchases, contracts) => purchases > 0,
  },
  {
    icon: 'shield-check',
    title: 'Ajoutez un contrat ou abonnement',
    description: 'Assurance, téléphonie, salle de sport… Garantik vous alerte avant chaque échéance pour ne jamais rater une résiliation.',
    cta: 'Ajouter un contrat',
    route: '/add-contract',
    completedWhen: (purchases, contracts) => contracts > 0,
  },
  {
    icon: 'bell',
    title: 'Activez vos alertes email',
    description: 'Recevez un rappel automatique avant l\'expiration de vos garanties et vos dates de résiliation.',
    cta: 'Configurer les alertes',
    route: '/settings',
    completedWhen: () => false, // étape manuelle, toujours proposée
  },
];

export default function OnboardingWizard({ onDismiss, onStart, purchaseCount = 0, contractCount = 0, orgId }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Calculer l'étape courante en fonction des données réelles
  function computeStep() {
    const saved = parseInt(sessionStorage.getItem(SK_STEP) || '0', 10);
    // Avancer automatiquement si l'étape courante est déjà complétée
    let step = saved;
    while (step < STEPS.length - 1 && STEPS[step].completedWhen(purchaseCount, contractCount)) {
      step++;
    }
    return step;
  }

  const [currentStep, setCurrentStep] = useState(computeStep);
  const [showCongrats, setShowCongrats] = useState(false);

  useEffect(() => {
    if (onStart) onStart();
    sessionStorage.setItem(SK_STARTED, '1');
  }, []);

  // Recalculer l'étape quand les données changent (ex: retour après avoir scanné)
  useEffect(() => {
    const newStep = computeStep();
    if (newStep !== currentStep) {
      setCurrentStep(newStep);
      sessionStorage.setItem(SK_STEP, String(newStep));
    }
  }, [purchaseCount, contractCount]);

  function handleCta() {
    navigate(STEPS[currentStep].route);
  }

  function handleNext() {
    if (currentStep < STEPS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      sessionStorage.setItem(SK_STEP, String(next));
    } else {
      setShowCongrats(true);
    }
  }

  function handleFinish() {
    if (orgId) localStorage.setItem(SK_DONE(orgId), '1');
    sessionStorage.removeItem(SK_STEP);
    sessionStorage.removeItem(SK_STARTED);
    onDismiss();
  }

  const step = STEPS[currentStep];
  const isCompleted = step.completedWhen(purchaseCount, contractCount);

  // Modal de félicitations
  if (showCongrats) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #0F2444 0%, #1E3A6E 100%)',
        borderRadius: 'var(--radius-l)', padding: '36px 28px', marginBottom: 20,
        textAlign: 'center', color: '#fff',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h2 style={{ color: '#fff', fontSize: 22, marginBottom: 10 }}>
          Vous êtes prêt !
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 1.6, marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
          Votre espace Garantik est configuré. Fini les garanties perdues et les contrats oubliés — on s'occupe de tout.
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-m)',
          padding: '16px 20px', marginBottom: 24, textAlign: 'left',
        }}>
          <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.8 }}>
            <div>💡 Scannez vos achats dès réception du ticket</div>
            <div>📅 Vérifiez vos échéances depuis le tableau de bord</div>
            <div>📧 Les alertes arrivent automatiquement par email</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexDirection: 'column', alignItems: 'center' }}>
          <button onClick={() => { navigate('/invite'); handleFinish(); }} style={{
            background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 'var(--radius-s)',
            padding: '13px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', justifyContent: 'center',
          }}>
            <Icon name="heart-handshake" /> Inviter des amis et gagner 1 mois premium
          </button>
          <button onClick={handleFinish} style={{
            background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-s)',
            padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', width: '100%',
          }}>
            Accéder à mon tableau de bord
          </button>
        </div>
      </div>
    );
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
        <button onClick={handleFinish} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 'var(--radius-s)', color: 'rgba(255,255,255,0.7)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>
          <Icon name="x" />
        </button>
      </div>

      {/* Barre de progression */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 99,
            background: i < currentStep ? '#4ADE80' : i === currentStep ? '#fff' : 'rgba(255,255,255,0.25)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Étape courante */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          background: isCompleted ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>
          {isCompleted ? '✅' : <Icon name={step.icon} />}
        </div>
        <div>
          <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>
            {isCompleted ? `${step.title} — fait !` : step.title}
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            {isCompleted ? 'Étape complétée. Passez à la suivante ou explorez votre tableau de bord.' : step.description}
          </p>
        </div>
      </div>

      {/* Boutons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {!isCompleted && (
          <button onClick={handleCta} style={{
            flex: 1, minWidth: 160,
            background: '#fff', color: 'var(--navy)', border: 'none',
            borderRadius: 'var(--radius-s)', padding: '12px 18px',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name={step.icon} /> {step.cta}
          </button>
        )}
        <button onClick={handleNext} style={{
          flex: isCompleted ? 2 : 1,
          background: isCompleted ? '#4ADE80' : 'rgba(255,255,255,0.12)',
          color: isCompleted ? '#0F2444' : 'rgba(255,255,255,0.9)',
          border: isCompleted ? 'none' : '1px solid rgba(255,255,255,0.2)',
          borderRadius: 'var(--radius-s)', padding: '12px 18px',
          fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {currentStep < STEPS.length - 1
            ? (isCompleted ? '✓ Étape suivante' : 'Passer cette étape →')
            : 'Terminer la configuration ✨'}
        </button>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
        Étape {currentStep + 1} sur {STEPS.length}
      </div>
    </div>
  );
}
