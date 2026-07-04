// FeedbackButton.jsx
// Bouton flottant permanent (visible sur toutes les pages connectées)
// permettant à l'utilisateur d'envoyer une remontée ou suggestion.
// Arrive dans la console admin (onglet "Retours") avec notification
// email à l'admin.

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import Icon from './Icon.jsx';
import useFocusTrap from '../hooks/useFocusTrap.js';

function FeedbackModal({ onClose }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const trapRef = useFocusTrap(onClose);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-feedback`,
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
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" ref={trapRef} tabIndex={-1} style={{ maxWidth: 420 }}>
        <div className="modal-top">
          <div className="modal-close" onClick={onClose}><Icon name="x" /></div>
          <div className="modal-icon"><Icon name="bulb" /></div>
          <h3>Une idée, une remarque ?</h3>
          <p>Dites-nous ce qui vous aiderait, on lit tout</p>
        </div>
        <div className="modal-body">
          {sent ? (
            <>
              <p style={{ fontSize: 13.5, color: 'var(--green-text)', fontWeight: 600, marginBottom: 20 }}>
                Merci ! Votre message a bien été transmis.
              </p>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
                Fermer
              </button>
            </>
          ) : (
            <>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex : je trouverais pratique d'avoir un bouton qui..."
                rows={5}
                style={{
                  width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--line)',
                  fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                  marginBottom: 12,
                }}
              />
              {error && <p style={{ color: 'var(--red-text)', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleSend}
                disabled={sending || !message.trim()}
              >
                {sending ? 'Envoi...' : 'Envoyer'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Envoyer une remontée"
        className="feedback-fab"
      >
        <Icon name="bulb" />
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}
