import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase, listPurchases, countPurchasesByStatus } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

const PAGE_SIZE = 5;

function itemStatus(endDate) {
  if (!endDate) return 'active';
  const end = new Date(endDate);
  const now = new Date();
  const in60days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  if (end < now) return 'expired';
  if (end <= in60days) return 'expiring';
  return 'active';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const badgeClassFor = { active: 'green', expiring: 'amber', expired: 'red' };
const badgeLabelFor = { active: 'Active', expiring: 'Bientôt', expired: 'Expirée' };

const SORT_OPTIONS = [
  { id: 'date_desc', label: 'Date (récent)' },
  { id: 'date_asc', label: 'Date (ancien)' },
  { id: 'amount_desc', label: 'Montant (décroissant)' },
  { id: 'amount_asc', label: 'Montant (croissant)' },
  { id: 'end_date_asc', label: 'Échéance (proche)' },
];

function sortItems(items, sortId, dateField, amountField) {
  const sorted = [...items];
  switch (sortId) {
    case 'date_asc': return sorted.sort((a, b) => new Date(a[dateField] || 0) - new Date(b[dateField] || 0));
    case 'amount_desc': return sorted.sort((a, b) => (b[amountField] || 0) - (a[amountField] || 0));
    case 'amount_asc': return sorted.sort((a, b) => (a[amountField] || 0) - (b[amountField] || 0));
    case 'end_date_asc': return sorted.sort((a, b) => new Date(a.warranty_end_date || a.end_date || '9999') - new Date(b.warranty_end_date || b.end_date || '9999'));
    case 'date_desc':
    default: return sorted.sort((a, b) => new Date(b[dateField] || 0) - new Date(a[dateField] || 0));
  }
}

function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find(o => o.id === value);

  return (
    <div className="sort-select" onClick={() => setOpen(!open)}>
      <Icon name="list" style={{ fontSize: 13 }} />
      {current?.label}
      <Icon name="chevron-down" style={{ fontSize: 11 }} />
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="sort-dropdown">
            {SORT_OPTIONS.map(o => (
              <div key={o.id} className={`sort-dropdown-item ${value === o.id ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onChange(o.id); setOpen(false); }}>
                {o.label} {value === o.id && <Icon name="check" style={{ fontSize: 12 }} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { profile, openQuickSearch } = useOutletContext();
  const navigate = useNavigate();

  const [purchases, setPurchases] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [stats, setStats] = useState({ all: 0, active: 0, expiring: 0, expired: 0 });
  const [loading, setLoading] = useState(true);

  const [purchaseSort, setPurchaseSort] = useState('date_desc');
  const [contractSort, setContractSort] = useState('end_date_asc');
  const [purchaseLimit, setPurchaseLimit] = useState(PAGE_SIZE);
  const [contractLimit, setContractLimit] = useState(PAGE_SIZE);

  const orgId = profile?.organization_id;

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [{ data: purchaseData }, statData, { data: contractData }] = await Promise.all([
        listPurchases(orgId),
        countPurchasesByStatus(orgId),
        supabase.from('contracts').select('*').eq('organization_id', orgId).is('cancelled_at', null).order('end_date'),
      ]);
      setPurchases(purchaseData || []);
      setContracts(contractData || []);
      setStats(statData);
      setLoading(false);
    })();
  }, [orgId]);

  const sortedPurchases = sortItems(purchases, purchaseSort, 'purchase_date', 'total_amount');
  const sortedContracts = sortItems(contracts, contractSort, 'start_date', null);

  const visiblePurchases = sortedPurchases.slice(0, purchaseLimit);
  const visibleContracts = sortedContracts.slice(0, contractLimit);

  const expiringSoonCount = stats.expiring + contracts.filter(c => itemStatus(c.end_date) === 'expiring').length;

  return (
    <>
      <PageHeader
        title={`Bonjour ${profile?.full_name?.split(' ')[0] || ''}`}
        onSearchClick={openQuickSearch}
        actions={[
          { label: 'Nouvel achat', icon: 'plus', to: '/add-purchase' },
          { label: 'Nouveau contrat', icon: 'shield-check', to: '/add-contract', variant: 'secondary' },
        ]}
      />

      {expiringSoonCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
          background: 'var(--amber-pale)', color: 'var(--amber-text)', borderRadius: 'var(--radius-m)',
          fontSize: 13, fontWeight: 600, marginBottom: 16,
        }}>
          <Icon name="bell" /> {expiringSoonCount} échéance{expiringSoonCount > 1 ? 's' : ''} dans les 60 prochains jours
        </div>
      )}

      <div className="stat-row">
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="icon-badge blue"><Icon name="package" /></div>
          <div className="num">{stats.all + contracts.length}</div>
          <div className="label">Au total</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="icon-badge green"><Icon name="circle-check" /></div>
          <div className="num">{stats.active + contracts.filter(c => itemStatus(c.end_date) === 'active').length}</div>
          <div className="label">Actifs</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="icon-badge amber"><Icon name="clock" /></div>
          <div className="num">{expiringSoonCount}</div>
          <div className="label">Bientôt</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="icon-badge red"><Icon name="alert-triangle" /></div>
          <div className="num">{stats.expired + contracts.filter(c => itemStatus(c.end_date) === 'expired').length}</div>
          <div className="label">Expirés</div>
        </div>
      </div>

      <div className="two-col-grid">

        {/* Colonne Achats */}
        <div className="panel">
          <div className="panel-header">
            <h3>
              <div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}>
                <Icon name="package" />
              </div>
              Achats ({purchases.length})
            </h3>
            {purchases.length > 0 && <SortDropdown value={purchaseSort} onChange={setPurchaseSort} />}
          </div>
          <div className="panel-body">
            {loading ? (
              <p style={{ padding: 20, color: 'var(--ink-faint)' }}>Chargement…</p>
            ) : purchases.length === 0 ? (
              <div className="empty-state">
                <div className="icon-circle"><Icon name="package" /></div>
                <div className="title">Aucun achat</div>
                <div className="sub">Ajoutez votre premier achat pour commencer.</div>
              </div>
            ) : (
              visiblePurchases.map((p) => {
                const status = itemStatus(p.warranty_end_date);
                return (
                  <div key={p.id} className="purchase-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchase/${p.id}`)}>
                    <div className="purchase-icon"><Icon name="package" /></div>
                    <div className="purchase-main">
                      <div className="purchase-title">{p.object_name}</div>
                      <div className="purchase-meta">
                        {p.purchase_date && <>Acheté le {formatDate(p.purchase_date)}</>}
                        {p.warranty_end_date && <> · Fin le {formatDate(p.warranty_end_date)}</>}
                      </div>
                    </div>
                    <span className={`badge ${badgeClassFor[status]}`}>{badgeLabelFor[status]}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/purchase/${p.id}`); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 6, marginLeft: 4 }}
                      title="Modifier"
                    >
                      <Icon name="edit" style={{ fontSize: 15 }} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          {sortedPurchases.length > purchaseLimit && (
            <button className="show-more-btn" onClick={() => setPurchaseLimit(l => l + PAGE_SIZE)}>
              Voir {Math.min(PAGE_SIZE, sortedPurchases.length - purchaseLimit)} de plus ({sortedPurchases.length - purchaseLimit} restants)
            </button>
          )}
        </div>

        {/* Colonne Contrats */}
        <div className="panel">
          <div className="panel-header">
            <h3>
              <div className="panel-header-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}>
                <Icon name="shield-check" />
              </div>
              Contrats ({contracts.length})
            </h3>
            {contracts.length > 0 && <SortDropdown value={contractSort} onChange={setContractSort} />}
          </div>
          <div className="panel-body">
            {loading ? (
              <p style={{ padding: 20, color: 'var(--ink-faint)' }}>Chargement…</p>
            ) : contracts.length === 0 ? (
              <div className="empty-state">
                <div className="icon-circle"><Icon name="shield-check" /></div>
                <div className="title">Aucun contrat</div>
                <div className="sub">Assurances, abonnements, extensions…</div>
              </div>
            ) : (
              visibleContracts.map((c) => {
                const status = itemStatus(c.end_date);
                return (
                  <div key={c.id} className="purchase-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/contract/${c.id}`)}>
                    <div className="purchase-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}><Icon name="shield-check" /></div>
                    <div className="purchase-main">
                      <div className="purchase-title">{c.name}</div>
                      <div className="purchase-meta">
                        {c.start_date && <>Débuté le {formatDate(c.start_date)}</>}
                        {c.end_date && <> · Fin le {formatDate(c.end_date)}</>}
                      </div>
                    </div>
                    <span className={`badge ${badgeClassFor[status]}`}>{badgeLabelFor[status]}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/contract/${c.id}`); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 6, marginLeft: 4 }}
                      title="Modifier"
                    >
                      <Icon name="edit" style={{ fontSize: 15 }} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          {sortedContracts.length > contractLimit && (
            <button className="show-more-btn" onClick={() => setContractLimit(l => l + PAGE_SIZE)}>
              Voir {Math.min(PAGE_SIZE, sortedContracts.length - contractLimit)} de plus ({sortedContracts.length - contractLimit} restants)
            </button>
          )}
        </div>

      </div>
    </>
  );
}
