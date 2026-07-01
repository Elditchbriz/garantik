import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase, listContractTypes, findSimilarListItems } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import StorageConnector from '../components/StorageConnector.jsx';
import PageHeader from '../components/PageHeader.jsx';

const TABS = [
  { id: 'preferences', label: 'Préférences', icon: 'bell' },
  { id: 'lists', label: 'Listes', icon: 'category' },
  { id: 'storage', label: 'Stockage', icon: 'cloud' },
  { id: 'about', label: 'À propos', icon: 'info-circle' },
];

export default function SettingsPage() {
  const { profile } = useOutletContext();
  const orgId = profile?.organization_id;
  const [tab, setTab] = useState('preferences');

  return (
    <>
      <PageHeader
        title="Paramètres"
        subtitle="Personnalisez vos alertes, vos listes et votre hébergement"
      />

      <div className="tabs" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setTab(t.id)}>
            <Icon name={t.icon} style={{ fontSize: 14 }} /> {t.label}
          </div>
        ))}
      </div>

      {tab === 'preferences' && <PreferencesTab orgId={orgId} />}
      {tab === 'lists' && <ListsTab orgId={orgId} />}
      {tab === 'storage' && <StorageTab orgId={orgId} />}
      {tab === 'about' && <AboutTab />}
    </>
  );
}

