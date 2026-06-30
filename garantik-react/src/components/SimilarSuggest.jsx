import React, { useState, useEffect, useRef } from 'react';
import { findSimilarListItems, supabase } from '../lib/supabaseClient.js';
import Icon from './Icon.jsx';

// ============================================================
// SimilarSuggest — champ avec autocomplete, détection de fautes
// de frappe ET ajout à la volée d'une nouvelle valeur en base.
//
// Props :
//   orgId       — ID de l'organisation
//   table       — 'brands' | 'stores' | 'categories' | 'contract_types'
//   value       — valeur courante
//   onChange    — callback(value)
//   options     — liste des valeurs existantes
//   onOptionAdded — callback(newValue) quand une valeur est ajoutée en base
//   placeholder, label
// ============================================================

const TABLE_LABELS = {
  brands: { sing: 'marque', art: 'cette marque', icon: 'tag' },
  stores: { sing: 'enseigne', art: 'cette enseigne', icon: 'building-store' },
  categories: { sing: 'catégorie', art: 'cette catégorie', icon: 'folder' },
  contract_types: { sing: 'type de contrat', art: 'ce type', icon: 'shield-check' },
};

export default function SimilarSuggest({ orgId, table, value, onChange, options = [], onOptionAdded, placeholder, label }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [similarItems, setSimilarItems] = useState([]);
  const [showSimilarWarning, setShowSimilarWarning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addConfirm, setAddConfirm] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const exactMatch = options.some(o => o.toLowerCase() === value?.toLowerCase());
  const filteredOptions = value
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase()))
    : options;

  const meta = TABLE_LABELS[table] || { sing: 'valeur', art: 'cette valeur', icon: 'tag' };

  // Détection similarité
  useEffect(() => {
    if (!value || value.trim().length < 2 || !orgId || exactMatch) {
      setSimilarItems([]);
      setShowSimilarWarning(false);
      setAddConfirm(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const similar = await findSimilarListItems(orgId, table, value);
      const filtered = similar.filter(s => s.name.toLowerCase() !== value.toLowerCase());
      setSimilarItems(filtered);
      setShowSimilarWarning(filtered.length > 0);
      // Proposer l'ajout si pas de similaire assez proche (< 85%)
      setAddConfirm(filtered.length === 0 || filtered[0].similarity_score < 0.85);
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [value, orgId, table, exactMatch]);

  async function handleAddToBase() {
    if (!value?.trim() || !orgId) return;
    setAdding(true);
    try {
      const { data } = await supabase.from(table).insert({
        organization_id: orgId,
        name: value.trim(),
        source: 'user',
      }).select().single();
      if (data && onOptionAdded) onOptionAdded(data.name);
      setAddConfirm(false);
      setSimilarItems([]);
    } catch (e) {
      console.error('Erreur ajout en base:', e);
    }
    setAdding(false);
  }

  function handleSimilarAccept(item) {
    onChange(item.name);
    setSimilarItems([]);
    setShowSimilarWarning(false);
    setAddConfirm(false);
  }

  return (
    <div className="field" style={{ position: 'relative' }}>
      {label && <label>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={(e) => { onChange(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder={placeholder}
          autoComplete="off"
        />

        {/* Dropdown autocomplete */}
        {showDropdown && filteredOptions.length > 0 && value && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius-s)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto',
          }}>
            {filteredOptions.slice(0, 8).map(option => (
              <div key={option}
                onMouseDown={() => { onChange(option); setShowDropdown(false); }}
                style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 13.5, color: 'var(--navy)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {option}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Avertissement similarité */}
      {showSimilarWarning && similarItems.length > 0 && !exactMatch && (
        <div style={{
          marginTop: 6, padding: '10px 12px', background: 'var(--amber-pale)',
          borderRadius: 'var(--radius-s)', border: '1px solid var(--amber)',
        }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber-text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert-triangle" style={{ fontSize: 13 }} />
            Vouliez-vous dire… ?
          </div>
          {similarItems.slice(0, 3).map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 600 }}>{item.name}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 6 }}>
                  {Math.round(item.similarity_score * 100)}% similaire
                </span>
              </div>
              <button type="button" onClick={() => handleSimilarAccept(item)} style={{
                background: 'var(--amber)', color: '#fff', border: 'none',
                borderRadius: 'var(--radius-s)', padding: '4px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Utiliser
              </button>
            </div>
          ))}
          {addConfirm && (
            <div style={{ borderTop: '1px solid var(--amber)', paddingTop: 8, marginTop: 4 }}>
              <button type="button" onClick={handleAddToBase} disabled={adding} style={{
                background: 'none', border: 'none', color: 'var(--ink-soft)',
                fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Icon name="plus" style={{ fontSize: 12 }} />
                {adding ? 'Ajout en cours…' : `Non, c'est bien "${value}" — l'ajouter à mes ${meta.sing}s`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Proposition d'ajout si valeur nouvelle sans similaire */}
      {value && value.trim().length >= 2 && !exactMatch && !showSimilarWarning && similarItems.length === 0 && addConfirm && (
        <div style={{
          marginTop: 6, padding: '8px 12px', background: 'var(--blue-pale-2)',
          borderRadius: 'var(--radius-s)', border: '1px solid var(--blue-pale)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12.5, color: 'var(--blue-dark)' }}>
            "{value}" n'est pas dans vos {meta.sing}s
          </span>
          <button type="button" onClick={handleAddToBase} disabled={adding} style={{
            background: 'var(--blue)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-s)', padding: '4px 12px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {adding ? '…' : '+ Ajouter'}
          </button>
        </div>
      )}
    </div>
  );
}
