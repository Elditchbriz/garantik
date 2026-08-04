import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import CharityTile from '../components/CharityTile.jsx';
import { supabase } from '../lib/supabaseClient.js';
import '../styles/landing.css';

// Isolée volontairement : le jour où l'app sera packagée en natif
// (Capacitor), il suffira de remplacer le contenu de cette fonction par
// Browser.open({ url }) du plugin @capacitor/browser.
function openExternalLink(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function AssociationsPage() {
  const navigate = useNavigate();
  const [charities, setCharities] = useState([]);
  const [loading, setLoading] = useState(true);
  // Cette page reste accessible sans connexion (liens depuis la landing
  // page) — elle ne peut donc pas être imbriquée dans le layout de l'app
  // (qui exige une session). On détecte simplement si un utilisateur est
  // connecté pour adapter l'en-tête et le bas de page, sans dupliquer
  // la page ni casser l'accès public.
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = en cours de vérification

  useEffect(() => {
    supabase.from('charities').select('*').eq('active', true).order('name')
      .then(({ data }) => {
        setCharities(data || []);
        setLoading(false);
      });
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="lp-header">
        <div className="lp-header-inner">
          <Link to={isLoggedIn ? '/dashboard' : '/'} className="lp-logo">
            <div className="mark"></div>
            <div className="word">Hey Did</div>
          </Link>
          <Link to={isLoggedIn ? '/account#abonnement' : '/'} className="btn btn-ghost">
            {isLoggedIn ? '← Retour à mon compte' : "← Retour à l'accueil"}
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="eyebrow-sm" style={{ justifyContent: 'center', display: 'flex' }}>Un premium qui a du sens</div>
          <h1 style={{ fontSize: 28, fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontWeight: 800, color: 'var(--navy)', margin: '8px 0 12px' }}>
            Nos associations partenaires
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', maxWidth: 560, margin: '0 auto' }}>
            En passant premium, vous choisissez l'une de ces associations : Hey Did lui reverse
            automatiquement au moins 10% de votre abonnement, sans coût supplémentaire pour vous.
          </p>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)' }}>Chargement…</p>
        ) : charities.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)' }}>Aucune association disponible pour l'instant.</p>
        ) : (
          <div className="lp-feature-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {charities.map((c) => (
              <div key={c.id} style={{
                background: '#fff', borderRadius: 'var(--radius-l)', border: '1px solid var(--line)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}>
                <CharityTile charity={c} height={140} />
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 16, flex: 1 }}>
                    {c.description || "Association partenaire de Hey Did."}
                  </p>
                  {c.website_url && (
                    <button
                      onClick={() => openExternalLink(c.website_url)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600,
                        color: 'var(--blue-dark)', background: 'none', border: 'none', cursor: 'pointer',
                        padding: 0, fontFamily: 'inherit', alignSelf: 'flex-start',
                      }}
                    >
                      Voir le site <Icon name="external-link" style={{ fontSize: 13 }} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA d'inscription — uniquement pertinent pour un visiteur non connecté */}
        {!isLoggedIn && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <button onClick={() => navigate('/auth?mode=signup')} className="btn btn-primary">
              <Icon name="rocket" /> Essayer Hey Did gratuitement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
