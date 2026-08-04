import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function DiscussionsPage() {
  const { profile } = useOutletContext();
  const orgId = profile?.organization_id;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!orgId) return;
    supabase.from('chat_messages').select('id, role, content, created_at')
      .eq('organization_id', orgId).order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data || []);
        setLoading(false);
      });
  }, [orgId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setError('');
    setInput('');
    // Affichage optimiste du message utilisateur
    const tempId = 'temp-' + Date.now();
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: text, created_at: new Date().toISOString() }]);
    setSending(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-did`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur inconnue');

      setMessages((prev) => [...prev, {
        id: 'reply-' + Date.now(), role: 'assistant', content: json.reply, created_at: new Date().toISOString(),
      }]);
    } catch (err) {
      setError(err.message);
      // Retire le message optimiste en cas d'échec pour ne pas laisser un message "perdu"
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text); // on redonne la main pour réessayer sans retaper
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Discussions"
        subtitle="Posez vos questions à Did, il connaît vos garanties et contrats"
        showHelp={false}
      />

      <div style={{ paddingBottom: 12, minHeight: 240 }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 24 }}>Chargement…</p>
        ) : messages.length === 0 ? (
          <div className="didier-card">
            <div className="didier-avatar"><img src="/didier-headshot.jpg" alt="Did" /></div>
            <div className="didier-card-text">
              <div className="t">Bonjour ! Je suis Did.</div>
              <div className="d">Posez-moi une question sur vos garanties, contrats ou abonnements — je connais vos vraies données.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m) => (
              <div key={m.id} style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
              }}>
                {m.role === 'assistant' && (
                  <div className="didier-avatar" style={{ width: 32, height: 32, flexShrink: 0 }}>
                    <img src="/didier-headshot.jpg" alt="Did" />
                  </div>
                )}
                <div style={{
                  maxWidth: '78%', padding: '10px 14px', borderRadius: 'var(--radius-m)',
                  background: m.role === 'user' ? 'var(--blue)' : '#fff',
                  color: m.role === 'user' ? '#fff' : 'var(--navy)',
                  boxShadow: m.role === 'assistant' ? '0 4px 20px rgba(27,36,48,0.06)' : 'none',
                  fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div className="didier-avatar" style={{ width: 32, height: 32, flexShrink: 0 }}>
                  <img src="/didier-headshot.jpg" alt="Did" />
                </div>
                <div style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-m)', background: '#fff',
                  boxShadow: '0 4px 20px rgba(27,36,48,0.06)', fontSize: 13.5, color: 'var(--ink-faint)',
                }}>
                  Did réfléchit…
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: 'var(--red-text)', fontSize: 12.5, marginBottom: 8 }}>{error}</p>
      )}

      {/* Collé juste au-dessus de la barre du bas sur mobile (le padding
          réservé de .main s'en charge), et en bas de la zone de contenu
          sur desktop — jamais hors-écran, quelle que soit la taille. */}
      <form onSubmit={handleSend} style={{
        display: 'flex', gap: 8, padding: '10px 0', borderTop: '1px solid var(--line)',
        background: 'var(--bg)', position: 'sticky', bottom: 0,
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Écrivez votre question…"
          disabled={sending}
          style={{
            flex: 1, padding: '11px 14px', borderRadius: 'var(--radius-m)',
            border: '1px solid var(--line)', fontSize: 13.5, fontFamily: 'inherit',
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()} style={{ flexShrink: 0 }}>
          <Icon name="sparkles" />
        </button>
      </form>
    </div>
  );
}
