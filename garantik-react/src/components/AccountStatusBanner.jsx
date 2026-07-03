// AccountStatusBanner.jsx
// Affiche un bandeau d'avertissement si l'organisation n'est pas
// en statut 'active' (read_only ou suspended), avec un bouton qui
// ouvre un petit formulaire de contact envoyé à l'admin Garantik.
//
// Usage dans App.jsx :
//   <AccountStatusBanner profile={profile} />

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const STATUS_CONFIG = {
  read_only: {
    title: 'Compte en lecture seule',
    description: "Vous pouvez consulter vos garanties et contrats, mais vous ne pouvez pas en ajouter ou en modifier pour le moment.",
    color: '#92400E',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  suspended: {
    title: 'Compte suspendu',
    description: "L'accès à votre espace Garantik est actuellement suspendu.",
    color: '#991B1B',
    bg: '#FEF2F2',
    border: '#FECACA',
  },
};

function ContactModal({ config, onClose }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-support`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur inconnue');
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, margin: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <>
            <h3 style={{ margin: '0 0 8px', color: '#0F172A', fontSize: 16 }}>Message envoyé</h3>
            <p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 20px' }}>
              Nous revenons vers vous rapidement.
            </p>
            <button onClick={onClose} style={btnPrimary(config.color)}>Fermer</button>
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 4px', color: '#0F172A', fontSize: 16 }}>Contacter Garantik</h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px' }}>
              {config.title} — décrivez votre demande, nous vous répondrons par email.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Motif de votre demande..."
              rows={4}
              style={{
                width: '100%', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0',
                fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                marginBottom: 12,
              }}
            />
            {error && <p style={{ color: '#DC2626', fontSize: 12.5, margin: '0 0 12px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={btnSecondary}>Annuler</button>
              <button onClick={handleSend} disabled={sending || !message.trim()} style={btnPrimary(config.color, sending || !message.trim())}>
                {sending ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function btnPrimary(color, disabled = false) {
  return {
    background: color, color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 18px', fontSize: 13.5, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  };
}

const btnSecondary = {
  background: '#F1F5F9', color: '#334155', border: 'none', borderRadius: 8,
  padding: '9px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
};

export default function AccountStatusBanner({ profile }) {
  const [modalOpen, setModalOpen] = useState(false);
  const organization = profile?.organizations;
  const status = organization?.status;

  if (!status || status === 'active') return null;

  const config = STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
          gap: 12, padding: '12px 20px', background: config.bg, border: `1px solid ${config.border}`,
          borderRadius: 10, margin: '0 0 16px',
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: config.color }}>{config.title}</div>
          <div style={{ fontSize: 13, color: config.color, opacity: 0.85 }}>{config.description}</div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            flexShrink: 0, background: config.color, color: '#fff', fontSize: 13, fontWeight: 600,
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Contacter Garantik
        </button>
      </div>

      {modalOpen && <ContactModal config={config} onClose={() => setModalOpen(false)} />}
    </>
  );
}
