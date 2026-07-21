import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { supabase } from '../lib/supabaseClient.js';

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
    <>
      <PageHeader
        backTo="/dashboard"
        title="Aide & FAQ"
        subtitle="Les réponses aux questions les plus fréquentes"
      />

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 24 }}>Chargement…</p>
      ) : faqs.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 24 }}>Aucune question pour l'instant.</p>
      ) : (
        faqs.map((faq) => <FaqItem key={faq.id} faq={faq} />)
      )}

      <div style={{
        marginTop: 20, padding: '16px 20px', background: 'var(--blue-pale-2)',
        borderRadius: 'var(--radius-m)', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, textAlign: 'center',
      }}>
        Vous ne trouvez pas votre réponse ?{' '}
        <a href="mailto:contact@garantik.fr" style={{ color: 'var(--blue)', fontWeight: 600 }}>
          Écrivez-nous à contact@garantik.fr
        </a>
      </div>
    </>
  );
}
