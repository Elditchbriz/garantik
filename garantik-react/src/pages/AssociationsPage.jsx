import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabaseClient.js';
import '../styles/landing.css';

export default function AssociationsPage() {
  const navigate = useNavigate();
  const [charities, setCharities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('charities').select('*').eq('active', true).order('name')
      .then(({ data }) => {
        setCharities(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="lp-header">
        <div className="lp-header-inner">
          <Link to="/" className="lp-logo">
            <div className="mark"></div>
            <div className="word">Garantik</div>
          </Link>
          <Link to="/" className="btn btn-ghost">← Retour à l'accueil</Link>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="eyebrow-sm" style={{ justifyContent: 'center', display: 'flex' }}>Un premium qui a du sens</div>
          <h1 style={{ fontSize: 28, fontFamily: 'Fraunces, serif', color: 'var(--navy)', margin: '8px 0 12px' }}>
            Nos associations partenaires
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', maxWidth: 560, margin: '0 auto' }}>
            En passant premium, vous choisissez l'une de ces associations : Garantik lui reverse
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
                padding: 24, display: 'flex', flexDirection: 'column',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, background: 'var(--blue-pale)', color: 'var(--blue-dark)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16,
                }}>
                  <Icon name="heart-handshake" />
                </div>
                <h3 style={{ fontSize: 17, color: 'var(--navy)', marginBottom: 8 }}>{c.name}</h3>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 16, flex: 1 }}>
                  {c.description || "Association partenaire de Garantik."}
                </p>
                {c.website_url && (
                  <a
                    href={c.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600,
                      color: 'var(--blue-dark)', textDecoration: 'none',
                    }}
                  >
                    Voir le site <Icon name="external-link" style={{ fontSize: 13 }} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button onClick={() => navigate('/auth?mode=signup')} className="btn btn-primary">
            <Icon name="rocket" /> Essayer Garantik gratuitement
          </button>
        </div>
      </div>
    </div>
  );
}
