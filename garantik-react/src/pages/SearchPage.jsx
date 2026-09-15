import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, monthlyEquivalent } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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

// Le même statut technique (avant/bientôt/après la date de fin) se dit
// différemment selon le type : une garantie "expire", un contrat ou
// abonnement plutôt "se termine" ou "arrive à échéance".
function statusLabelFor(status, type) {
  if (type === 'contract') {
    return { active: 'En cours', expiring: 'Échéance proche', expired: 'Terminé' }[status];
  }
  return statusLabelFr[status];
}

// ============================================================
// Export — un schéma de lignes commun aux garanties ET aux contrats,
// réutilisé par les 3 formats (CSV, PDF, Excel) pour ne pas dupliquer la
// logique de mise en forme à 3 endroits différents.
// ============================================================
function buildExportRows(purchases, contracts) {
  const purchaseRows = purchases.map((p) => ({
    type: 'Garantie', nom: p.object_name, tiers: p.brand || '', categorie: p.store || '',
    montant: p.total_amount, debut: p.purchase_date, echeance: p.warranty_end_date,
    statut: statusLabelFor(itemStatus(p.warranty_end_date), 'purchase'), notes: p.notes || '',
  }));
  const contractRows = contracts.map((c) => ({
    type: 'Contrat', nom: c.name, tiers: c.provider || '', categorie: c.contract_type || '',
    montant: c.amount, debut: c.start_date, echeance: c.end_date,
    statut: statusLabelFor(itemStatus(c.end_date), 'contract'), notes: c.notes || '',
  }));
  return [...purchaseRows, ...contractRows];
}

const EXPORT_HEADERS = ['Type', 'Nom', 'Marque / Prestataire', 'Enseigne / Catégorie', 'Montant (€)', 'Date de début', 'Échéance', 'Statut', 'Notes'];

function exportToCsv(purchases, contracts) {
  const rows = buildExportRows(purchases, contracts);
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n')) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  };
  const csvRows = rows.map((r) => [r.type, r.nom, r.tiers, r.categorie, r.montant, r.debut, r.echeance, r.statut, r.notes].map(escapeCsv).join(';'));
  const csvContent = '\uFEFF' + [EXPORT_HEADERS.join(';'), ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, 'csv');
}

