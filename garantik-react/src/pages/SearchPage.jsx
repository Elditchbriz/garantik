import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function status(p) {
  if (!p.warranty_end_date) return 'active';
  const end = new Date(p.warranty_end_date);
  const now = new Date();
  if (end < now) return 'expired';
  if (end <= new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)) return 'expiring';
  return 'active';
}

export default function SearchPage() {
  const { profile } = useOutletContext();
  const orgId = profile?.organization_id;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query.trim() || !orgId) { setResults([]); setSearched(false); return; }
    const timer = setTimeout(doSearch, 350);
    return () => clearTimeout(timer);
  }, [query, orgId]);

  async function doSearch() {
    setLoading(true);
    const q = query.trim().toLowerCase();
    const { data } = await supabase
      .from('purchases')
      .select('*')
      .eq('organization_id', orgId)
      .or(`object_name.ilike.%${q}%,brand.ilike.%${q}%,store.ilike.%${q}%,ocr_content.ilike.%${q}%`)
      .order('purchase_date', { ascending: false })
      .limit(40);
    setResults(data || []);
    setSearched(true);
    setLoading(false);
  }

  const badgeClass = { active: 'green', expiring: 'amber', expired: 'red' };
  const badgeLabel = { active: 'Active', expiring: 'Bientôt expirée', expired: 'Expirée' };

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Rechercher</div>
          <h1 style={{ color: '#fff' }}>Vos garanties</h1>
          <p className="sub">Recherchez par nom, marque, enseigne ou contenu</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="search" style={{ color: 'var(--ink-faint)', fontSize: 20, flexShrink: 0 }} />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="MacBook, Bosch, Darty, réfrigérateur…"
            style={{
              border: 'none', outline: 'none', flex: 1, fontSize: 16,
              fontFamily: 'inherit', color: 'var(--ink)', background: 'transparent',
            }}
          />
          {query && (
            <div onClick={() => setQuery('')} style={{ cursor: 'pointer', color: 'var(--ink-faint)' }}>
              <Icon name="x" />
            </div>
          )}
        </div>
      </div>

      {loading && (
        <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 32 }}>Recherche…</p>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="empty-state">
          <div className="icon-circle"><Icon name="search" /></div>
          <div className="title">Aucun résultat pour « {query} »</div>
          <div className="sub">Essayez avec un autre mot-clé ou vérifiez l'orthographe</div>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3>
              <div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}>
                <Icon name="list-search" />
              </div>
              {results.length} résultat{results.length > 1 ? 's' : ''}
            </h3>
          </div>
          <div className="panel-body">
            {results.map((p) => {
              const s = status(p);
              return (
                <div key={p.id} className="purchase-row">
                  <div className="purchase-icon"><Icon name="package" /></div>
                  <div className="purchase-main">
                    <div className="purchase-title">{p.object_name}</div>
                    <div className="purchase-meta">{[p.brand, p.store, formatDate(p.purchase_date)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className={`badge ${badgeClass[s]}`}>{badgeLabel[s]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!searched && !loading && (
        <div className="empty-state" style={{ paddingTop: 32 }}>
          <div className="icon-circle"><Icon name="search" /></div>
          <div className="title">Tapez pour rechercher</div>
          <div className="sub">Parcourez toutes vos garanties, factures et tickets par mot-clé</div>
        </div>
      )}
    </>
  );
}
