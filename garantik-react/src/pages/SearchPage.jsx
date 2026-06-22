import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function itemStatus(endDate) {
  if (!endDate) return 'active';
  const end = new Date(endDate);
  const now = new Date();
  if (end < now) return 'expired';
  if (end <= new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)) return 'expiring';
  return 'active';
}

const statusLabelFr = { active: 'Active', expiring: 'Bientôt expirée', expired: 'Expirée' };
const badgeClassFor = { active: 'green', expiring: 'amber', expired: 'red' };

function exportToCsv(purchases, query) {
  const headers = ['Objet', 'Marque', 'Enseigne', 'Catégorie', 'Montant (€)', "Date d'achat", 'Fin de garantie', 'Statut', 'Notes'];
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n')) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  };
  const rows = purchases.map((p) => [
    p.object_name, p.brand, p.store, p.category, p.total_amount,
    p.purchase_date, p.warranty_end_date, statusLabelFr[itemStatus(p.warranty_end_date)], p.notes,
  ].map(escapeCsv).join(';'));
  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateSlug = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `garantik-export_${dateSlug}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SearchPage() {
  const { profile } = useOutletContext();
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const orgId = profile?.organization_id;

  const [query, setQuery] = useState(urlParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Listes pour les filtres
  const [brands, setBrands] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);

  // Filtres
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      supabase.from('brands').select('name').eq('organization_id', orgId).order('name'),
      supabase.from('stores').select('name').eq('organization_id', orgId).order('name'),
      supabase.from('categories').select('name').eq('organization_id', orgId).order('name'),
    ]).then(([{ data: b }, { data: s }, { data: c }]) => {
      setBrands(b || []);
      setStores(s || []);
      setCategories(c || []);
    });
  }, [orgId]);

  useEffect(() => {
    const timer = setTimeout(doSearch, 350);
    return () => clearTimeout(timer);
  }, [query, filterStatus, filterBrand, filterStore, filterCategory, filterDateFrom, filterDateTo, orgId]);

  async function doSearch() {
    if (!orgId) return;
    setLoading(true);

    let q = supabase.from('purchases').select('*').eq('organization_id', orgId);

    if (query.trim()) {
      const qLower = query.trim().toLowerCase();
      q = q.or(`object_name.ilike.%${qLower}%,brand.ilike.%${qLower}%,store.ilike.%${qLower}%,ocr_content.ilike.%${qLower}%`);
    }
    if (filterBrand) q = q.eq('brand', filterBrand);
    if (filterStore) q = q.eq('store', filterStore);
    if (filterCategory) q = q.eq('category', filterCategory);
    if (filterDateFrom) q = q.gte('purchase_date', filterDateFrom);
    if (filterDateTo) q = q.lte('purchase_date', filterDateTo);

    const { data } = await q.order('purchase_date', { ascending: false }).limit(100);
    let filtered = data || [];

    if (filterStatus) {
      filtered = filtered.filter(p => itemStatus(p.warranty_end_date) === filterStatus);
    }

    setResults(filtered);
    setSearched(true);
    setLoading(false);
  }

  function resetFilters() {
    setQuery('');
    setFilterStatus('');
    setFilterBrand('');
    setFilterStore('');
    setFilterCategory('');
    setFilterDateFrom('');
    setFilterDateTo('');
  }

  const hasActiveFilters = query || filterStatus || filterBrand || filterStore || filterCategory || filterDateFrom || filterDateTo;

  return (
    <>
      <PageHeader
        title="Recherche avancée"
        subtitle="Recherchez par nom, marque, enseigne, date ou contenu de votre achat ou contrat"
      />

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <h3><div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name="search" /></div>Recherche et filtres</h3>
          {results.length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '7px 12px', gap: 6 }}
              onClick={() => exportToCsv(results, query)}>
              <Icon name="file-export" style={{ fontSize: 14 }} /> Exporter CSV
            </button>
          )}
        </div>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg)', borderRadius: 'var(--radius-m)', padding: '10px 14px' }}>
            <Icon name="search" style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par nom, marque, enseigne, contenu du ticket…"
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: 15, fontFamily: 'inherit', background: 'transparent', color: 'var(--ink)' }} />
            {query && <div onClick={() => setQuery('')} style={{ cursor: 'pointer', color: 'var(--ink-faint)' }}><Icon name="x" /></div>}
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div className="field">
              <label>Statut garantie</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Tous les statuts</option>
                <option value="active">Active</option>
                <option value="expiring">Bientôt expirée</option>
                <option value="expired">Expirée</option>
              </select>
            </div>
            <div className="field">
              <label>Marque</label>
              <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}>
                <option value="">Toutes les marques</option>
                {brands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Enseigne</label>
              <select value={filterStore} onChange={e => setFilterStore(e.target.value)}>
                <option value="">Toutes les enseignes</option>
                {stores.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Catégorie</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="">Toutes les catégories</option>
                {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Date d'achat — de</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="field">
              <label>Date d'achat — à</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={resetFilters} style={{
              marginTop: 12, background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-faint)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="x" style={{ fontSize: 12 }} /> Effacer tous les filtres
            </button>
          )}
        </div>
      </div>

      {loading && <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 24 }}>Recherche…</p>}

      {!loading && searched && results.length === 0 && (
        <div className="empty-state">
          <div className="icon-circle"><Icon name="search" /></div>
          <div className="title">Aucun résultat</div>
          <div className="sub">Essayez avec d'autres filtres ou un mot-clé différent</div>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3>
              <div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name="list-search" /></div>
              {results.length} résultat{results.length > 1 ? 's' : ''}
            </h3>
          </div>
          <div className="panel-body">
            {results.map((p) => {
              const s = itemStatus(p.warranty_end_date);
              return (
                <div key={p.id} className="purchase-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchase/${p.id}`)}>
                  <div className="purchase-icon"><Icon name="package" /></div>
                  <div className="purchase-main">
                    <div className="purchase-title">{p.object_name}</div>
                    <div className="purchase-meta">
                      {[p.brand, p.store].filter(Boolean).join(' · ')}
                      {p.purchase_date && <> · {formatDate(p.purchase_date)}</>}
                      {p.warranty_end_date && <> · Fin le {formatDate(p.warranty_end_date)}</>}
                    </div>
                  </div>
                  <span className={`badge ${badgeClassFor[s]}`}>{statusLabelFr[s]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!searched && !loading && (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="icon-circle"><Icon name="search" /></div>
          <div className="title">Recherchez dans vos garanties</div>
          <div className="sub">Utilisez le champ ci-dessus ou appliquez des filtres pour affiner</div>
        </div>
      )}
    </>
  );
}
