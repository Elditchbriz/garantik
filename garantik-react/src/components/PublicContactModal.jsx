import React, { useState } from 'react';
import { friendlyError } from '../lib/friendlyError.js';

// Fenêtre « Nous contacter » du site vitrine (envoie le message via la fonction public-contact). Déplacée telle quelle depuis la page d'accueil.
export default function PublicContactModal({ onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    if (!email.trim() || !message.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur inconnue');
      setSent(true);
    } catch (err) {
      setError(friendlyError(err, { formal: true }));
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
        {sent ? (
          <>
            <h3 style={{ margin: '0 0 8px', color: 'var(--navy)', fontSize: 18 }}>Message envoyé ✓</h3>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 20px' }}>
              Nous vous répondrons dès que possible à l'adresse indiquée.
            </p>
            <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Fermer</button>
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 4px', color: 'var(--navy)', fontSize: 18 }}>Nous contacter</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 18px' }}>
              Une question avant de vous inscrire ? Écrivez-nous.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom (optionnel)"
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 14, fontFamily: 'inherit' }} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Votre email" required
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 14, fontFamily: 'inherit' }} />
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Votre message" rows={4} required
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
            {error && <p style={{ color: 'var(--red-text)', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 14 }}>
              <button onClick={onClose} style={{ background: '#F1F5F9', color: '#334155', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSend} disabled={sending || !email.trim() || !message.trim()} className="btn btn-primary">
                {sending ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', textAlign: 'center', margin: 0 }}>
              Ou écrivez directement à{' '}
              <a href="mailto:contact@hey-did.fr" style={{ color: 'var(--blue)' }}>contact@hey-did.fr</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
