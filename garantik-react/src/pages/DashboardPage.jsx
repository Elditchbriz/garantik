import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase, listPurchases, countPurchasesByStatus, getEmailInbox } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import OnboardingWizard from '../components/OnboardingWizard.jsx';

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

const statusConfig = {
  active:   { badge: 'green',  label: 'Active' },
  expiring: { badge: 'amber',  label: 'Bientôt' },
  expired:  { badge: 'red',    label: 'Expirée' },
};

const SORT_OPTIONS = [
  { id: 'date_desc',     label: 'Date (récent)' },
  { id: 'date_asc',      label: 'Date (ancien)' },
  { id: 'amount_desc',   label: 'Montant (décroissant)' },
  { id: 'amount_asc',    label: 'Montant (croissant)' },
  { id: 'end_date_asc',  label: 'Échéance (proche)' },
];

function sortItems(items, sortId, dateField, amountField) {
  const s = [...items];
  switch (sortId) {
    case 'date_asc':     return s.sort((a, b) => new Date(a[dateField]||0) - new Date(b[dateField]||0));
    case 'amount_desc':  return s.sort((a, b) => (b[amountField]||0) - (a[amountField]||0));
    case 'amount_asc':   return s.sort((a, b) => (a[amountField]||0) - (b[amountField]||0));
    case 'end_date_asc': return s.sort((a, b) => new Date(a.warranty_end_date||a.end_date||'9999') - new Date(b.warranty_end_date||b.end_date||'9999'));
    default:             return s.sort((a, b) => new Date(b[dateField]||0) - new Date(a[dateField]||0));
  }
}

