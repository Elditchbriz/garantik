import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from './Icon.jsx';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Barre de recherche toujours visible dans la barre desktop — remplace
// l'ancienne icône qui ouvrait une petite fenêtre centrée. Les résultats
// apparaissent dans un menu ancré juste en dessous, pas en plein écran.
// Réutilise la même logique de recherche que QuickSearchOverlay (mobile).
export default function DesktopSearchBar({ orgId }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [purchaseResults, setPurchaseResults] = useState([]);
  const [contractResults, setContractResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || !orgId) {
      setPurchaseResults([]);
      setContractResults([]);
      return;
    }
    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, orgId]);

  async function doSearch() {
    setLoading(true);
    const q = query.trim().toLowerCase();
    const [{ data: purchases }, { data: contracts }] = await Promise.all([
      supabase.from('purchases').select('id, object_name, brand, store, warranty_end_date')
        .eq('organization_id', orgId)
        .or(`object_name.ilike.%${q}%,brand.ilike.%${q}%,store.ilike.%${q}%,ocr_content.ilike.%${q}%,notes.ilike.%${q}%`)
        .limit(6),
      supabase.from('contracts').select('id, name, provider, end_date')
        .eq('organization_id', orgId)
        .or(`name.ilike.%${q}%,provider.ilike.%${q}%,reference_number.ilike.%${q}%,ocr_content.ilike.%${q}%,notes.ilike.%${q}%,contract_type.ilike.%${q}%`)
        .limit(6),
    ]);
    setPurchaseResults(purchases || []);
    setContractResults(contracts || []);
    setLoading(false);
  }

  function goToAdvancedSearch() {
    navigate(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search');
    setOpen(false);
  }

  function goTo(path) {
    navigate(path);
    setOpen(false);
  }

  const hasResults = purchaseResults.length > 0 || contractResults.length > 0;

  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
      <div className="desktop-search-input">
        <Icon name="search" style={{ color: 'var(--ink-faint)', flexShrink: 0, fontSize: 16 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Enter' && goToAdvancedSearch()}
          placeholder="Rechercher un achat, un contrat, une enseigne…"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', flexShrink: 0 }}>
            <Icon name="x" style={{ fontSize: 14 }} />
          </button>
        )}
      </div>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={() => setOpen(false)} />
          <div className="desktop-search-dropdown">
            {!query.trim() && (
              <div className="empty-state" style={{ padding: '28px 20px' }}>
                <div className="icon-circle" style={{ width: 40, height: 40 }}><Icon name="search" style={{ fontSize: 18 }} /></div>
                <div className="title" style={{ fontSize: 14 }}>Recherchez dans tout Hey Did</div>
                <div className="sub" style={{ fontSize: 12.5 }}>
                  Nom, marque, montant, enseigne… ou même un mot écrit sur un ticket ou dans un contrat.
                </div>
              </div>
            )}

            {loading && <p style={{ padding: 20, textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>Recherche…</p>}

            {!loading && query.trim() && !hasResults && (
              <p style={{ padding: 20, textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>
                Aucun résultat pour « {query} »
              </p>
            )}

            {!loading && purchaseResults.length > 0 && (
              <div style={{ padding: '8px 0' }}>
                <div style={{ padding: '6px 18px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)' }}>
                  Achats
                </div>
                {purchaseResults.map((p) => (
                  <div key={p.id} className="purchase-row" style={{ padding: '10px 18px', cursor: 'pointer' }} onClick={() => goTo(`/purchase/${p.id}`)}>
                    <div className="purchase-icon" style={{ width: 32, height: 32 }}><Icon name="package" style={{ fontSize: 14 }} /></div>
                    <div className="purchase-main">
                      <div className="purchase-title" style={{ fontSize: 13.5 }}>{p.object_name}</div>
                      <div className="purchase-meta" style={{ fontSize: 11.5 }}>{[p.brand, p.store].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && contractResults.length > 0 && (
              <div style={{ padding: '8px 0' }}>
                <div style={{ padding: '6px 18px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)' }}>
                  Contrats
                </div>
                {contractResults.map((c) => (
                  <div key={c.id} className="purchase-row" style={{ padding: '10px 18px', cursor: 'pointer' }} onClick={() => goTo(`/contract/${c.id}`)}>
                    <div className="purchase-icon" style={{ width: 32, height: 32, background: 'var(--amber-pale)', color: 'var(--amber-text)' }}><Icon name="shield-check" style={{ fontSize: 14 }} /></div>
                    <div className="purchase-main">
                      <div className="purchase-title" style={{ fontSize: 13.5 }}>{c.name}</div>
                      <div className="purchase-meta" style={{ fontSize: 11.5 }}>{c.provider}{c.end_date ? ` · Fin le ${formatDate(c.end_date)}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Toujours visible en bas, comme demandé */}
            <div style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
              <button
                onClick={goToAdvancedSearch}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--blue)', fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Icon name="list-search" /> Recherche avancée avec filtres et export
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
