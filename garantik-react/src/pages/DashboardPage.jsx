import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { listPurchases, countPurchasesByStatus } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';

function purchaseStatus(purchase) {
  if (!purchase.warranty_end_date) return 'active';
  const end = new Date(purchase.warranty_end_date);
  const now = new Date();
  const in60days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  if (end < now) return 'expired';
  if (end <= in60days) return 'expiring';
  return 'active';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DashboardPage() {
  const { profile } = useOutletContext();
  const navigate = useNavigate();

  const [purchases, setPurchases] = useState([]);
  const [stats, setStats] = useState({ all: 0, active: 0, expiring: 0, expired: 0 });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const orgId = profile?.organization_id;

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [{ data: purchaseData }, statData] = await Promise.all([
        listPurchases(orgId),
        countPurchasesByStatus(orgId),
      ]);
      setPurchases(purchaseData || []);
      setStats(statData);
      setLoading(false);
    })();
  }, [orgId]);

  const filteredPurchases = purchases.filter((p) => filter === 'all' || purchaseStatus(p) === filter);

  const listTitles = {
    all: 'Achats récents',
    active: 'Garanties actives',
    expiring: 'Garanties bientôt expirées',
    expired: 'Garanties expirées',
  };

  const expiringSoonCount = stats.expiring;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Tableau de bord</div>
          <h1 style={{ color: '#fff' }}>Bonjour {profile?.full_name?.split(' ')[0] || ''}</h1>
          <p className="sub">
            {expiringSoonCount > 0
              ? `${expiringSoonCount} garantie${expiringSoonCount > 1 ? 's' : ''} expirent dans les 60 prochains jours`
              : 'Toutes vos garanties sont à jour'}
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
          <div className="num">{stats.all}</div>
          <div className="label">Tous mes achats</div>
        </div>
        <div className={`stat-card ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')} style={{ cursor: 'pointer' }}>
          <div className="icon-badge green"><Icon name="circle-check" /></div>
          <div className="num">{stats.active}</div>
          <div className="label">Garanties actives</div>
        </div>
        <div className={`stat-card ${filter === 'expiring' ? 'active' : ''}`} onClick={() => setFilter('expiring')} style={{ cursor: 'pointer' }}>
          <div className="icon-badge amber"><Icon name="clock" /></div>
          <div className="num">{stats.expiring}</div>
          <div className="label">Bientôt expirées</div>
        </div>
        <div className={`stat-card ${filter === 'expired' ? 'active' : ''}`} onClick={() => setFilter('expired')} style={{ cursor: 'pointer' }}>
          <div className="icon-badge red"><Icon name="alert-triangle" /></div>
          <div className="num">{stats.expired}</div>
          <div className="label">Expirées</div>
        </div>
      </div>

      <div className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <h3>
              <div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}>
                <Icon name="receipt" />
              </div>
              {listTitles[filter]}
            </h3>
            <a href="/dashboard" style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}>Tout voir</a>
          </div>
          <div className="panel-body">
            {loading ? (
              <p style={{ padding: 20, color: 'var(--ink-faint)' }}>Chargement…</p>
            ) : filteredPurchases.length === 0 ? (
              <div className="empty-state">
                <div className="icon-circle"><Icon name="package" /></div>
                <div className="title">Aucun achat pour l'instant</div>
                <div className="sub">Ajoutez votre premier achat pour commencer à suivre vos garanties.</div>
              </div>
            ) : (
              filteredPurchases.map((p) => {
                const status = purchaseStatus(p);
                const badgeClass = status === 'active' ? 'green' : status === 'expiring' ? 'amber' : 'red';
                const badgeLabel = status === 'active' ? 'Active' : status === 'expiring' ? `Expire le ${formatDate(p.warranty_end_date)}` : 'Expirée';
                return (
                  <div key={p.id} className="purchase-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchase/${p.id}`)}>
                    <div className="purchase-icon"><Icon name="package" /></div>
                    <div className="purchase-main">
                      <div className="purchase-title">{p.object_name}</div>
                      <div className="purchase-meta">{[p.brand, p.store, formatDate(p.purchase_date)].filter(Boolean).join(' · ')}</div>
                    </div>
                    <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
                    {p.total_amount && <div className="purchase-amount">{p.total_amount} €</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