function SortBtn({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find(o => o.id === value);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
        background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 'var(--radius-s)',
        fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <Icon name="arrows-sort" style={{ fontSize: 12 }} /> {current?.label}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={() => setOpen(false)} />
          <div className="sort-dropdown">
            {SORT_OPTIONS.map(o => (
              <div key={o.id} className={`sort-dropdown-item ${value === o.id ? 'active' : ''}`}
                onClick={() => { onChange(o.id); setOpen(false); }}>
                {o.label} {value === o.id && <Icon name="check" style={{ fontSize: 12 }} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Indicateur de quota du plan gratuit — visible en permanence dès le
// premier ajout, pas seulement au moment où la limite est atteinte
// (audit P2 section 3 : "mauvaise surprise" à la 11e garantie).
function QuotaBar({ used, quota }) {
  const pct = Math.min(100, Math.round((used / quota) * 100));
  const nearLimit = used >= quota - 2;
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)',
      padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)' }}>
            {used} / {quota} garanties et contrats utilisés
          </span>
          {nearLimit && (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--amber-text)' }}>
              Plus que {Math.max(0, quota - used)} disponible{quota - used > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ height: 6, background: 'var(--gray-pale)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`, borderRadius: 99,
            background: nearLimit ? 'var(--amber)' : 'var(--blue)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
      <a href="/account#abonnement" style={{
        flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--blue)', whiteSpace: 'nowrap',
      }}>
        Passer premium
      </a>
    </div>
  );
}

export default function DashboardPage() {
  const { profile, openQuickSearch, alertCount } = useOutletContext();
  const navigate = useNavigate();

  const [purchases, setPurchases]   = useState([]);
  const [contracts, setContracts]   = useState([]);
  const [stats, setStats]           = useState({ all: 0, active: 0, expiring: 0, expired: 0 });
  const [loading, setLoading]       = useState(true);
  const [inboxItems, setInboxItems]  = useState([]);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  // Force l'affichage pendant toute la session si l'onboarding a été démarré
  // — la clé est rattachée à l'organisation pour éviter qu'un onboarding démarré
  // sur un compte ne "fuite" et force l'affichage sur un autre compte consulté
  // dans la même session navigateur (ex: tests avec plusieurs comptes).
  const [onboardingStarted, setOnboardingStarted] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const orgId = profile?.organization_id;

  // Tri persistant par organisation : évite que le tri choisi se
  // réinitialise à chaque navigation (audit P2 section 4).
  const purchaseSortKey = orgId ? `garantik_sort_purchases_${orgId}` : null;
  const contractSortKey = orgId ? `garantik_sort_contracts_${orgId}` : null;

  const [purchaseSort, setPurchaseSortState] = useState(() =>
    (orgId && localStorage.getItem(`garantik_sort_purchases_${orgId}`)) || 'date_desc'
  );
  const [contractSort, setContractSortState] = useState(() =>
    (orgId && localStorage.getItem(`garantik_sort_contracts_${orgId}`)) || 'end_date_asc'
  );

  function setPurchaseSort(value) {
    setPurchaseSortState(value);
    if (purchaseSortKey) localStorage.setItem(purchaseSortKey, value);
  }
  function setContractSort(value) {
    setContractSortState(value);
    if (contractSortKey) localStorage.setItem(contractSortKey, value);
  }

  // Recharger la préférence de tri une fois orgId connu (au cas où le
  // state initial ci-dessus a été calculé avant que orgId soit dispo)
  useEffect(() => {
    if (!orgId) return;
    const savedPurchaseSort = localStorage.getItem(`garantik_sort_purchases_${orgId}`);
    const savedContractSort = localStorage.getItem(`garantik_sort_contracts_${orgId}`);
    if (savedPurchaseSort) setPurchaseSortState(savedPurchaseSort);
    if (savedContractSort) setContractSortState(savedContractSort);
  }, [orgId]);

  const [purchaseLimit, setPurchaseLimit] = useState(PAGE_SIZE);
  const [contractLimit, setContractLimit] = useState(PAGE_SIZE);

  function dismissOnboarding() {
    if (orgId) localStorage.setItem(`garantik_onboarding_done_${orgId}`, '1');
    if (orgId) sessionStorage.removeItem(`garantik_onboarding_started_${orgId}`);
    setOnboardingDismissed(true);
  }

  // Charger l'état d'onboarding depuis localStorage/sessionStorage quand orgId est disponible
  useEffect(() => {
    if (!orgId) return;
    if (localStorage.getItem(`garantik_onboarding_done_${orgId}`) === '1') {
      setOnboardingDismissed(true);
    }
    if (sessionStorage.getItem(`garantik_onboarding_started_${orgId}`) === '1') {
      setOnboardingStarted(true);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [{ data: pd }, sd, { data: cd }, { data: inbox }] = await Promise.all([
        listPurchases(orgId),
        countPurchasesByStatus(orgId),
        supabase.from('contracts').select('*').eq('organization_id', orgId).is('cancelled_at', null).order('end_date'),
        getEmailInbox(orgId),
      ]);
      setPurchases(pd || []);
      setContracts(cd || []);
      setInboxItems(inbox || []);
      setStats(sd);
      setLoading(false);
    })();
  }, [orgId]);

  // Filtrer par statut si une stat est sélectionnée
  const filteredPurchases = activeFilter === 'all' ? purchases
    : purchases.filter(p => itemStatus(p.warranty_end_date) === activeFilter);
  const filteredContracts = activeFilter === 'all' ? contracts
    : contracts.filter(c => itemStatus(c.end_date) === activeFilter);

  const sortedPurchases  = sortItems(filteredPurchases, purchaseSort, 'purchase_date', 'total_amount');
  const sortedContracts  = sortItems(filteredContracts, contractSort, 'start_date', null);
  const visiblePurchases = sortedPurchases.slice(0, purchaseLimit);
  const visibleContracts = sortedContracts.slice(0, contractLimit);
  const expiringSoon     = stats.expiring + contracts.filter(c => itemStatus(c.end_date) === 'expiring').length;

  // Quota : uniquement affiché pour les comptes non premium
  const isPremium = profile?.organizations?.plan === 'premium';
  const quota = profile?.organizations?.quota_override ?? 10;
  const usedItems = purchases.length + contracts.length;

  return (
    <>
      {/* ── Header ──────────────────────────────── */}
      <div className="ph">
        <div className="ph-left">
          <div>
            <h1 className="ph-title">Bonjour {profile?.full_name?.split(' ')[0] || ''}</h1>
            <p className="ph-sub">
              {expiringSoon > 0
                ? `${expiringSoon} échéance${expiringSoon > 1 ? 's' : ''} à surveiller dans les 60 prochains jours`
                : 'Tout est à jour — aucune échéance imminente'}
            </p>
          </div>
        </div>
        <div className="ph-right">
          <button className="ph-icon-btn" onClick={openQuickSearch} aria-label="Recherche rapide">
            <Icon name="search" />
          </button>
          <button className="ph-icon-btn" onClick={() => navigate('/faq')} aria-label="Aide" title="Aide" style={{ fontWeight: 700 }}>
            ?
          </button>
          <button className="ph-icon-btn ph-bell" onClick={() => navigate('/contracts')} aria-label="Alertes">
            <Icon name="bell" />
            {alertCount > 0 && <span className="ph-badge">{alertCount > 9 ? '9+' : alertCount}</span>}
          </button>
        </div>
      </div>

      {/* ── Quota plan gratuit ─────────────────────── */}
      {!loading && !isPremium && <QuotaBar used={usedItems} quota={quota} />}

      {/* ── Onboarding wizard (comptes vides) ─────── */}
      {!onboardingDismissed && !loading && (onboardingStarted || (purchases.length === 0 && contracts.length === 0)) && (
        <OnboardingWizard
          onDismiss={dismissOnboarding}
          onStart={() => {
            if (orgId) sessionStorage.setItem(`garantik_onboarding_started_${orgId}`, '1');
            setOnboardingStarted(true);
          }}
          purchaseCount={purchases.length}
          contractCount={contracts.length}
          orgId={orgId}
        />
      )}

      {/* ── Boutons d'ajout ─────────────────────── */}
      <div className="dash-add-row">
        <button className="dash-add-btn primary" onClick={() => navigate('/add-purchase')}>
          <div className="dash-add-icon"><Icon name="package" /></div>
          <div>
            <div className="dash-add-label">Ajouter une garantie</div>
            <div className="dash-add-sub">Scannez ou saisissez votre achat</div>
          </div>
        </button>
        <button className="dash-add-btn secondary" onClick={() => navigate('/add-contract')}>
          <div className="dash-add-icon"><Icon name="file-text" /></div>
          <div>
            <div className="dash-add-label">Ajouter un contrat</div>
            <div className="dash-add-sub">Assurance, abonnement, extension…</div>
          </div>
        </button>
      </div>

      {/* ── Stats ───────────────────────────────── */}
      <div className="dash-stats">
        {[
          { label: 'Total',    num: stats.all + contracts.length,   icon: 'layout-dashboard', color: 'blue',  filter: 'all' },
          { label: 'Actifs',   num: stats.active + contracts.filter(c => itemStatus(c.end_date) === 'active').length,   icon: 'circle-check', color: 'green', filter: 'active' },
          { label: 'Bientôt',  num: expiringSoon,                   icon: 'clock',          color: 'amber', filter: 'expiring' },
          { label: 'Expirés',  num: stats.expired + contracts.filter(c => itemStatus(c.end_date) === 'expired').length, icon: 'alert-triangle', color: 'red',   filter: 'expired' },
        ].map(s => (
          <div key={s.label}
            className={`dash-stat dash-stat-${s.color}${activeFilter === s.filter ? ' active' : ''}`}
            style={{ cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.1s' }}
            onClick={() => setActiveFilter(activeFilter === s.filter ? 'all' : s.filter)}>
            <Icon name={s.icon} />
            <span className="dash-stat-num">{s.num}</span>
            <span className="dash-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Listes côte à côte ───────────────────── */}
      {inboxItems.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderRadius: 'var(--radius-m)',
          background: 'var(--amber-pale)', border: '1px solid var(--amber)',
          marginBottom: 16, cursor: 'pointer',
        }} onClick={() => navigate('/inbox')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="mail" style={{ color: 'var(--amber-text)', fontSize: 18 }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)' }}>
                {inboxItems.length} document{inboxItems.length > 1 ? 's' : ''} en attente de traitement
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                Reçus par email — cliquez pour traiter
              </div>
            </div>
          </div>
          <Icon name="chevron-down" style={{ transform: 'rotate(-90deg)', color: 'var(--amber-text)' }} />
        </div>
      )}

      <div className="two-col-grid">

        {/* Garanties */}
        <div className="dash-list-block">
          <div className="dash-list-head">
            <div className="dash-list-title">
              <span className="dash-list-dot blue"></span>
              Garanties <span className="dash-list-count">{purchases.length}</span>
            </div>
            {purchases.length > 0 && <SortBtn value={purchaseSort} onChange={setPurchaseSort} />}
          </div>

          {loading ? (
            <div className="dash-list-empty">Chargement…</div>
          ) : purchases.length === 0 ? (
            <div className="dash-list-empty">
              <Icon name="package" style={{ fontSize: 28, color: 'var(--line)', display: 'block', margin: '0 auto 10px' }} />
              Aucune garantie enregistrée
            </div>
          ) : (
            <div className="dash-list-items">
              {visiblePurchases.map(p => {
                const s = itemStatus(p.warranty_end_date);
                const sc = statusConfig[s];
                return (
                  <div key={p.id} className="dash-item" onClick={() => navigate(`/purchase/${p.id}`)}>
                    <div className="dash-item-body">
                      <div className="dash-item-name">{p.object_name}</div>
                      <div className="dash-item-meta">
                        {[p.brand, p.store].filter(Boolean).join(' · ')}
                        {p.warranty_end_date && <> · fin {formatDate(p.warranty_end_date)}</>}
                      </div>
                    </div>
                    <div className="dash-item-right">
                      {p.total_amount && (
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)', marginRight: 4 }}>
                          {Number(p.total_amount).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
                        </span>
                      )}
                      <span className={`badge ${sc.badge}`}>{sc.label}</span>
                      <button className="dash-item-edit" onClick={e => { e.stopPropagation(); navigate(`/purchase/${p.id}`); }}>
                        <Icon name="edit" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {sortedPurchases.length > purchaseLimit && (
                <button className="dash-show-more" onClick={() => setPurchaseLimit(l => l + PAGE_SIZE)}>
                  Voir {Math.min(PAGE_SIZE, sortedPurchases.length - purchaseLimit)} de plus
                </button>
              )}
            </div>
          )}
        </div>

        {/* Contrats */}
        <div className="dash-list-block">
          <div className="dash-list-head">
            <div className="dash-list-title">
              <span className="dash-list-dot amber"></span>
              Contrats et abonnements <span className="dash-list-count">{contracts.length}</span>
            </div>
            {contracts.length > 0 && <SortBtn value={contractSort} onChange={setContractSort} />}
          </div>

          {loading ? (
            <div className="dash-list-empty">Chargement…</div>
          ) : contracts.length === 0 ? (
            <div className="dash-list-empty">
              <Icon name="shield-check" style={{ fontSize: 28, color: 'var(--line)', display: 'block', margin: '0 auto 10px' }} />
              Aucun contrat enregistré
            </div>
          ) : (
            <div className="dash-list-items">
              {visibleContracts.map(c => {
                const s = itemStatus(c.end_date);
                const sc = statusConfig[s];
                return (
                  <div key={c.id} className="dash-item" onClick={() => navigate(`/contract/${c.id}`)}>
                    <div className="dash-item-body">
                      <div className="dash-item-name">{c.name}</div>
                      <div className="dash-item-meta">
                        {[c.provider, c.contract_type].filter(Boolean).join(' · ')}
                        {c.end_date && <> · fin {formatDate(c.end_date)}</>}
                      </div>
                    </div>
                    <div className="dash-item-right">
                      <span className={`badge ${sc.badge}`}>{sc.label}</span>
                      <button className="dash-item-edit" onClick={e => { e.stopPropagation(); navigate(`/contract/${c.id}`); }}>
                        <Icon name="edit" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {sortedContracts.length > contractLimit && (
                <button className="dash-show-more" onClick={() => setContractLimit(l => l + PAGE_SIZE)}>
                  Voir {Math.min(PAGE_SIZE, sortedContracts.length - contractLimit)} de plus
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
