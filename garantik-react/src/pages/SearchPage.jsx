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

function exportToCsv(purchases) {
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

// ============================================================
// Filtre principal : Tous / Garanties / Contrats & abonnements
// Détermine ensuite QUELS champs de filtre secondaires s'affichent —
// plus de mélange de critères qui ne s'appliquent qu'à l'un des deux.
// ============================================================
const SCOPE_OPTIONS = [
  { id: 'all', label: 'Tous' },
  { id: 'purchase', label: 'Garanties' },
  { id: 'contract', label: 'Contrats & abonnements' },
];

export default function SearchPage() {
  const { profile } = useOutletContext();
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const orgId = profile?.organization_id;

  const [query, setQuery] = useState(urlParams.get('q') || '');
  const [sortMode, setSortMode] = useState(urlParams.get('sort') || 'date_desc');
  const [sortOpen, setSortOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Listes pour les filtres — garanties
  const [brands, setBrands] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  // Listes pour les filtres — contrats & abonnements
  const [providers, setProviders] = useState([]);
  const [contractTypes, setContractTypes] = useState([]);

  // Filtre principal : quel type d'élément on cherche
  const [scope, setScope] = useState('all'); // 'all' | 'purchase' | 'contract'

  const [filterStatus, setFilterStatus] = useState('');

  // Filtres spécifiques aux garanties
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Filtres spécifiques aux contrats & abonnements
  const [filterProvider, setFilterProvider] = useState('');
  const [filterContractType, setFilterContractType] = useState('');
  const [filterEndDateFrom, setFilterEndDateFrom] = useState('');
  const [filterEndDateTo, setFilterEndDateTo] = useState('');

  const SORT_OPTIONS = [
    { id: 'date_desc', label: 'Date (récent)' },
    { id: 'expiry_asc', label: 'Échéance (proche)' },
  ];

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      supabase.from('brands').select('name').eq('organization_id', orgId).order('name'),
      supabase.from('stores').select('name').eq('organization_id', orgId).order('name'),
      supabase.from('categories').select('name').eq('organization_id', orgId).order('name'),
      supabase.from('providers').select('name').eq('organization_id', orgId).order('name'),
      supabase.from('contract_types').select('name').eq('organization_id', orgId).order('name'),
    ]).then(([{ data: b }, { data: s }, { data: c }, { data: p }, { data: ct }]) => {
      setBrands(b || []);
      setStores(s || []);
      setCategories(c || []);
      setProviders(p || []);
      setContractTypes(ct || []);
    });
  }, [orgId]);

  useEffect(() => {
    const timer = setTimeout(doSearch, 350);
    return () => clearTimeout(timer);
  }, [query, filterStatus, scope, filterBrand, filterStore, filterCategory, filterDateFrom, filterDateTo,
      filterProvider, filterContractType, filterEndDateFrom, filterEndDateTo, sortMode, orgId]);

  async function doSearch() {
    if (!orgId) return;
    setLoading(true);

    const qLower = query.trim().toLowerCase();

    // ---------- Achats — ignorés si le périmètre est "Contrats" ----------
    let purchasePromise = Promise.resolve({ data: [] });
    if (scope !== 'contract') {
      let purchaseQuery = supabase.from('purchases').select('*').eq('organization_id', orgId);
      if (qLower) {
        purchaseQuery = purchaseQuery.or(
          `object_name.ilike.%${qLower}%,brand.ilike.%${qLower}%,store.ilike.%${qLower}%,ocr_content.ilike.%${qLower}%,notes.ilike.%${qLower}%`
        );
      }
      if (filterBrand) purchaseQuery = purchaseQuery.eq('brand', filterBrand);
      if (filterStore) purchaseQuery = purchaseQuery.eq('store', filterStore);
      if (filterCategory) purchaseQuery = purchaseQuery.eq('category', filterCategory);
      if (filterDateFrom) purchaseQuery = purchaseQuery.gte('purchase_date', filterDateFrom);
      if (filterDateTo) purchaseQuery = purchaseQuery.lte('purchase_date', filterDateTo);
      purchasePromise = purchaseQuery.order('purchase_date', { ascending: false }).limit(100);
    }

    // ---------- Contrats & abonnements — ignorés si le périmètre est "Garanties" ----------
    let contractPromise = Promise.resolve({ data: [] });
    if (scope !== 'purchase') {
      let contractQuery = supabase.from('contracts').select('*').eq('organization_id', orgId).is('cancelled_at', null);
      if (qLower) {
        contractQuery = contractQuery.or(
          `name.ilike.%${qLower}%,provider.ilike.%${qLower}%,contract_type.ilike.%${qLower}%,reference_number.ilike.%${qLower}%,ocr_content.ilike.%${qLower}%,notes.ilike.%${qLower}%`
        );
      }
      if (filterProvider) contractQuery = contractQuery.eq('provider', filterProvider);
      if (filterContractType) contractQuery = contractQuery.eq('contract_type', filterContractType);
      if (filterEndDateFrom) contractQuery = contractQuery.gte('end_date', filterEndDateFrom);
      if (filterEndDateTo) contractQuery = contractQuery.lte('end_date', filterEndDateTo);
      contractPromise = contractQuery.order('end_date', { ascending: false }).limit(100);
    }

    const [{ data: purchaseData }, { data: contractData }] = await Promise.all([purchasePromise, contractPromise]);

    let mergedPurchases = (purchaseData || []).map(p => ({ ...p, _type: 'purchase', _endDate: p.warranty_end_date, _sortDate: p.purchase_date }));
    let mergedContracts = (contractData || []).map(c => ({ ...c, _type: 'contract', _endDate: c.end_date, _sortDate: c.start_date || c.created_at }));

    let merged = [...mergedPurchases, ...mergedContracts];

    if (filterStatus) {
      merged = merged.filter(item => itemStatus(item._endDate) === filterStatus);
    }

    if (sortMode === 'expiry_asc') {
      // "Le plus proche" ne veut pas dire "la date la plus ancienne" —
      // sinon une garantie expirée il y a 3 ans remonterait avant une
      // qui expire la semaine prochaine. On priorise les échéances à
      // venir (la plus proche en tête), puis les expirées (la plus
      // récente en tête), puis celles sans date connue.
      const now = new Date();
      merged.sort((a, b) => {
        const aDate = a._endDate ? new Date(a._endDate) : null;
        const bDate = b._endDate ? new Date(b._endDate) : null;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        const aExpired = aDate < now;
        const bExpired = bDate < now;
        if (aExpired !== bExpired) return aExpired ? 1 : -1;
        return aExpired ? bDate - aDate : aDate - bDate;
      });
    } else {
      merged.sort((a, b) => new Date(b._sortDate || 0) - new Date(a._sortDate || 0));
    }

    setResults(merged);
    setSearched(true);
    setLoading(false);
  }

  function resetFilters() {
    setQuery('');
    setFilterStatus('');
    setScope('all');
    setFilterBrand('');
    setFilterStore('');
    setFilterCategory('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterProvider('');
    setFilterContractType('');
    setFilterEndDateFrom('');
    setFilterEndDateTo('');
  }

  const hasActiveFilters = query || filterStatus || scope !== 'all' || filterBrand || filterStore || filterCategory
    || filterDateFrom || filterDateTo || filterProvider || filterContractType || filterEndDateFrom || filterEndDateTo;
  const purchaseResults = results.filter(r => r._type === 'purchase');

  return (
    <>
      <PageHeader
        title="Recherche avancée"
        subtitle="Recherchez par nom, marque, enseigne, prestataire, date ou contenu"
      />

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <h3><div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name="search" /></div>Recherche et filtres</h3>
          {purchaseResults.length > 0 && (
            <button className="btn btn-primary" style={{ fontSize: 12.5, padding: '7px 12px', gap: 6, flexShrink: 0 }}
              onClick={() => exportToCsv(purchaseResults)} title="L'export CSV couvre les garanties, pas les contrats">
              <Icon name="file-export" style={{ fontSize: 14 }} /> Export
            </button>
          )}
        </div>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg)', borderRadius: 'var(--radius-m)', padding: '10px 14px' }}>
            <Icon name="search" style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par nom, marque, enseigne, prestataire, contenu…"
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: 15, fontFamily: 'inherit', background: 'transparent', color: 'var(--ink)' }} />
            {query && <div onClick={() => setQuery('')} style={{ cursor: 'pointer', color: 'var(--ink-faint)' }}><Icon name="x" /></div>}
          </div>
        </div>

        {/* Filtre principal — détermine quels critères secondaires s'affichent
            en dessous. Plus de champs "garanties" visibles quand on cherche
            un contrat, et inversement. */}
        <div style={{ padding: '16px 20px 0' }}>
          <div className="pill-group">
            {SCOPE_OPTIONS.map(o => (
              <div key={o.id} className={`pill ${scope === o.id ? 'active' : ''}`}
                style={{ cursor: 'pointer' }} onClick={() => setScope(o.id)}>
                {o.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: scope === 'all' ? 0 : 12 }}>
            <div className="field">
              <label>Statut</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Tous les statuts</option>
                <option value="active">Active</option>
                <option value="expiring">Bientôt expirée</option>
                <option value="expired">Expirée</option>
              </select>
            </div>

            {/* ---------- Critères spécifiques aux garanties ---------- */}
            {scope === 'purchase' && (
              <>
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
              </>
            )}

            {/* ---------- Critères spécifiques aux contrats & abonnements ---------- */}
            {scope === 'contract' && (
              <>
                <div className="field">
                  <label>Prestataire</label>
                  <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)}>
                    <option value="">Tous les prestataires</option>
                    {providers.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Type de contrat</label>
                  <select value={filterContractType} onChange={e => setFilterContractType(e.target.value)}>
                    <option value="">Tous les types</option>
                    {contractTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          {scope === 'purchase' && (
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
          )}

          {scope === 'contract' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Date de fin — de</label>
                <input type="date" value={filterEndDateFrom} onChange={e => setFilterEndDateFrom(e.target.value)} />
              </div>
              <div className="field">
                <label>Date de fin — à</label>
                <input type="date" value={filterEndDateTo} onChange={e => setFilterEndDateTo(e.target.value)} />
              </div>
            </div>
          )}

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
            <div style={{ position: 'relative' }}>
              <button onClick={() => setSortOpen(!sortOpen)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
                background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 'var(--radius-s)',
                fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <Icon name="arrows-sort" style={{ fontSize: 13 }} /> {SORT_OPTIONS.find(o => o.id === sortMode)?.label}
              </button>
              {sortOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={() => setSortOpen(false)} />
                  <div className="sort-dropdown">
                    {SORT_OPTIONS.map(o => (
                      <div key={o.id} className={`sort-dropdown-item ${sortMode === o.id ? 'active' : ''}`}
                        onClick={() => { setSortMode(o.id); setSortOpen(false); }}>
                        {o.label} {sortMode === o.id && <Icon name="check" style={{ fontSize: 12 }} />}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="panel-body">
            {results.map((item) => {
              const isPurchase = item._type === 'purchase';
              const s = itemStatus(item._endDate);
              const title = isPurchase ? item.object_name : item.name;
              const metaParts = isPurchase
                ? [item.brand, item.store].filter(Boolean)
                : [item.provider, item.contract_type].filter(Boolean);
              return (
                <div
                  key={`${item._type}-${item.id}`}
                  className="purchase-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(isPurchase ? `/purchase/${item.id}` : `/contract/${item.id}`)}
                >
                  <div className="purchase-icon" style={isPurchase ? {} : { background: 'var(--amber-pale)', color: 'var(--amber-text)' }}>
                    <Icon name={isPurchase ? 'package' : 'shield-check'} />
                  </div>
                  <div className="purchase-main">
                    <div className="purchase-title">{title}</div>
                    <div className="purchase-meta">
                      {metaParts.join(' · ')}
                      {isPurchase && item.purchase_date && <> · {formatDate(item.purchase_date)}</>}
                      {item._endDate && <> · Fin le {formatDate(item._endDate)}</>}
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
          <div className="title">Recherchez dans vos garanties et contrats</div>
          <div className="sub">Utilisez le champ ci-dessus ou appliquez des filtres pour affiner</div>
        </div>
      )}
    </>
  );
}