// ============================================================
// Onglet Préférences (alertes, notifications)
// ============================================================
function PreferencesTab({ orgId }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    supabase.from('settings').select('*').eq('organization_id', orgId).single()
      .then(({ data }) => { setSettings(data); setLoading(false); });
  }, [orgId]);

  async function handleSave() {
    setSaving(true);
    await supabase.from('settings').update({
      alert_months_before: settings.alert_months_before,
      default_warranty_months: settings.default_warranty_months,
      email_notifications_enabled: settings.email_notifications_enabled,
      auto_recap_email: settings.auto_recap_email,
    }).eq('organization_id', orgId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading || !settings) return <p style={{ padding: 32, textAlign: 'center', color: 'var(--ink-faint)' }}>Chargement…</p>;

  return (
    <>
      {saved && (
        <div style={{ background: 'var(--green-pale)', color: 'var(--green-text)', borderRadius: 'var(--radius-m)', padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}>
          <Icon name="circle-check" /> Paramètres enregistrés
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <h3><div className="panel-header-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}><Icon name="bell" /></div>Alertes</h3>
        </div>
        <div className="setting-row">
          <div className="label-group">
            <div className="t">Alerte avant expiration</div>
            <div className="d">Nombre de mois avant la fin de garantie pour vous prévenir</div>
          </div>
          <select value={settings.alert_months_before}
            onChange={(e) => setSettings(s => ({ ...s, alert_months_before: parseInt(e.target.value) }))}
            style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-s)', padding: '8px 12px', fontSize: 14, fontFamily: 'inherit' }}>
            {[1, 2, 3, 6].map(v => <option key={v} value={v}>{v} mois avant</option>)}
          </select>
        </div>
        <div className="setting-row">
          <div className="label-group">
            <div className="t">Durée de garantie par défaut</div>
            <div className="d">Pré-remplie à la création d'un achat</div>
          </div>
          <select value={settings.default_warranty_months}
            onChange={(e) => setSettings(s => ({ ...s, default_warranty_months: parseInt(e.target.value) }))}
            style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-s)', padding: '8px 12px', fontSize: 14, fontFamily: 'inherit' }}>
            {[12, 24, 36].map(v => <option key={v} value={v}>{v} mois</option>)}
          </select>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <h3><div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name="mail" /></div>Notifications email</h3>
        </div>
        <div className="setting-row">
          <div className="label-group">
            <div className="t">Alertes par e-mail</div>
            <div className="d">Recevoir un email quand une garantie approche de son expiration</div>
          </div>
          <div className={`switch ${settings.email_notifications_enabled ? 'on' : ''}`}
            onClick={() => setSettings(s => ({ ...s, email_notifications_enabled: !s.email_notifications_enabled }))}>
            <div className="knob"></div>
          </div>
        </div>
        <div className="setting-row">
          <div className="label-group">
            <div className="t">Récapitulatif mensuel</div>
            <div className="d">Un email mensuel avec l'état de vos garanties</div>
          </div>
          <div className={`switch ${settings.auto_recap_email ? 'on' : ''}`}
            onClick={() => setSettings(s => ({ ...s, auto_recap_email: !s.auto_recap_email }))}>
            <div className="knob"></div>
          </div>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
        <Icon name="check" /> {saving ? 'Enregistrement…' : 'Enregistrer les préférences'}
      </button>
    </>
  );
}

// ============================================================
// Onglet Listes (catégories, marques, enseignes — ex-OrganizationsPage)
// ============================================================
function ListsTab({ orgId }) {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [stores, setStores] = useState([]);
  const [contractTypes, setContractTypes] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('brands');
  const [newValue, setNewValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [similarItems, setSimilarItems] = useState([]);
  const [pendingAdd, setPendingAdd] = useState(false);

  useEffect(() => { if (orgId) loadAll(); }, [orgId]);

  async function loadAll() {
    const [{ data: c }, { data: b }, { data: s }, { data: ct }, { data: p }] = await Promise.all([
      supabase.from('categories').select('*').eq('organization_id', orgId).order('name'),
      supabase.from('brands').select('*').eq('organization_id', orgId).order('name'),
      supabase.from('stores').select('*').eq('organization_id', orgId).order('name'),
      listContractTypes(orgId),
      supabase.from('providers').select('*').eq('organization_id', orgId).order('name'),
    ]);
    setCategories(c || []); setBrands(b || []); setStores(s || []); setContractTypes(ct || []); setProviders(p || []);
    setLoading(false);
  }

  async function handleAdd(forceAdd = false) {
    if (!newValue.trim()) return;
    const table = ['categories', 'brands', 'stores', 'contract_types', 'providers'].includes(subTab) ? subTab : 'contract_types';

    // Vérifier les doublons potentiels avant d'ajouter
    if (!forceAdd) {
      const similar = await findSimilarListItems(orgId, table, newValue);
      const closeMatches = similar.filter(s => s.name.toLowerCase() !== newValue.trim().toLowerCase());
      if (closeMatches.length > 0) {
        setSimilarItems(closeMatches);
        setPendingAdd(true);
        return;
      }
    }

    setAdding(true);
    await supabase.from(table).insert({ organization_id: orgId, name: newValue.trim(), source: 'custom' });
    setNewValue('');
    setSimilarItems([]);
    setPendingAdd(false);
    await loadAll();
    setAdding(false);
  }

  function useSimilarItem(name) {
    setNewValue(name);
    setSimilarItems([]);
    setPendingAdd(false);
  }

  async function handleDelete(table, id) {
    await supabase.from(table).delete().eq('id', id);
    await loadAll();
  }

  const tabData = {
    categories: { label: 'Catégories', data: categories, table: 'categories', icon: 'category' },
    brands: { label: 'Marques', data: brands, table: 'brands', icon: 'tag' },
    stores: { label: 'Enseignes', data: stores, table: 'stores', icon: 'building-store' },
    contract_types: { label: 'Types de contrats', data: contractTypes, table: 'contract_types', icon: 'shield-check' },
    providers: { label: 'Prestataires', data: providers, table: 'providers', icon: 'briefcase' },
  };
  const current = tabData[subTab];

  if (loading) return <p style={{ padding: 32, textAlign: 'center', color: 'var(--ink-faint)' }}>Chargement…</p>;

  return (
    <>
      <div className="pill-group" style={{ marginBottom: 16 }}>
        {Object.entries(tabData).map(([key, val]) => (
          <div key={key} className={`pill ${subTab === key ? 'active' : ''}`}
            style={{ cursor: 'pointer' }} onClick={() => setSubTab(key)}>
            {val.label}
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>
            <div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name={current.icon} /></div>
            {current.label} ({current.data.length})
          </h3>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="text" value={newValue} onChange={(e) => { setNewValue(e.target.value); setSimilarItems([]); setPendingAdd(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={`Ajouter une ${current.label.toLowerCase().slice(0, -1)}…`}
              style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 'var(--radius-s)', padding: '9px 12px', fontSize: 14, fontFamily: 'inherit' }} />
            <button className="btn btn-primary" onClick={() => handleAdd()} disabled={adding || !newValue.trim()}>
              <Icon name="plus" />
            </button>
          </div>

          {pendingAdd && similarItems.length > 0 && (
            <div style={{
              marginTop: 10, padding: '10px 12px', background: 'var(--amber-pale)',
              borderRadius: 'var(--radius-s)', border: '1px solid var(--amber)',
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber-text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="alert-triangle" style={{ fontSize: 13 }} /> Risque de doublon détecté
              </div>
              {similarItems.slice(0, 3).map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 600 }}>{item.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 6 }}>
                      {Math.round(item.similarity_score * 100)}% similaire
                    </span>
                  </div>
                  <button onClick={() => useSimilarItem(item.name)} style={{
                    background: 'var(--amber)', color: '#fff', border: 'none',
                    borderRadius: 'var(--radius-s)', padding: '4px 12px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    Utiliser celle-ci
                  </button>
                </div>
              ))}
              <button onClick={() => handleAdd(true)} disabled={adding} style={{
                background: 'none', border: 'none', color: 'var(--ink-soft)',
                fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                marginTop: 4, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Icon name="plus" style={{ fontSize: 12 }} />
                {adding ? 'Ajout…' : `Non, ajouter quand même "${newValue}"`}
              </button>
            </div>
          )}
        </div>
        <div className="panel-body">
          {current.data.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-faint)' }}>
              Aucune {current.label.toLowerCase().slice(0, -1)} pour l'instant
            </div>
          ) : (
            current.data.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line)' }}>
                <Icon name={current.icon} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, color: 'var(--navy)' }}>{item.name}</span>
                {item.source === 'global' && (
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)', background: 'var(--gray-pale)', padding: '2px 8px', borderRadius: 99 }}>global</span>
                )}
                <div onClick={() => handleDelete(current.table, item.id)} style={{ cursor: 'pointer', color: 'var(--ink-faint)', padding: 4 }}>
                  <Icon name="x" style={{ fontSize: 14 }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// Onglet Stockage
// ============================================================
function StorageTab({ orgId }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>
          <div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue)' }}>
            <Icon name="cloud" />
          </div>
          Espace de stockage
        </h3>
      </div>
      <div className="panel-body" style={{ padding: 24 }}>
        <StorageConnector orgId={orgId} />
      </div>
    </div>
  );
}

// ============================================================
// Onglet À propos
// ============================================================
function AboutTab() {
  return (
    <div className="panel">
      <div className="panel-body" style={{ padding: 0 }}>
        {[
          { label: "Conditions générales d'utilisation", to: '/legal/cgu' },
          { label: 'Politique de confidentialité', to: '/legal/confidentialite' },
          { label: 'Mentions légales', to: '/legal/mentions' },
        ].map(({ label, to }) => (
          <a key={to} href={to} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: '1px solid var(--line)',
            fontSize: 14, color: 'var(--navy)', textDecoration: 'none',
          }}>
            {label} <Icon name="chevron-down" style={{ transform: 'rotate(-90deg)', color: 'var(--ink-faint)' }} />
          </a>
        ))}
        <div style={{ padding: '16px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 4 }}>Garantik v1.0</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Conçu et hébergé en France 🇫🇷</div>
        </div>
      </div>
    </div>
  );
}
