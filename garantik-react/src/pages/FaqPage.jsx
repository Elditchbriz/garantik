import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabaseClient.js';
import '../styles/landing.css';

function FaqItem({ faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: '#fff', borderRadius: 'var(--radius-m)', border: '1px solid var(--line)', overflow: 'hidden', marginBottom: 10 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', textAlign: 'left', padding: '16px 18px', background: 'none', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600, color: 'var(--navy)',
        }}
      >
        {faq.question}
        <Icon name="chevron-down" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: 'var(--ink-faint)', flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px', fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.65 }}>
          {faq.answer}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('faqs').select('*').eq('active', true).order('position')
      .then(({ data }) => {
        setFaqs(data || []);
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

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 20px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="eyebrow-sm" style={{ justifyContent: 'center', display: 'flex' }}>Besoin d'aide</div>
          <h1 style={{ fontSize: 28, fontFamily: 'Fraunces, serif', color: 'var(--navy)', margin: '8px 0 12px' }}>
            Questions fréquentes
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)' }}>
            Vous ne trouvez pas votre réponse ? Écrivez-nous à{' '}
            <a href="mailto:contact@garantik.fr" style={{ color: 'var(--blue)' }}>contact@garantik.fr</a>
          </p>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)' }}>Chargement…</p>
        ) : faqs.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)' }}>Aucune question pour l'instant.</p>
        ) : (
          faqs.map((faq) => <FaqItem key={faq.id} faq={faq} />)
        )}
      </div>
    </div>
  );
}