// Hey Did+ — mise en page soignée plutôt qu'un simple tableau brut : un
// résumé chiffré en haut (repris de la page Dépenses), puis le détail.
function exportToPdf(purchases, contracts) {
  const doc = new jsPDF();
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  doc.setFontSize(18);
  doc.setTextColor(23, 59, 143); // var(--blue-dark)
  doc.text('Hey Did — Récapitulatif', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Exporté le ${dateStr}`, 14, 27);

  const totalProtected = purchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
  const totalMonthly = contracts.reduce((sum, c) => sum + monthlyEquivalent(c.amount, c.billing_period), 0);
  doc.setFontSize(11);
  doc.setTextColor(27, 36, 48); // var(--navy)
  doc.text(`Valeur protégée : ${totalProtected.toFixed(0)} €`, 14, 38);
  doc.text(`Engagements récurrents : ${totalMonthly.toFixed(2)} € / mois`, 14, 45);

  const rows = buildExportRows(purchases, contracts);
  autoTable(doc, {
    startY: 53,
    head: [EXPORT_HEADERS],
    body: rows.map((r) => [
      r.type, r.nom, r.tiers, r.categorie,
      r.montant != null ? `${r.montant} €` : '',
      formatDate(r.debut), formatDate(r.echeance), r.statut, r.notes,
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [41, 98, 255] }, // var(--blue)
    alternateRowStyles: { fillColor: [248, 250, 253] }, // var(--bg)
  });

  const dateSlug = new Date().toISOString().slice(0, 10);
  doc.save(`hey-did-export_${dateSlug}.pdf`);
}

// Hey Did+ — deux feuilles distinctes (plus lisible qu'un mélange garanties
// + contrats dans un même tableau une fois ouvert dans un vrai tableur).
function exportToExcel(purchases, contracts) {
  const wb = XLSX.utils.book_new();

  const purchaseSheet = XLSX.utils.json_to_sheet(purchases.map((p) => ({
    Objet: p.object_name, Marque: p.brand || '', Enseigne: p.store || '', Catégorie: p.category || '',
    'Montant (€)': p.total_amount, "Date d'achat": p.purchase_date, 'Fin de garantie': p.warranty_end_date,
    Statut: statusLabelFor(itemStatus(p.warranty_end_date), 'purchase'), Notes: p.notes || '',
  })));
  XLSX.utils.book_append_sheet(wb, purchaseSheet, 'Garanties');

  const contractSheet = XLSX.utils.json_to_sheet(contracts.map((c) => ({
    Nom: c.name, Prestataire: c.provider || '', Type: c.contract_type || '',
    'Montant (€)': c.amount, Périodicité: c.billing_period || '',
    'Date de début': c.start_date, Échéance: c.end_date, 'Préavis (jours)': c.notice_period_days || '',
    Statut: statusLabelFor(itemStatus(c.end_date), 'contract'), Notes: c.notes || '',
  })));
  XLSX.utils.book_append_sheet(wb, contractSheet, 'Contrats');

  const dateSlug = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `hey-did-export_${dateSlug}.xlsx`);
}

function downloadBlob(blob, ext) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateSlug = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `hey-did-export_${dateSlug}.${ext}`;
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
  const contractResults = results.filter(r => r._type === 'contract');
  const isPremium = profile?.organizations?.plan === 'premium';
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Recherche avancée"
        subtitle="Recherchez par nom, marque, enseigne, prestataire, date ou contenu"
      />

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <h3><div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name="search" /></div>Recherche et filtres</h3>
          {(purchaseResults.length > 0 || contractResults.length > 0) && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button className="btn btn-primary" style={{ fontSize: 12.5, padding: '7px 12px', gap: 6 }}
                onClick={() => setExportMenuOpen((v) => !v)}>
                <Icon name="file-export" style={{ fontSize: 14 }} /> Export
              </button>
              {exportMenuOpen && (
                <>
                  <div onClick={() => setExportMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                  <div style={{
                    position: 'absolute', top: '110%', right: 0, zIndex: 11, background: '#fff',
                    borderRadius: 'var(--radius-m)', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: 6, minWidth: 200,
                  }}>
                    <button
                      onClick={() => { exportToCsv(purchaseResults, contractResults); setExportMenuOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', background: 'none', border: 'none', borderRadius: 8, fontSize: 13, color: 'var(--navy)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                    >
                      <Icon name="file-text" style={{ fontSize: 15, color: 'var(--ink-faint)' }} /> CSV
                    </button>
                    <button
                      onClick={() => { if (!isPremium) { navigate('/account'); return; } exportToPdf(purchaseResults, contractResults); setExportMenuOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', background: 'none', border: 'none', borderRadius: 8, fontSize: 13, color: 'var(--navy)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                    >
                      <Icon name="file-type-pdf" style={{ fontSize: 15, color: 'var(--ink-faint)' }} /> PDF
                      {!isPremium && <Icon name="lock" style={{ fontSize: 12, color: 'var(--ink-faint)', marginLeft: 'auto' }} />}
                    </button>
                    <button
                      onClick={() => { if (!isPremium) { navigate('/account'); return; } exportToExcel(purchaseResults, contractResults); setExportMenuOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', background: 'none', border: 'none', borderRadius: 8, fontSize: 13, color: 'var(--navy)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                    >
                      <Icon name="file-spreadsheet" style={{ fontSize: 15, color: 'var(--ink-faint)' }} /> Excel
                      {!isPremium && <Icon name="lock" style={{ fontSize: 12, color: 'var(--ink-faint)', marginLeft: 'auto' }} />}
                    </button>
                    {!isPremium && (
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)', padding: '6px 12px 2px' }}>PDF et Excel réservés à Hey Did+</div>
                    )}
                  </div>
                </>
              )}
            </div>
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
                {scope === 'contract' ? (
                  <>
                    <option value="active">En cours</option>
                    <option value="expiring">Échéance proche</option>
                    <option value="expired">Terminé</option>
                  </>
                ) : (
                  <>
                    <option value="active">Active</option>
                    <option value="expiring">Bientôt expirée</option>
                    <option value="expired">Expirée</option>
                  </>
                )}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
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
                  <span className={`badge ${badgeClassFor[s]}`}>{statusLabelFor(s, item._type)}</span>
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
