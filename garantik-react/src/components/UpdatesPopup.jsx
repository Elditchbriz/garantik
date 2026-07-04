// UpdatesPopup.jsx
// Affiche les nouveautés publiées (show_as_popup = true) que
// l'utilisateur courant n'a pas encore fermées. Fermer la popup
// vaut "ne plus afficher" — c'est le seul comportement demandé,
// pas de case à cocher séparée.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import Icon from './Icon.jsx';
import useFocusTrap from '../hooks/useFocusTrap.js';

export default function UpdatesPopup({ profileId }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState(false);
  const trapRef = useFocusTrap(null); // pas de fermeture au clavier Échap ici : fermeture volontaire uniquement

  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const [{ data: allUpdates }, { data: dismissed }] = await Promise.all([
        supabase.from('app_updates').select('id, title, content, created_at')
          .eq('show_as_popup', true)
          .not('published_at', 'is', null)
          .order('created_at', { ascending: false }),
        supabase.from('user_update_dismissals').select('update_id').eq('profile_id', profileId),
      ]);
      const dismissedIds = new Set((dismissed || []).map((d) => d.update_id));
      const unseen = (allUpdates || []).filter((u) => !dismissedIds.has(u.id));
      setUpdates(unseen);
      setLoading(false);
    })();
  }, [profileId]);

  async function handleClose() {
    setDismissing(true);
    try {
      const rows = updates.map((u) => ({ profile_id: profileId, update_id: u.id }));
      if (rows.length > 0) {
        await supabase.from('user_update_dismissals').insert(rows);
      }
    } catch (err) {
      console.error('Erreur enregistrement dismissal nouveautés:', err);
    } finally {
      setUpdates([]);
      setDismissing(false);
    }
  }

  if (loading || updates.length === 0) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal-card" ref={trapRef} tabIndex={-1} style={{ maxWidth: 480, width: '95vw', maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="modal-top">
          <div className="modal-close" onClick={handleClose}><Icon name="x" /></div>
          <div className="modal-icon"><Icon name="sparkles" /></div>
          <h3>Quoi de neuf sur Garantik</h3>
          <p>{updates.length > 1 ? `${updates.length} nouveautés depuis votre dernière visite` : 'Une nouveauté depuis votre dernière visite'}</p>
        </div>
        <div className="modal-body">
          {updates.map((u) => (
            <div key={u.id} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>{u.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{u.content}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 8 }}>
                {new Date(u.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          ))}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleClose} disabled={dismissing}>
            {dismissing ? 'Fermeture...' : 'Compris, fermer'}
          </button>
        </div>
      </div>
    </div>
  );
}
