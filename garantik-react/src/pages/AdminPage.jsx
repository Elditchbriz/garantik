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

function MetricsView() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');

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
  const conversionRate = metrics.total_organizations > 0
    ? Math.round((metrics.plan_premium_count / metrics.total_organizations) * 1000) / 10
    : 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <MetricCard label="Total comptes" value={metrics.total_organizations} />
        <MetricCard label="Inscriptions (7j)" value={signups7d} />
        <MetricCard label="Inscriptions (30j)" value={signups30d} />
        <MetricCard label="Comptes premium" value={metrics.plan_premium_count} sub={`${conversionRate}% de conversion`} />
        <MetricCard label="Premium temporaire" value={metrics.temp_premium_count} sub="via parrainage" />
        <MetricCard label="MRR estimé" value={`${metrics.mrr_estimate.toFixed(2)} €`} sub="basé sur les abonnements payants" highlight />
      </div>

      <p style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 16 }}>
        Le MRR est une estimation à partir du prix affiché (19,99€/an) — remplacé par les données réelles une fois Stripe branché.
      </p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: 14, color: '#0F172A', marginBottom: 16 }}>Inscriptions — 30 derniers jours</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
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
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, highlight }) {
  return (
    <div style={{
      background: highlight ? '#1E3A6E' : '#fff', borderRadius: 12, padding: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: highlight ? '#fff' : '#0F172A' }}>{value}</div>
      <div style={{ fontSize: 12, color: highlight ? 'rgba(255,255,255,0.8)' : '#64748B', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: highlight ? 'rgba(255,255,255,0.6)' : '#94A3B8', marginTop: 2 }}>{sub}</div>}
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
  const [activeTab, setActiveTab] = useState('organizations');

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

  const filtered = organizations.filter((org) => {
    const q = search.toLowerCase();
    return (
      org.name?.toLowerCase().includes(q) ||
      org.owner_email?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '32px 24px', fontFamily: '-apple-system, sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E3A6E', marginBottom: 4 }}>Console admin</h1>
      <p style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>
        {organizations.length} organisation{organizations.length > 1 ? 's' : ''}
      </p>

      {error && <p style={{ color: '#DC2626' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#F1F5F9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
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
      </div>

      {activeTab === 'audit' ? (
        <AuditLogView />
      ) : activeTab === 'global_lists' ? (
        <GlobalListsView />
      ) : activeTab === 'metrics' ? (
        <MetricsView />
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

          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                  <th style={thStyle}>Organisation</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Usage</th>
                  <th style={thStyle}>Créé le</th>
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
                    <td style={tdStyle}>{org.plan || 'gratuit'}</td>
                    <td style={tdStyle}><StatusBadge status={org.status} /></td>
                    <td style={tdStyle}>
                      {org.item_count} / {org.quota_override ?? 10}
                    </td>
                    <td style={tdStyle}>{new Date(org.created_at).toLocaleDateString('fr-FR')}</td>
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
const tdStyle = { padding: '12px 16px', color: '#334155' };
