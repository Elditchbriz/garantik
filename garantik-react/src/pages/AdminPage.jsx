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

export default function AdminPage() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [error, setError] = useState('');

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
