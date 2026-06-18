import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';

export default function OrganizationsPage() {
  const { profile } = useOutletContext();
  const orgId = profile?.organization_id;

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('brands');

  // Ajout
  const [newValue, setNewValue] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    loadAll();
  }, [orgId]);

  async function loadAll() {
    const [{ data: c }, { data: b }, { data: s }] = await Promise.all([
      supabase.from('categories').select('*').eq('organization_id', orgId).order('name'),
      supabase.from('brands').select('*').eq('organization_id', orgId).order('name'),
      supabase.from('stores').select('*').eq('organization_id', orgId).order('name'),
    ]);
    setCategories(c || []);
    setBrands(b || []);
    setStores(s || []);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newValue.trim()) return;
    setAdding(true);
    const table = tab === 'categories' ? 'categories' : tab === 'brands' ? 'brands' : 'stores';
    await supabase.from(table).insert({ organization_id: orgId, name: newValue.trim(), source: 'custom' });
    setNewValue('');
    await loadAll();
    setAdding(false);
  }

  async function handleDelete(table, id) {
    await supabase.from(table).delete().eq('id', id);
    await loadAll();
  }

  const tabData = {
    categories: { label: 'Catégories', data: categories, table: 'categories', icon: 'category' },
    brands: { label: 'Marques', data: brands, table: 'brands', icon: 'tag' },
    stores: { label: 'Enseignes', data: stores, table: 'stores', icon: 'building-store' },
  };

  const current = tabData[tab];

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">Organismes & listes</div>
          <h1 style={{ color: '#fff' }}>Mes listes</h1>
          <p className="sub">Gérez vos catégories, marques et enseignes</p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {Object.entries(tabData).map(([key, val]) => (
          <div key={key} className={`tab ${tab === key ? 'active' : ''}`}
            style={{ cursor: 'pointer' }} onClick={() => setTab(key)}>
            {val.label}
          </div>
        ))}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 32 }}>Chargement…</p>
      ) : (
        <div className="panel">
          <div className="panel-header">
            <h3>
              <div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}>
                <Icon name={current.icon} />
              </div>
              {current.label} ({current.data.length})
            </h3>
          </div>

          {/* Ajouter une valeur */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 10 }}>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={`Ajouter une ${current.label.toLowerCase().slice(0, -1)}…`}
              style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 'var(--radius-s)', padding: '9px 12px', fontSize: 14, fontFamily: 'inherit' }}
            />
            <button className="btn btn-primary" onClick={handleAdd} disabled={adding || !newValue.trim()}>
              <Icon name="plus" />
            </button>
          </div>

          <div className="panel-body">
            {current.data.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-faint)' }}>
                Aucune {current.label.toLowerCase().slice(0, -1)} pour l'instant
              </div>
            ) : (
              current.data.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                  borderBottom: '1px solid var(--line)',
                }}>
                  <Icon name={current.icon} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--navy)' }}>{item.name}</span>
                  {item.source === 'global' && (
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)', background: 'var(--gray-pale)', padding: '2px 8px', borderRadius: 99 }}>
                      global
                    </span>
                  )}
                  <div onClick={() => handleDelete(current.table, item.id)}
                    style={{ cursor: 'pointer', color: 'var(--ink-faint)', padding: 4 }}>
                    <Icon name="x" style={{ fontSize: 14 }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
