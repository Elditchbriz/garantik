// AdminPage.jsx
// Console d'administration — accessible uniquement aux comptes
// avec profiles.is_platform_admin = true.
//
// À intégrer dans le routeur existant, par exemple avec react-router :
//   <Route path="/admin" element={<AdminPage />} />
//
// Suppose l'existence d'un client Supabase déjà initialisé,
// importé ici depuis '../supabaseClient' — ajuste le chemin
// selon ta structure de projet réelle.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const STATUS_LABELS = {
  active: { label: 'Actif', color: '#16A34A', bg: '#F0FDF4' },
  read_only: { label: 'Lecture seule', color: '#D97706', bg: '#FFFBEB' },
  suspended: { label: 'Suspendu', color: '#DC2626', bg: '#FEF2F2' },
};

async function callAdminApi(action, payload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-api`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, payload }),
    }
  );

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erreur inconnue');
  return json;
}

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.active;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: s.color,
        background: s.bg,
      }}
    >
      {s.label}
    </span>
  );
}

function AccessDenied() {
  return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', fontFamily: '-apple-system, sans-serif' }}>
      <h2 style={{ color: '#0F172A' }}>Accès non autorisé</h2>
      <p style={{ color: '#64748B' }}>Cette page est réservée à l'administration de Garantik.</p>
    </div>
  );
}

function OrgDetailPanel({ organizationId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quotaInput, setQuotaInput] = useState('');
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const { detail } = await callAdminApi('get_organization_detail', { organization_id: organizationId });
      setDetail(detail);
      setQuotaInput(detail.organization.quota_override ?? '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function handleSetStatus(status) {
    try {
      await callAdminApi('set_status', { organization_id: organizationId, status });
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveQuota() {
    try {
      const value = quotaInput === '' ? null : parseInt(quotaInput, 10);
      await callAdminApi('set_quota', { organization_id: organizationId, quota_override: value });
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSetManualPremium(enable) {
    try {
      await callAdminApi('set_manual_premium', { organization_id: organizationId, enable });
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        padding: 24, overflowY: 'auto', fontFamily: '-apple-system, sans-serif',
        zIndex: 50,
      }}
    >
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 14, marginBottom: 16 }}>
        ← Fermer
      </button>

      {loading && <p>Chargement...</p>}
      {error && <p style={{ color: '#DC2626' }}>{error}</p>}

      {detail && (
        <>
          <h2 style={{ fontSize: 18, color: '#0F172A', marginBottom: 4 }}>{detail.organization.name}</h2>
          <div style={{ marginBottom: 20 }}>
            <StatusBadge status={detail.organization.status} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>Achats</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{detail.purchases_count}</div>
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>Contrats</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{detail.contracts_count}</div>
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>Parrainages envoyés</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{detail.referrals_sent}</div>
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>Parrainages reçus</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{detail.referrals_received}</div>
            </div>
          </div>

          <h3 style={{ fontSize: 14, color: '#0F172A', marginBottom: 8 }}>Membres</h3>
          <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
            {detail.profiles.map((p) => (
              <li key={p.id} style={{ fontSize: 13, color: '#334155', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                {p.full_name || 'Sans nom'} — {p.email}
              </li>
            ))}
          </ul>

          <h3 style={{ fontSize: 14, color: '#0F172A', marginBottom: 8 }}>Abonnement</h3>
          <div style={{ marginBottom: 12, fontSize: 13, color: '#334155' }}>
            Plan actuel : <strong>{detail.organization.plan === 'premium' ? 'Premium' : 'Gratuit'}</strong>
            {detail.organization.plan === 'premium' && detail.organization.stripe_subscription_id && (
              <span style={{ color: '#64748B' }}> (abonnement Stripe payant)</span>
            )}
            {detail.organization.plan === 'premium' && !detail.organization.stripe_subscription_id && (
              <span style={{ color: '#64748B' }}> (accordé manuellement)</span>
            )}
            {detail.organization.plan === 'premium' && detail.organization.stripe_cancel_at_period_end && (
              <div style={{ marginTop: 4, fontSize: 12, color: '#92400E' }}>
                ⚠️ Résiliation programmée par le client
              </div>
            )}
          </div>

          {detail.organization.stripe_subscription_id ? (
            <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 24, lineHeight: 1.5 }}>
              Ce compte a un abonnement Stripe actif — pour le résilier, passez par le portail Stripe
              (Dashboard Stripe → Clients), pas par ici, sinon le compte redeviendra premium au
              prochain événement Stripe.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              {detail.organization.plan !== 'premium' ? (
                <button onClick={() => handleSetManualPremium(true)} style={btnStyle('#D97706')}>
                  Accorder le premium manuellement
                </button>
              ) : (
                <button onClick={() => handleSetManualPremium(false)} style={btnStyle('#64748B')}>
                  Retirer le premium manuel
                </button>
              )}
            </div>
          )}

          <h3 style={{ fontSize: 14, color: '#0F172A', marginBottom: 8 }}>Statut du compte</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            <button onClick={() => handleSetStatus('active')} style={btnStyle('#16A34A')}>Activer</button>
            <button onClick={() => handleSetStatus('read_only')} style={btnStyle('#D97706')}>Lecture seule</button>
            <button onClick={() => handleSetStatus('suspended')} style={btnStyle('#DC2626')}>Suspendre</button>
          </div>

          <h3 style={{ fontSize: 14, color: '#0F172A', marginBottom: 8 }}>Quota personnalisé</h3>
          <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>
            Laisser vide pour revenir au quota par défaut du plan.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              value={quotaInput}
              onChange={(e) => setQuotaInput(e.target.value)}
              placeholder="Défaut (10)"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}
            />
            <button onClick={handleSaveQuota} style={btnStyle('#1E3A6E')}>Enregistrer</button>
          </div>
        </>
      )}
    </div>
  );
}

function btnStyle(color) {
  return {
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

const ACTION_LABELS = {
  set_status: 'Changement de statut',
  set_quota: 'Modification du quota',
};

function formatActionDetails(log) {
  if (log.action === 'set_status') {
    const s = STATUS_LABELS[log.details?.new_status];
    return s ? `→ ${s.label}` : '';
  }
  if (log.action === 'set_quota') {
    const v = log.details?.quota_override;
    return v === null || v === undefined ? '→ quota par défaut' : `→ ${v} éléments`;
  }
  return '';
}

function AuditLogView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { logs } = await callAdminApi('list_audit_log', { limit: 100 });
        setLogs(logs);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={{ color: '#64748B', fontSize: 14 }}>Chargement...</p>;
  if (error) return <p style={{ color: '#DC2626' }}>{error}</p>;
  if (logs.length === 0) {
    return <p style={{ color: '#94A3B8', fontSize: 14 }}>Aucune action enregistrée pour le moment.</p>;
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Admin</th>
            <th style={thStyle}>Action</th>
            <th style={thStyle}>Organisation</th>
            <th style={thStyle}>Détail</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} style={{ borderTop: '1px solid #F1F5F9' }}>
              <td style={tdStyle}>
                {new Date(log.created_at).toLocaleString('fr-FR', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </td>
              <td style={tdStyle}>{log.admin?.full_name || log.admin?.email || '—'}</td>
              <td style={tdStyle}>{ACTION_LABELS[log.action] || log.action}</td>
              <td style={tdStyle}>{log.organization?.name || '—'}</td>
              <td style={tdStyle}>{formatActionDetails(log)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const GLOBAL_LIST_TABS = [
  { table: 'global_categories', label: 'Catégories' },
  { table: 'global_brands', label: 'Marques' },
  { table: 'global_stores', label: 'Enseignes' },
  { table: 'global_contract_types', label: 'Types de contrat' },
  { table: 'global_providers', label: 'Prestataires' },
];

function GlobalListsView() {
  const [activeTable, setActiveTable] = useState(GLOBAL_LIST_TABS[0].table);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { items } = await callAdminApi('list_global_items', { table: activeTable });
      setItems(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTable]);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await callAdminApi('add_global_item', { table: activeTable, name: newName.trim() });
      setNewName('');
      await loadItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    try {
      await callAdminApi('delete_global_item', { table: activeTable, id });
      await loadItems();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 1.5 }}>
        Ces valeurs sont copiées automatiquement dans chaque nouveau compte à l'inscription.
        Modifier cette liste n'affecte pas les comptes déjà créés.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {GLOBAL_LIST_TABS.map((t) => (
          <button
            key={t.table}
            onClick={() => setActiveTable(t.table)}
            style={{
              padding: '7px 14px', borderRadius: 999, border: '1px solid #E2E8F0', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600,
              background: activeTable === t.table ? '#1E3A6E' : '#fff',
              color: activeTable === t.table ? '#fff' : '#64748B',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#DC2626' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 420 }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Ajouter une valeur..."
          style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13.5 }}
        />
        <button onClick={handleAdd} disabled={adding || !newName.trim()} style={btnStyle('#1E3A6E')}>
          Ajouter
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#64748B', fontSize: 14 }}>Chargement...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#94A3B8', fontSize: 14 }}>Aucune valeur pour l'instant.</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: 420 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderBottom: '1px solid #F1F5F9', fontSize: 13.5, color: '#334155',
              }}
            >
              {item.name}
              <button
                onClick={() => handleDelete(item.id)}
                style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricsView({ onSelectOrg }) {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');
  const [selectedMetric, setSelectedMetric] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await callAdminApi('get_metrics');
        setMetrics(data);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  if (error) return <p style={{ color: '#DC2626' }}>{error}</p>;
  if (!metrics) return <p style={{ color: '#64748B', fontSize: 14 }}>Chargement...</p>;

  const last7 = metrics.signups_last_30_days.slice(-7);
  const signups7d = last7.reduce((sum, d) => sum + d.count, 0);
  const signups30d = metrics.signups_last_30_days.reduce((sum, d) => sum + d.count, 0);
  const maxDayCount = Math.max(1, ...metrics.signups_last_30_days.map((d) => d.count));

  const METRIC_CARDS = [
    { key: 'all', label: 'Total comptes', value: metrics.total_organizations },
    { key: 'signups_7d', label: 'Inscriptions (7j)', value: signups7d },
    { key: 'signups_30d', label: 'Inscriptions (30j)', value: signups30d },
    { key: 'premium', label: 'Comptes premium', value: metrics.plan_premium_count, sub: `${metrics.conversion_rate}% de conversion` },
    { key: 'temp_premium', label: 'Premium temporaire', value: metrics.temp_premium_count, sub: 'via parrainage' },
    { key: 'premium', label: 'MRR estimé', value: `${metrics.mrr_estimate.toFixed(2)} €`, sub: 'basé sur les abonnements payants', highlight: true },
  ];

  const drilldownList = selectedMetric ? metrics.drilldown[selectedMetric] : null;
  const drilldownLabel = METRIC_CARDS.find((c) => c.key === selectedMetric)?.label;

  // Repères de dates sous le graphique (début, milieu, fin) pour donner une échelle sans surcharger
  const dateLabels = metrics.signups_last_30_days;
  const firstLabel = dateLabels[0]?.date;
  const midLabel = dateLabels[Math.floor(dateLabels.length / 2)]?.date;
  const lastLabel = dateLabels[dateLabels.length - 1]?.date;
  const formatShortDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {METRIC_CARDS.map((card, i) => (
          <MetricCard
            key={i}
            label={card.label}
            value={card.value}
            sub={card.sub}
            highlight={card.highlight}
            active={selectedMetric === card.key}
            onClick={() => setSelectedMetric(selectedMetric === card.key ? null : card.key)}
          />
        ))}
      </div>

      <p style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 16 }}>
        Le MRR est une estimation à partir du prix affiché (19,99€/an) — remplacé par les données réelles une fois Stripe branché.
        Cliquez sur une carte pour voir la liste des organisations concernées.
      </p>

      {drilldownList && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 24 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{drilldownLabel} ({drilldownList.length})</span>
            <button onClick={() => setSelectedMetric(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 12.5 }}>
              Fermer ✕
            </button>
          </div>
          {drilldownList.length === 0 ? (
            <p style={{ padding: 16, color: '#94A3B8', fontSize: 13.5 }}>Aucune organisation dans cette catégorie.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <tbody>
                {drilldownList.map((org) => (
                  <tr key={org.id} onClick={() => onSelectOrg(org.id)} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer' }}>
                    <td style={tdStyle}>{org.name || '—'}</td>
                    <td style={tdStyle}>{org.owner_email || '—'}</td>
                    <td style={tdStyle}><StatusBadge status={org.status} /></td>
                    <td style={tdStyle}>{new Date(org.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: 14, color: '#0F172A', marginBottom: 16 }}>Inscriptions — 30 derniers jours</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Axe Y : repères du nombre d'inscriptions */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 100, fontSize: 10.5, color: '#94A3B8', textAlign: 'right', width: 18 }}>
            <span>{maxDayCount}</span>
            <span>{Math.ceil(maxDayCount / 2)}</span>
            <span>0</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, borderLeft: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', paddingLeft: 4 }}>
              {metrics.signups_last_30_days.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date} : ${d.count}`}
                  style={{
                    flex: 1, background: d.count > 0 ? '#5B5FEF' : '#F1F5F9',
                    height: `${Math.max(4, (d.count / maxDayCount) * 100)}%`,
                    borderRadius: 2,
                  }}
                />
              ))}
            </div>
            {/* Axe X : repères de dates (début / milieu / fin) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: '#94A3B8', paddingLeft: 4 }}>
              <span>{formatShortDate(firstLabel)}</span>
              <span>{formatShortDate(midLabel)}</span>
              <span>{formatShortDate(lastLabel)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, highlight, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: highlight ? '#1E3A6E' : '#fff', borderRadius: 12, padding: 16,
        boxShadow: active ? '0 0 0 2px #5B5FEF' : '0 1px 3px rgba(0,0,0,0.06)',
        cursor: 'pointer', transition: 'box-shadow 0.15s',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color: highlight ? '#fff' : '#0F172A' }}>{value}</div>
      <div style={{ fontSize: 12, color: highlight ? 'rgba(255,255,255,0.8)' : '#64748B', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: highlight ? 'rgba(255,255,255,0.6)' : '#94A3B8', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function UpdatesAdminView() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showAsPopup, setShowAsPopup] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  const loadUpdates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { updates } = await callAdminApi('list_updates');
      setUpdates(updates);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUpdates(); }, [loadUpdates]);

  async function handlePublish() {
    if (!title.trim() || !content.trim()) return;
    // L'envoi email touche potentiellement tous les utilisateurs : on
    // demande une confirmation explicite avant de partir, pas de retour possible.
    if (sendEmail && !confirmSend) {
      setConfirmSend(true);
      return;
    }
    setPublishing(true);
    setError('');
    try {
      await callAdminApi('create_update', { title, content, show_as_popup: showAsPopup, send_email: sendEmail });
      setTitle('');
      setContent('');
      setShowAsPopup(true);
      setSendEmail(false);
      setConfirmSend(false);
      setShowForm(false);
      await loadUpdates();
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cette nouveauté ? Elle disparaîtra aussi des popups déjà envoyées.')) return;
    try {
      await callAdminApi('delete_update', { id });
      await loadUpdates();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      {error && <p style={{ color: '#DC2626', marginBottom: 12 }}>{error}</p>}

      {!showForm ? (
        <button onClick={() => setShowForm(true)} style={btnStyle('#1E3A6E')}>
          + Publier une nouveauté
        </button>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: 560 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Nouveau : suivi du préavis de résiliation"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13.5, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Contenu</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Décrivez la nouveauté en quelques lignes..."
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155', marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={showAsPopup} onChange={(e) => setShowAsPopup(e.target.checked)} />
            Afficher en popup à la connexion des utilisateurs
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155', marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={sendEmail} onChange={(e) => { setSendEmail(e.target.checked); setConfirmSend(false); }} />
            Envoyer un email à tous les utilisateurs
          </label>

          {confirmSend && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#FFFBEB', color: '#92400E', fontSize: 12.5, marginBottom: 14 }}>
              Cet email partira à <strong>tous les utilisateurs de Garantik</strong>, sans possibilité d'annulation une fois lancé. Clique à nouveau sur "Publier" pour confirmer.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setShowForm(false); setConfirmSend(false); }}
              style={{ background: '#F1F5F9', color: '#334155', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
            >
              Annuler
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || !title.trim() || !content.trim()}
              style={btnStyle(confirmSend ? '#DC2626' : '#1E3A6E', publishing || !title.trim() || !content.trim())}
            >
              {publishing ? 'Publication...' : confirmSend ? 'Confirmer l\'envoi' : 'Publier'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#64748B', fontSize: 14 }}>Chargement...</p>
      ) : updates.length === 0 ? (
        <p style={{ color: '#94A3B8', fontSize: 14 }}>Aucune nouveauté publiée pour l'instant.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
          {updates.map((u) => (
            <div key={u.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{u.title}</span>
                <button onClick={() => handleDelete(u.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                  Supprimer
                </button>
              </div>
              <p style={{ fontSize: 13, color: '#64748B', whiteSpace: 'pre-wrap', marginBottom: 10 }}>{u.content}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: '#F1F5F9', color: '#64748B' }}>
                  {new Date(u.created_at).toLocaleDateString('fr-FR')}
                </span>
                {u.show_as_popup && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: '#EEF2FF', color: '#1E3A6E' }}>
                    Popup active
                  </span>
                )}
                {u.email_sent_at && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: '#F0FDF4', color: '#16A34A' }}>
                    Email envoyé le {new Date(u.email_sent_at).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FEEDBACK_STATUS_CONFIG = {
  new: { label: 'Nouveau', bg: '#EEF2FF', color: '#1E3A6E' },
  read: { label: 'Lu', bg: '#F1F5F9', color: '#64748B' },
  archived: { label: 'Archivé', bg: '#F8FAFC', color: '#94A3B8' },
};

function FeedbackAdminView() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { feedback } = await callAdminApi('list_feedback');
      setFeedback(feedback);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFeedback(); }, [loadFeedback]);

  async function handleSetStatus(id, status) {
    try {
      await callAdminApi('update_feedback_status', { id, status });
      await loadFeedback();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cette remontée ?')) return;
    try {
      await callAdminApi('delete_feedback', { id });
      await loadFeedback();
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = filter === 'all' ? feedback : feedback.filter((f) => f.status === filter);
  const newCount = feedback.filter((f) => f.status === 'new').length;

  return (
    <div>
      {error && <p style={{ color: '#DC2626', marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { id: 'all', label: 'Toutes' },
          { id: 'new', label: `Nouvelles${newCount > 0 ? ` (${newCount})` : ''}` },
          { id: 'read', label: 'Lues' },
          { id: 'archived', label: 'Archivées' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '7px 14px', borderRadius: 999, border: '1px solid #E2E8F0', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600,
              background: filter === f.id ? '#1E3A6E' : '#fff',
              color: filter === f.id ? '#fff' : '#64748B',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#64748B', fontSize: 14 }}>Chargement...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#94A3B8', fontSize: 14 }}>Aucune remontée pour l'instant.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
          {filtered.map((f) => {
            const statusCfg = FEEDBACK_STATUS_CONFIG[f.status];
            return (
              <div key={f.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>
                      {f.profile?.full_name || f.profile?.email || 'Utilisateur inconnu'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#94A3B8' }}>
                      {f.organization?.name || '—'} · {new Date(f.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: statusCfg.bg, color: statusCfg.color, flexShrink: 0 }}>
                    {statusCfg.label}
                  </span>
                </div>
                <p style={{ fontSize: 13.5, color: '#334155', whiteSpace: 'pre-wrap', marginBottom: 12 }}>{f.message}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {f.status !== 'read' && (
                    <button onClick={() => handleSetStatus(f.id, 'read')} style={btnStyle('#64748B')}>Marquer comme lu</button>
                  )}
                  {f.status !== 'archived' && (
                    <button onClick={() => handleSetStatus(f.id, 'archived')} style={btnStyle('#94A3B8')}>Archiver</button>
                  )}
                  {f.status !== 'new' && (
                    <button onClick={() => handleSetStatus(f.id, 'new')} style={btnStyle('#1E3A6E')}>Remettre en nouveau</button>
                  )}
                  <button onClick={() => handleDelete(f.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CharitiesAdminView() {
  const [charities, setCharities] = useState([]);
  const [summary, setSummary] = useState([]);
  const [percentage, setPercentage] = useState(5);
  const [percentageInput, setPercentageInput] = useState('5');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ charities }, { summary }, { percentage }] = await Promise.all([
        callAdminApi('list_charities'),
        callAdminApi('list_donations_summary'),
        callAdminApi('get_donation_settings'),
      ]);
      setCharities(charities);
      setSummary(summary);
      setPercentage(percentage);
      setPercentageInput(String(percentage));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleAddCharity() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      if (editingId) {
        await callAdminApi('update_charity', { id: editingId, name: newName.trim(), description: newDescription.trim(), website_url: newWebsiteUrl.trim() });
      } else {
        await callAdminApi('create_charity', { name: newName.trim(), description: newDescription.trim(), website_url: newWebsiteUrl.trim() });
      }
      setNewName('');
      setNewDescription('');
      setNewWebsiteUrl('');
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  function handleStartEdit(charity) {
    setEditingId(charity.id);
    setNewName(charity.name);
    setNewDescription(charity.description || '');
    setNewWebsiteUrl(charity.website_url || '');
  }

  function handleCancelEdit() {
    setEditingId(null);
    setNewName('');
    setNewDescription('');
    setNewWebsiteUrl('');
  }

  async function handleToggleActive(charity) {
    try {
      await callAdminApi('update_charity', { id: charity.id, active: !charity.active });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteCharity(id) {
    if (!window.confirm("Supprimer cette association ? L'historique des dons déjà versés est conservé.")) return;
    try {
      await callAdminApi('delete_charity', { id });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSavePercentage() {
    const value = parseFloat(percentageInput);
    if (isNaN(value) || value < 0 || value > 100) return;
    try {
      await callAdminApi('set_donation_percentage', { percentage: value });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMarkPayoutDone(charityId, charityName, amount) {
    if (!window.confirm(`Confirmer que le virement de ${amount.toFixed(2)}€ à "${charityName}" a bien été effectué ?\n\nCette action marque tous les dons en attente pour cette association comme réglés.`)) return;
    try {
      await callAdminApi('mark_charity_payout_done', { charity_id: charityId });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p style={{ color: '#64748B', fontSize: 14 }}>Chargement...</p>;

  return (
    <div>
      {error && <p style={{ color: '#DC2626', marginBottom: 12 }}>{error}</p>}

      {/* Réglage du pourcentage */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: 480 }}>
        <h3 style={{ fontSize: 14, color: '#0F172A', marginBottom: 8 }}>Pourcentage reversé</h3>
        <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>
          Part de chaque paiement premium reversée à l'association choisie par le client. Actuel : <strong>{percentage}%</strong>
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number" min="10" max="100" step="0.5"
            value={percentageInput}
            onChange={(e) => setPercentageInput(e.target.value)}
            style={{ width: 100, padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}
          />
          <button onClick={handleSavePercentage} style={btnStyle('#1E3A6E')}>Enregistrer</button>
        </div>
      </div>

      {/* Montants à verser */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, color: '#0F172A', marginBottom: 10 }}>Montants collectés par association</h3>
        {summary.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: 14 }}>Aucun don enregistré pour l'instant.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 }}>
            {summary.map((s) => (
              <div key={s.charity_id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{s.charity_name}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                    Déjà versé : {s.paid_amount.toFixed(2)}€
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.pending_amount > 0 ? '#D97706' : '#94A3B8' }}>
                    {s.pending_amount.toFixed(2)}€
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>en attente de virement</div>
                  {s.pending_amount > 0 && (
                    <button onClick={() => handleMarkPayoutDone(s.charity_id, s.charity_name, s.pending_amount)} style={btnStyle('#16A34A')}>
                      Marquer comme viré
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gestion de la liste des associations */}
      <h3 style={{ fontSize: 14, color: '#0F172A', marginBottom: 10 }}>Associations proposées aux clients</h3>
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: 480 }}>
        <input
          type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom de l'association"
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13.5, marginBottom: 8, boxSizing: 'border-box' }}
        />
        <input
          type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Description courte (optionnel)"
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13.5, marginBottom: 8, boxSizing: 'border-box' }}
        />
        <input
          type="text" value={newWebsiteUrl} onChange={(e) => setNewWebsiteUrl(e.target.value)}
          placeholder="Lien du site (ex : https://...)"
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13.5, marginBottom: 10, boxSizing: 'border-box' }}
        />
        <button onClick={handleAddCharity} disabled={adding || !newName.trim()} style={btnStyle('#1E3A6E')}>
          {adding ? (editingId ? 'Enregistrement...' : 'Ajout...') : editingId ? 'Enregistrer les modifications' : '+ Ajouter l\'association'}
        </button>
        {editingId && (
          <button onClick={handleCancelEdit} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 12.5, marginLeft: 10 }}>
            Annuler
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
        {charities.map((c) => (
          <div key={c.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: c.active ? '#0F172A' : '#94A3B8' }}>
                {c.name} {!c.active && <span style={{ fontSize: 11, color: '#94A3B8' }}>(masquée)</span>}
              </div>
              {c.description && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>{c.description}</div>}
              {c.website_url && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{c.website_url}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => handleStartEdit(c)} style={btnStyle('#1E3A6E')}>
                Modifier
              </button>
              <button onClick={() => handleToggleActive(c)} style={btnStyle(c.active ? '#94A3B8' : '#16A34A')}>
                {c.active ? 'Masquer' : 'Réactiver'}
              </button>
              <button onClick={() => handleDeleteCharity(c.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FaqAdminView() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { faqs } = await callAdminApi('list_faqs');
      setFaqs(faqs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFaqs(); }, [loadFaqs]);

  function resetForm() {
    setQuestion('');
    setAnswer('');
    setEditingId(null);
  }

  function startEdit(faq) {
    setEditingId(faq.id);
    setQuestion(faq.question);
    setAnswer(faq.answer);
  }

  async function handleSave() {
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await callAdminApi('update_faq', { id: editingId, question: question.trim(), answer: answer.trim() });
      } else {
        const nextPosition = faqs.length > 0 ? Math.max(...faqs.map((f) => f.position)) + 1 : 1;
        await callAdminApi('create_faq', { question: question.trim(), answer: answer.trim(), position: nextPosition });
      }
      resetForm();
      await loadFaqs();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(faq) {
    try {
      await callAdminApi('update_faq', { id: faq.id, active: !faq.active });
      await loadFaqs();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cette question ?')) return;
    try {
      await callAdminApi('delete_faq', { id });
      await loadFaqs();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMove(faq, direction) {
    const sorted = [...faqs].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((f) => f.id === faq.id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;
    const other = sorted[swapIndex];
    try {
      await Promise.all([
        callAdminApi('update_faq', { id: faq.id, position: other.position }),
        callAdminApi('update_faq', { id: other.id, position: faq.position }),
      ]);
      await loadFaqs();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p style={{ color: '#64748B', fontSize: 14 }}>Chargement...</p>;

  const sortedFaqs = [...faqs].sort((a, b) => a.position - b.position);

  return (
    <div>
      {error && <p style={{ color: '#DC2626', marginBottom: 12 }}>{error}</p>}

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: 560 }}>
        <h3 style={{ fontSize: 14, color: '#0F172A', marginBottom: 12 }}>{editingId ? 'Modifier la question' : 'Ajouter une question'}</h3>
        <input
          type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question"
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13.5, marginBottom: 8, boxSizing: 'border-box' }}
        />
        <textarea
          value={answer} onChange={(e) => setAnswer(e.target.value)}
          placeholder="Réponse"
          rows={4}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical', marginBottom: 10, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving || !question.trim() || !answer.trim()} style={btnStyle('#1E3A6E')}>
            {saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : '+ Ajouter'}
          </button>
          {editingId && (
            <button onClick={resetForm} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 12.5 }}>
              Annuler
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 }}>
        {sortedFaqs.map((faq, i) => (
          <div key={faq.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: faq.active ? '#0F172A' : '#94A3B8' }}>
                {faq.question} {!faq.active && <span style={{ fontSize: 11, color: '#94A3B8' }}>(masquée)</span>}
              </span>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => handleMove(faq, 'up')} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#E2E8F0' : '#64748B', fontSize: 14 }}>▲</button>
                <button onClick={() => handleMove(faq, 'down')} disabled={i === sortedFaqs.length - 1} style={{ background: 'none', border: 'none', cursor: i === sortedFaqs.length - 1 ? 'default' : 'pointer', color: i === sortedFaqs.length - 1 ? '#E2E8F0' : '#64748B', fontSize: 14 }}>▼</button>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 10 }}>{faq.answer}</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => startEdit(faq)} style={btnStyle('#1E3A6E')}>Modifier</button>
              <button onClick={() => handleToggleActive(faq)} style={btnStyle(faq.active ? '#94A3B8' : '#16A34A')}>
                {faq.active ? 'Masquer' : 'Réactiver'}
              </button>
              <button onClick={() => handleDelete(faq.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('metrics');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [charityFilter, setCharityFilter] = useState('all');
  const [intervalFilter, setIntervalFilter] = useState('all');

  useEffect(() => {
    async function checkAccess() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setCheckingAccess(false);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', userData.user.id)
        .single();

      setIsAdmin(!!profile?.is_platform_admin);
      setCheckingAccess(false);
    }
    checkAccess();
  }, []);

  const loadOrganizations = useCallback(async () => {
    try {
      const { organizations } = await callAdminApi('list_organizations');
      setOrganizations(organizations);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadOrganizations();
  }, [isAdmin, loadOrganizations]);

  if (checkingAccess) return null;
  if (!isAdmin) return <AccessDenied />;

  const charityOptions = Array.from(new Set(organizations.map((o) => o.charity_name).filter(Boolean))).sort();

  const filtered = organizations
    .filter((org) => {
      const q = search.toLowerCase();
      const matchesSearch = org.name?.toLowerCase().includes(q) || org.owner_email?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
      const matchesPlan = planFilter === 'all' || (org.plan || 'free') === planFilter;
      const matchesCharity = charityFilter === 'all'
        || (charityFilter === 'none' ? !org.charity_name : org.charity_name === charityFilter);
      const matchesInterval = intervalFilter === 'all'
        || (intervalFilter === 'none' ? !org.subscription_interval : org.subscription_interval === intervalFilter);
      return matchesSearch && matchesStatus && matchesPlan && matchesCharity && matchesInterval;
    })
    .sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      // Valeurs manquantes toujours en fin de liste, quel que soit le sens du tri
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function formatDateOrDash(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return (
    <div style={{ padding: '32px 24px', fontFamily: '-apple-system, sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E3A6E', marginBottom: 4 }}>Console admin</h1>
      <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>
        {organizations.length} organisation{organizations.length > 1 ? 's' : ''}
      </p>

      {error && <p style={{ color: '#DC2626' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#F1F5F9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        <button
          onClick={() => setActiveTab('metrics')}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: activeTab === 'metrics' ? '#fff' : 'transparent',
            color: activeTab === 'metrics' ? '#1E3A6E' : '#64748B',
            boxShadow: activeTab === 'metrics' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Métriques
        </button>
        <button
          onClick={() => setActiveTab('organizations')}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: activeTab === 'organizations' ? '#fff' : 'transparent',
            color: activeTab === 'organizations' ? '#1E3A6E' : '#64748B',
            boxShadow: activeTab === 'organizations' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Organisations
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: activeTab === 'audit' ? '#fff' : 'transparent',
            color: activeTab === 'audit' ? '#1E3A6E' : '#64748B',
            boxShadow: activeTab === 'audit' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Historique
        </button>
        <button
          onClick={() => setActiveTab('global_lists')}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: activeTab === 'global_lists' ? '#fff' : 'transparent',
            color: activeTab === 'global_lists' ? '#1E3A6E' : '#64748B',
            boxShadow: activeTab === 'global_lists' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Paramétrage
        </button>
        <button
          onClick={() => setActiveTab('updates')}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: activeTab === 'updates' ? '#fff' : 'transparent',
            color: activeTab === 'updates' ? '#1E3A6E' : '#64748B',
            boxShadow: activeTab === 'updates' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Nouveautés
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: activeTab === 'feedback' ? '#fff' : 'transparent',
            color: activeTab === 'feedback' ? '#1E3A6E' : '#64748B',
            boxShadow: activeTab === 'feedback' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Retours
        </button>
        <button
          onClick={() => setActiveTab('charities')}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: activeTab === 'charities' ? '#fff' : 'transparent',
            color: activeTab === 'charities' ? '#1E3A6E' : '#64748B',
            boxShadow: activeTab === 'charities' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Associations
        </button>
        <button
          onClick={() => setActiveTab('faq')}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: activeTab === 'faq' ? '#fff' : 'transparent',
            color: activeTab === 'faq' ? '#1E3A6E' : '#64748B',
            boxShadow: activeTab === 'faq' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          FAQ
        </button>
      </div>

      {activeTab === 'metrics' ? (
        <MetricsView onSelectOrg={setSelectedOrgId} />
      ) : activeTab === 'audit' ? (
        <AuditLogView />
      ) : activeTab === 'global_lists' ? (
        <GlobalListsView />
      ) : activeTab === 'updates' ? (
        <UpdatesAdminView />
      ) : activeTab === 'feedback' ? (
        <FeedbackAdminView />
      ) : activeTab === 'charities' ? (
        <CharitiesAdminView />
      ) : activeTab === 'faq' ? (
        <FaqAdminView />
      ) : (
        <>
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', maxWidth: 360, padding: '10px 14px', borderRadius: 8,
              border: '1px solid #E2E8F0', marginBottom: 20, fontSize: 14,
            }}
          />

          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                  <SortableTh label="Organisation" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableTh label="Email" sortKey="owner_email" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <th style={thStyle}>
                    <div style={{ marginBottom: 4 }}>Plan</div>
                    <select
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={filterSelectStyle}
                    >
                      <option value="all">Tous</option>
                      <option value="free">Gratuit</option>
                      <option value="premium">Premium</option>
                    </select>
                  </th>
                  <th style={thStyle}>
                    <div style={{ marginBottom: 4 }}>Statut</div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={filterSelectStyle}
                    >
                      <option value="all">Tous</option>
                      <option value="active">Actif</option>
                      <option value="read_only">Lecture seule</option>
                      <option value="suspended">Suspendu</option>
                    </select>
                  </th>
                  <SortableTh label="Usage" sortKey="item_count" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableTh label="Créé le" sortKey="created_at" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableTh label="Dernière connexion" sortKey="last_sign_in_at" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableTh label="Dernier ajout" sortKey="last_activity_at" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <th style={thStyle}>
                    <div style={{ marginBottom: 4 }}>Association</div>
                    <select
                      value={charityFilter}
                      onChange={(e) => setCharityFilter(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={filterSelectStyle}
                    >
                      <option value="all">Toutes</option>
                      <option value="none">Aucune</option>
                      {charityOptions.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </th>
                  <th style={thStyle}>
                    <div
                      onClick={() => handleSort('subscription_amount')}
                      style={{ cursor: 'pointer', userSelect: 'none', marginBottom: 4 }}
                    >
                      Abonnement {sortKey === 'subscription_amount' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </div>
                    <select
                      value={intervalFilter}
                      onChange={(e) => setIntervalFilter(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={filterSelectStyle}
                    >
                      <option value="all">Tous</option>
                      <option value="month">Mensuel</option>
                      <option value="year">Annuel</option>
                      <option value="none">Aucun</option>
                    </select>
                  </th>
                  <SortableTh label="Déjà versé" sortKey="total_donated" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((org) => (
                  <tr
                    key={org.id}
                    onClick={() => setSelectedOrgId(org.id)}
                    style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={tdStyle}>{org.name || '—'}</td>
                    <td style={tdStyle}>{org.owner_email || '—'}</td>
                    <td style={tdStyle}>{org.plan === 'premium' ? 'Premium' : 'Gratuit'}</td>
                    <td style={tdStyle}>
                      <StatusBadge status={org.status} />
                      {org.plan === 'premium' && org.stripe_cancel_at_period_end && (
                        <span style={{
                          marginLeft: 6, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                          background: '#FFFBEB', color: '#92400E', whiteSpace: 'nowrap',
                        }}>
                          En cours de résiliation
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {org.item_count} / {org.quota_override ?? 10}
                    </td>
                    <td style={tdStyle}>{formatDateOrDash(org.created_at)}</td>
                    <td style={tdStyle}>{formatDateOrDash(org.last_sign_in_at)}</td>
                    <td style={tdStyle}>{formatDateOrDash(org.last_activity_at)}</td>
                    <td style={tdStyle}>{org.charity_name || '—'}</td>
                    <td style={tdStyle}>
                      {org.subscription_amount != null
                        ? `${org.subscription_amount}€ / ${org.subscription_interval === 'year' ? 'an' : 'mois'}`
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      {org.total_donated > 0 ? `${Number(org.total_donated).toFixed(2)}€` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedOrgId && (
        <OrgDetailPanel
          organizationId={selectedOrgId}
          onClose={() => setSelectedOrgId(null)}
          onChanged={loadOrganizations}
        />
      )}
    </div>
  );
}

const thStyle = { padding: '10px 16px', fontSize: 12, color: '#64748B', fontWeight: 700 };
const tdStyle = { padding: '12px 16px', color: '#334155', whiteSpace: 'nowrap' };

const filterSelectStyle = {
  fontSize: 11.5, fontWeight: 600, color: '#334155', border: '1px solid #E2E8F0',
  borderRadius: 6, padding: '3px 6px', background: '#fff', cursor: 'pointer',
};

function SortableTh({ label, sortKey, currentKey, dir, onSort }) {
  const isActive = currentKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label} {isActive ? (dir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );
}
