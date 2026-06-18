import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
}

export default function ContractsPage() {
  const { profile } = useOutletContext();
  const orgId = profile?.organization_id;

  const [contracts, setContracts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from('contracts').select('*').eq('organization_id', orgId).order('end_date'),
        supabase.from('purchases').select('id, object_name, warranty_end_date, brand').eq('organization_id', orgId).order('warranty_end_date'),
      ]);
      setContracts(c || []);
      setPurchases(p || []);
      setLoading(false);
    })();
  }, [orgId]);

  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const expiringPurchases = purchases.filter(p => {
    if (!p.warranty_end_date) return false;
    const d = new Date(p.warranty_end_date);
    return d > now && d <= in60;
  });

  const expiredPurchases = purchases.filter(p => {
    if (!p.warranty_end_date) return false;
    return new Date(p.warranty_end_date) < now;
  });

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Contrats & échéances</div>
          <h1 style={{ color: '#fff' }}>Vos échéances</h1>
          <p className="sub">Garanties, contrats et assurances à surveiller</p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {[
          { id: 'all', label: 'Tout' },
          { id: 'expiring', label: `Bientôt (${expiringPurchases.length})` },
          { id: 'expired', label: `Expirés (${expiredPurchases.length})` },
          { id: 'contracts', label: `Contrats (${contracts.length})` },
        ].map(t => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
            style={{ cursor: 'pointer' }} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 32 }}>Chargement…</p>
      ) : (
        <>
          {(tab === 'all' || tab === 'expiring') && expiringPurchases.length > 0 && (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header">
                <h3>
                  <div className="panel-header-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}>
                    <Icon name="clock" />
                  </div>
                  Garanties bientôt expirées
                </h3>
              </div>
              <div className="panel-body">
                {expiringPurchases.map(p => {
                  const days = daysUntil(p.warranty_end_date);
                  return (
                    <div key={p.id} className="purchase-row">
                      <div className="purchase-icon"><Icon name="alert-triangle" style={{ color: 'var(--amber)' }} /></div>
                      <div className="purchase-main">
                        <div className="purchase-title">{p.object_name}</div>
                        <div className="purchase-meta">{p.brand} · Expire le {formatDate(p.warranty_end_date)}</div>
                      </div>
                      <span className="badge amber">J-{days}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(tab === 'all' || tab === 'contracts') && contracts.length > 0 && (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header">
                <h3>
                  <div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}>
                    <Icon name="file-text" />
                  </div>
                  Contrats & assurances
                </h3>
              </div>
              <div className="panel-body">
                {contracts.map(c => {
                  const days = daysUntil(c.end_date);
                  const expired = days !== null && days < 0;
                  return (
                    <div key={c.id} className="purchase-row">
                      <div className="purchase-icon"><Icon name="shield-check" style={{ color: 'var(--blue)' }} /></div>
                      <div className="purchase-main">
                        <div className="purchase-title">{c.name}</div>
                        <div className="purchase-meta">{c.provider} · {expired ? 'Expiré' : `Expire le ${formatDate(c.end_date)}`}</div>
                      </div>
                      <span className={`badge ${expired ? 'red' : days !== null && days <= 30 ? 'amber' : 'green'}`}>
                        {expired ? 'Expiré' : days !== null && days <= 30 ? `J-${days}` : 'Actif'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(tab === 'all' || tab === 'expired') && expiredPurchases.length > 0 && (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header">
                <h3>
                  <div className="panel-header-icon" style={{ background: 'var(--red-pale)', color: 'var(--red-text)' }}>
                    <Icon name="receipt-off" />
                  </div>
                  Garanties expirées
                </h3>
              </div>
              <div className="panel-body">
                {expiredPurchases.map(p => (
                  <div key={p.id} className="purchase-row">
                    <div className="purchase-icon" style={{ opacity: 0.5 }}><Icon name="package" /></div>
                    <div className="purchase-main">
                      <div className="purchase-title" style={{ opacity: 0.7 }}>{p.object_name}</div>
                      <div className="purchase-meta">Expirée le {formatDate(p.warranty_end_date)}</div>
                    </div>
                    <span className="badge red">Expirée</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'all' && contracts.length === 0 && expiringPurchases.length === 0 && expiredPurchases.length === 0 && (
            <div className="empty-state">
              <div className="icon-circle"><Icon name="circle-check" /></div>
              <div className="title">Tout est à jour</div>
              <div className="sub">Aucune échéance imminente ni garantie expirée. Bravo !</div>
            </div>
          )}
        </>
      )}
    </>
  );
}
