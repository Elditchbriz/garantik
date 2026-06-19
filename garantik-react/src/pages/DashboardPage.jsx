import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase, listPurchases, countPurchasesByStatus } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';

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

export default function DashboardPage() {
  const { profile } = useOutletContext();
  const navigate = useNavigate();

  const [purchases, setPurchases] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [stats, setStats] = useState({ all: 0, active: 0, expiring: 0, expired: 0 });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

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

  const filteredPurchases = purchases.filter((p) => filter === 'all' || itemStatus(p.warranty_end_date) === filter);
  const filteredContracts = contracts.filter((c) => filter === 'all' || itemStatus(c.end_date) === filter);

  const expiringSoonCount = stats.expiring + contracts.filter(c => itemStatus(c.end_date) === 'expiring').length;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Tableau de bord</div>
          <h1 style={{ color: '#fff' }}>Bonjour {profile?.full_name?.split(' ')[0] || ''}</h1>
          <p className="sub">
            {expiringSoonCount > 0
              ? `${expiringSoonCount} échéance${expiringSoonCount > 1 ? 's' : ''} dans les 60 prochains jours`
              : 'Tout est à jour'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '16px 20px', fontSize: 15, gap: 10 }}
          onClick={() => navigate('/add-purchase')}>
          <Icon name="plus" style={{ fontSize: 18 }} /> Nouvel achat
        </button>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '16px 20px', fontSize: 15, gap: 10 }}
          onClick={() => navigate('/add-contract')}>
          <Icon name="shield-check" style={{ fontSize: 18 }} /> Nouveau contrat
        </button>
      </div>

      <div className="stat-row">
        <div className={`stat-card ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')} style={{ cursor: 'pointer' }}>
          <div className="icon-badge blue"><Icon name="package" /></div>
          <div className="num">{stats.all + contracts.length}</div>
          <div className="label">Au total</div>
        </div>
        <div className={`stat-card ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')} style={{ cursor: 'pointer' }}>
          <div className="icon-badge green"><Icon name="circle-check" /></div>
          <div className="num">{stats.active + contracts.filter(c => itemStatus(c.end_date) === 'active').length}</div>
          <div className="label">Actifs</div>
        </div>
        <div className={`stat-card ${filter === 'expiring' ? 'active' : ''}`} onClick={() => setFilter('expiring')} style={{ cursor: 'pointer' }}>
          <div className="icon-badge amber"><Icon name="clock" /></div>
          <div className="num">{expiringSoonCount}</div>
          <div className="label">Bientôt</div>
        </div>
        <div className={`stat-card ${filter === 'expired' ? 'active' : ''}`} onClick={() => setFilter('expired')} style={{ cursor: 'pointer' }}>
          <div className="icon-badge red"><Icon name="alert-triangle" /></div>
          <div className="num">{stats.expired + contracts.filter(c => itemStatus(c.end_date) === 'expired').length}</div>
          <div className="label">Expirés</div>
        </div>
      </div>

      {/* Bloc Achats */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <h3>
            <div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}>
              <Icon name="package" />
            </div>
            Achats ({filteredPurchases.length})
          </h3>
        </div>
        <div className="panel-body">
          {loading ? (
            <p style={{ padding: 20, color: 'var(--ink-faint)' }}>Chargement…</p>
          ) : filteredPurchases.length === 0 ? (
            <div className="empty-state">
              <div className="icon-circle"><Icon name="package" /></div>
              <div className="title">Aucun achat</div>
              <div className="sub">Ajoutez votre premier achat pour commencer à suivre vos garanties.</div>
            </div>
          ) : (
            filteredPurchases.map((p) => {
              const status = itemStatus(p.warranty_end_date);
              return (
                <div key={p.id} className="purchase-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchase/${p.id}`)}>
                  <div className="purchase-icon"><Icon name="package" /></div>
                  <div className="purchase-main">
                    <div className="purchase-title">{p.object_name}</div>
                    <div className="purchase-meta">
                      {[p.brand, p.store].filter(Boolean).join(' · ')}
                      {p.purchase_date && <> · Acheté le {formatDate(p.purchase_date)}</>}
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
      </div>

      {/* Bloc Contrats */}
      <div className="panel">
        <div className="panel-header">
          <h3>
            <div className="panel-header-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}>
              <Icon name="shield-check" />
            </div>
            Contrats et abonnements ({filteredContracts.length})
          </h3>
        </div>
        <div className="panel-body">
          {loading ? (
            <p style={{ padding: 20, color: 'var(--ink-faint)' }}>Chargement…</p>
          ) : filteredContracts.length === 0 ? (
            <div className="empty-state">
              <div className="icon-circle"><Icon name="shield-check" /></div>
              <div className="title">Aucun contrat</div>
              <div className="sub">Assurances, abonnements, extensions de garantie…</div>
            </div>
          ) : (
            filteredContracts.map((c) => {
              const status = itemStatus(c.end_date);
              return (
                <div key={c.id} className="purchase-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/contract/${c.id}`)}>
                  <div className="purchase-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}><Icon name="shield-check" /></div>
                  <div className="purchase-main">
                    <div className="purchase-title">{c.name}</div>
                    <div className="purchase-meta">
                      {[c.provider, c.contract_type].filter(Boolean).join(' · ')}
                      {c.start_date && <> · Débuté le {formatDate(c.start_date)}</>}
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
      </div>
    </>
  );
}
