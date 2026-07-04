// SuspendedScreen.jsx
// Affiché à la place de toute l'application (sidebar, dashboard, etc.)
// quand organizations.status === 'suspended'. Contrairement à
// AccountStatusBanner (utilisé pour 'read_only'), cet écran bloque
// complètement l'accès aux données, pas seulement l'écriture.
//
// Usage dans App.jsx :
//   if (profile?.organizations?.status === 'suspended') {
//     return <SuspendedScreen profile={profile} onSignOut={handleSignOut} />;
//   }

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const CONTACT_EMAIL = 'didiergarantik@gmail.com'; // à remplacer une fois le domaine garantik.fr opérationnel

export default function SuspendedScreen({ profile, onSignOut }) {
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
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F8FAFC', fontFamily: '-apple-system, sans-serif', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 32, maxWidth: 440, width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: '#FEF2F2',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 26,
        }}>
          🔒
        </div>

        <h2 style={{ fontSize: 19, color: '#0F172A', margin: '0 0 8px' }}>Compte suspendu</h2>
        <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.6, margin: '0 0 24px' }}>
          L'accès à votre espace Garantik est actuellement suspendu.
          Contactez-nous si vous pensez qu'il s'agit d'une erreur.
        </p>

        {sent ? (
          <p style={{ fontSize: 13.5, color: '#16A34A', fontWeight: 600, marginBottom: 20 }}>
            Message envoyé — nous revenons vers vous rapidement.
          </p>
        ) : (
          <div style={{ textAlign: 'left', marginBottom: 20 }}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Expliquez votre situation..."
              rows={4}
              style={{
                width: '100%', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0',
                fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                marginBottom: 10,
              }}
            />
            {error && <p style={{ color: '#DC2626', fontSize: 12.5, margin: '0 0 10px' }}>{error}</p>}
            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              style={{
                width: '100%', background: '#1E3A6E', color: '#fff', border: 'none', borderRadius: 8,
                padding: '11px 0', fontSize: 13.5, fontWeight: 600,
                cursor: sending || !message.trim() ? 'not-allowed' : 'pointer',
                opacity: sending || !message.trim() ? 0.6 : 1,
              }}
            >
              {sending ? 'Envoi...' : 'Contacter Garantik'}
            </button>
          </div>
        )}

        <button
          onClick={onSignOut}
          style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
