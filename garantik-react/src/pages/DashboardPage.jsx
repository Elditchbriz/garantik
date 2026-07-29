import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase, listPurchases, countPurchasesByStatus, getEmailInbox } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import OnboardingWizard from '../components/OnboardingWizard.jsx';
import AddTypeSheet from '../components/AddTypeSheet.jsx';
import HelpMenu from '../components/HelpMenu.jsx';

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

function DidCard({ surveillerItems }) {
  const navigate = useNavigate();
  const count = surveillerItems.length;

  let title, description;
  if (count === 0) {
    title = '✅ Tout est sous contrôle';
    description = "Aucune garantie ni contrat n'a besoin d'attention pour l'instant.";
  } else if (count === 1) {
    title = '⚠️ 1 chose à surveiller';
    description = `${surveillerItems[0].name} — fin le ${formatDate(surveillerItems[0].endDate)}.`;
  } else {
    const names = surveillerItems.slice(0, 2).map((i) => i.name).join(' et ');
    const rest = count - 2;
    title = `⚠️ ${count} choses à surveiller`;
    description = rest > 0
      ? `${names}, et ${rest} autre${rest > 1 ? 's' : ''}.`
      : `${names}.`;
  }

  return (
    <div className="didier-card" style={{ flexWrap: 'wrap' }}>
      <div className="didier-avatar">
        <img src="/didier-headshot.jpg" alt="Did" />
      </div>
      <div className="didier-card-text" style={{ flex: 1, minWidth: 180 }}>
        <div className="t">{title}</div>
        <div className="d">{description}</div>
      </div>
      <button
        onClick={() => navigate('/discussions')}
        style={{
          flexShrink: 0, background: 'var(--blue)', color: '#fff', border: 'none',
          borderRadius: 'var(--radius-s)', padding: '9px 16px', fontSize: 12.5, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 8,
        }}
      >
        <Icon name="sparkles" style={{ fontSize: 13 }} /> Demander à Did
      </button>
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
  const [totalDonated, setTotalDonated] = useState(null);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [documentsThisMonth, setDocumentsThisMonth] = useState(0);
  // Pilote quel bloc de liste est affiché : par défaut "garanties" (les 5
  // derniers achats), et change pour refléter la carte cliquée juste au-dessus.
  const [categoryView, setCategoryView] = useState('garanties'); // 'garanties' | 'contrat' | 'abonnement'
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingStarted, setOnboardingStarted] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const surveillerRef = useRef(null);
  const listsRef = useRef(null);

  const orgId = profile?.organization_id;

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

  // Total déjà reversé aux associations — fonction sécurisée créée avec
  // le système de dons, ne renvoie que le total de SA PROPRE organisation.
  useEffect(() => {
    if (!orgId) return;
    supabase.rpc('get_my_donation_total').then(({ data, error }) => {
      if (!error && data != null) setTotalDonated(Number(data));
    });
  }, [orgId]);

  // Comptage des documents — utilisé par la carte "Documents" du tableau
  // de bord (n'existait pas avant, jamais interrogé sur cette page).
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      firstOfMonth.setHours(0, 0, 0, 0);
      const [{ count: total }, { count: thisMonth }] = await Promise.all([
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', firstOfMonth.toISOString()),
      ]);
      setDocumentsCount(total || 0);
      setDocumentsThisMonth(thisMonth || 0);
    })();
  }, [orgId]);

  const filteredPurchases = purchases;
  const filteredContracts = categoryView === 'all' ? contracts
    : contracts.filter(c => (categoryView === 'abonnement') === (c.contract_type === 'Abonnement'));

  const sortedPurchases  = sortItems(filteredPurchases, purchaseSort, 'purchase_date', 'total_amount');
  const sortedContracts  = sortItems(filteredContracts, contractSort, 'start_date', null);
  const visiblePurchases = sortedPurchases.slice(0, purchaseLimit);
  const visibleContracts = sortedContracts.slice(0, contractLimit);
  const expiringSoon     = stats.expiring + contracts.filter(c => itemStatus(c.end_date) === 'expiring').length;

  const isPremium = profile?.organizations?.plan === 'premium';
  const quota = profile?.organizations?.quota_override ?? 10;
  const usedItems = purchases.length + contracts.length;

  const surveillerItems = [
    ...purchases.filter(p => itemStatus(p.warranty_end_date) !== 'active').map(p => ({
      id: p.id, type: 'purchase', name: p.object_name, endDate: p.warranty_end_date,
      meta: [p.brand, p.store].filter(Boolean).join(' · '),
    })),
    ...contracts.filter(c => itemStatus(c.end_date) !== 'active').map(c => ({
      id: c.id, type: 'contract', name: c.name, endDate: c.end_date,
      meta: [c.provider, c.contract_type].filter(Boolean).join(' · '),
    })),
  ]
    .sort((a, b) => new Date(a.endDate || '9999') - new Date(b.endDate || '9999'))
    .slice(0, 5);

  const totalProtectedValue = purchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
  const monthlySpend = contracts.reduce((sum, c) => {
    const amount = Number(c.amount) || 0;
    if (!amount) return sum;
    return sum + (c.billing_period === 'annual' ? amount / 12 : amount);
  }, 0);

  function scrollSurveiller(direction) {
    const el = surveillerRef.current;
    if (!el) return;
    // Défile d'un "lot" (la largeur visible), quel que soit le nombre de
    // cartes à taille fixe qui y tiennent selon la largeur d'écran.
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <div>
            <h1 className="ph-title">Bonjour {profile?.full_name?.split(' ')[0] || ''}</h1>
            <p className="ph-sub">Le jour où vous en aurez besoin, Did sera là.</p>
          </div>
        </div>
        <div className="ph-right">
          <button className="ph-icon-btn" onClick={openQuickSearch} aria-label="Recherche rapide">
            <Icon name="search" />
          </button>
          <HelpMenu />
          <button className="ph-icon-btn ph-bell" onClick={() => navigate('/search')} aria-label="Alertes">
            <Icon name="bell" />
            {alertCount > 0 && <span className="ph-badge">{alertCount > 9 ? '9+' : alertCount}</span>}
          </button>
        </div>
      </div>

      {!loading && <DidCard surveillerItems={surveillerItems} />}

      {!loading && !isPremium && <QuotaBar used={usedItems} quota={quota} />}

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

      <div className="dash-add-row">
        <button className="dash-add-btn primary" onClick={() => setAddSheetOpen(true)}>
          <div className="dash-add-icon"><Icon name="plus" /></div>
          <div>
            <div className="dash-add-label">Ajouter</div>
            <div className="dash-add-sub">Garantie, contrat ou abonnement</div>
          </div>
        </button>
        <button className="dash-add-btn secondary" onClick={() => navigate('/inbox')} style={{ position: 'relative' }}>
          {inboxItems.length > 0 && (
            <span style={{
              position: 'absolute', top: 10, right: 10, background: 'var(--red)', color: '#fff',
              fontSize: 10.5, fontWeight: 800, width: 20, height: 20, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {inboxItems.length}
            </span>
          )}
          <div className="dash-add-icon"><Icon name="mail" /></div>
          <div>
            <div className="dash-add-label">Docs en attente</div>
            <div className="dash-add-sub">Reçus par email, à valider</div>
          </div>
        </button>
      </div>

      {addSheetOpen && <AddTypeSheet onClose={() => setAddSheetOpen(false)} />}

      <div className="dash-stats">
        {(() => {
          const abonnementsCount = contracts.filter(c => c.contract_type === 'Abonnement').length;
          const contratsCount = contracts.length - abonnementsCount;
          const expiringPurchases = purchases.filter(p => itemStatus(p.warranty_end_date) === 'expiring').length;
          const expiringContrats = contracts.filter(c => c.contract_type !== 'Abonnement' && itemStatus(c.end_date) === 'expiring').length;
          const expiringAbonnements = contracts.filter(c => c.contract_type === 'Abonnement' && itemStatus(c.end_date) === 'expiring').length;

          const cards = [
            {
              key: 'garanties', label: 'Garanties', num: purchases.length, icon: 'shield-check', color: 'blue',
              flag: expiringPurchases > 0 ? `${expiringPurchases} expire${expiringPurchases > 1 ? 'nt' : ''} bientôt` : (purchases.length > 0 ? 'Tout est à jour' : null),
              flagColor: expiringPurchases > 0 ? 'var(--amber-text)' : 'var(--green-text)',
              onClick: () => {
                setCategoryView('garanties');
                setTimeout(() => listsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
              },
              active: categoryView === 'garanties',
            },
            {
              key: 'contrats', label: 'Contrats', num: contratsCount, icon: 'file-text', color: 'green',
              flag: expiringContrats > 0 ? `${expiringContrats} à renouveler` : (contratsCount > 0 ? 'Tous actifs' : null),
              flagColor: expiringContrats > 0 ? 'var(--amber-text)' : 'var(--green-text)',
              onClick: () => {
                setCategoryView('contrat');
                setTimeout(() => listsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
              },
              active: categoryView === 'contrat',
            },
            {
              key: 'abonnements', label: 'Abonnements', num: abonnementsCount, icon: 'repeat', color: 'amber',
              flag: expiringAbonnements > 0 ? `${expiringAbonnements} à renouveler` : (abonnementsCount > 0 ? 'Tous actifs' : null),
              flagColor: expiringAbonnements > 0 ? 'var(--amber-text)' : 'var(--green-text)',
              onClick: () => {
                setCategoryView('abonnement');
                setTimeout(() => listsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
              },
              active: categoryView === 'abonnement',
            },
            {
              key: 'documents', label: 'Documents', num: documentsCount, icon: 'folder', color: 'red',
              flag: documentsThisMonth > 0 ? `+${documentsThisMonth} ce mois-ci` : null,
              flagColor: 'var(--ink-soft)',
              onClick: () => navigate('/documents'),
            },
          ];

          return cards.map(s => (
            <div key={s.key}
              className={`dash-stat dash-stat-${s.color}${s.active ? ' active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={s.onClick}>
              <div className="stat-arrow"><Icon name={s.active ? 'x' : 'arrow-up-right'} /></div>
              <div className="stat-icon-circle"><Icon name={s.icon} /></div>
              <span className="dash-stat-num">{s.num}</span>
              <span className="dash-stat-label">{s.label}</span>
              {s.flag && <span style={{ fontSize: 10.5, fontWeight: 700, color: s.flagColor, marginTop: 4 }}>{s.flag}</span>}
            </div>
          ));
        })()}
      </div>

      {!loading && surveillerItems.length > 0 && (
        <>
          <div className="dash-list-head" style={{ marginBottom: 10 }}>
            <div className="dash-list-title">
              <span className="dash-list-dot amber"></span>
              À surveiller
            </div>
          </div>
          <div className="carousel" ref={surveillerRef}>
            {surveillerItems.map((item) => {
              const s = itemStatus(item.endDate);
              const sc = statusConfig[s];
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="item-card"
                  style={{ cursor: 'pointer', marginBottom: 0 }}
                  onClick={() => navigate(item.type === 'purchase' ? `/purchase/${item.id}` : `/contract/${item.id}`)}
                >
                  <div className="dash-item-body">
                    <div className="dash-item-name">{item.name}</div>
                    <div className="dash-item-meta">
                      {item.meta}{item.endDate && <> · fin {formatDate(item.endDate)}</>}
                    </div>
                  </div>
                  <div className="dash-item-right">
                    <span className={`badge ${sc.badge}`}>{sc.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {surveillerItems.length > 2 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 18 }}>
              <button
                onClick={() => scrollSurveiller(-1)}
                aria-label="Précédent"
                style={{
                  width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--line)',
                  background: '#fff', color: 'var(--navy)', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <Icon name="chevron-left" style={{ fontSize: 14 }} />
              </button>
              <button
                onClick={() => scrollSurveiller(1)}
                aria-label="Suivant"
                style={{
                  width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--line)',
                  background: '#fff', color: 'var(--navy)', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <Icon name="chevron-down" style={{ fontSize: 14, transform: 'rotate(-90deg)' }} />
              </button>
            </div>
          )}
        </>
      )}

      {!loading && (totalProtectedValue > 0 || monthlySpend > 0 || (totalDonated && totalDonated > 0)) && (
        <div className="chiffres-grid">
          <div className="chiffre-mini">
            <div className="v">{totalProtectedValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</div>
            <div className="l">Valeur protégée</div>
          </div>
          <div className="chiffre-mini">
            <div className="v">{monthlySpend.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €</div>
            <div className="l">Abos / mois</div>
          </div>
          <div className="chiffre-mini">
            <div className="v" style={{ color: totalDonated ? 'var(--blue)' : 'var(--ink-faint)' }}>
              {totalDonated ? totalDonated.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €' : '—'}
            </div>
            <div className="l">Donnés</div>
          </div>
        </div>
      )}

      {/* La bannière "documents en attente" a été retirée : le bouton
          "Docs en attente" ci-dessus (avec badge de comptage) couvre
          désormais ce besoin, sans dupliquer l'information. */}


      <div ref={listsRef}>
        {categoryView === 'garanties' ? (
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
        ) : (
          <div className="dash-list-block">
            <div className="dash-list-head">
              <div className="dash-list-title">
                <span className="dash-list-dot amber"></span>
                {categoryView === 'contrat' ? 'Contrats' : 'Abonnements'}
                {' '}<span className="dash-list-count">{filteredContracts.length}</span>
                <button onClick={() => setCategoryView('garanties')} style={{
                  marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--blue)', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
                }}>
                  ← Garanties
                </button>
              </div>
              {filteredContracts.length > 0 && <SortBtn value={contractSort} onChange={setContractSort} />}
            </div>

            {loading ? (
              <div className="dash-list-empty">Chargement…</div>
            ) : filteredContracts.length === 0 ? (
              <div className="dash-list-empty">
                <Icon name="shield-check" style={{ fontSize: 28, color: 'var(--line)', display: 'block', margin: '0 auto 10px' }} />
                {categoryView === 'contrat' ? 'Aucun contrat enregistré' : 'Aucun abonnement enregistré'}
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
        )}
      </div>
    </>
  );
}
