import React, { useState, useEffect, useRef } from 'react';
import { findSimilarListItems, supabase } from '../lib/supabaseClient.js';
import Icon from './Icon.jsx';

// ============================================================
// SimilarSuggest — champ avec autocomplete, détection de fautes
// de frappe ET ajout à la volée d'une nouvelle valeur en base.
// ============================================================

const TABLE_LABELS = {
  brands: 'marque',
  stores: 'enseigne',
  categories: 'catégorie',
  contract_types: 'type de contrat',
  providers: 'prestataire',
};

export default function SimilarSuggest({ orgId, table, value, onChange, options = [], onOptionAdded, placeholder, label }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [similarItems, setSimilarItems] = useState([]);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const exactMatch = options.some(o => o.toLowerCase() === value?.toLowerCase());
  const filteredOptions = value
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase()))
    : options;

  const tableLabel = TABLE_LABELS[table] || 'valeur';

  // Recherche de similarité dès que la valeur change
  useEffect(() => {
    setAdded(false);
    if (!value || value.trim().length < 2 || !orgId || exactMatch) {
      setSimilarItems([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const similar = await findSimilarListItems(orgId, table, value);
      const filtered = similar.filter(s => s.name.toLowerCase() !== value.toLowerCase());
      setSimilarItems(filtered);
    }, 450);
    return () => clearTimeout(debounceRef.current);
  }, [value, orgId, table, exactMatch]);

  async function handleAddToBase() {
    if (!value?.trim() || !orgId) return;
    setAdding(true);
    try {
      const { data, error } = await supabase.from(table).insert({
        organization_id: orgId,
        name: value.trim(),
        source: 'custom',
      }).select().single();
      if (error) throw error;
      if (data) {
        if (onOptionAdded) onOptionAdded(data.name);
        setAdded(true);
        setSimilarItems([]);
      }
    } catch (e) {
      console.error('Erreur ajout en base — message:', e?.message, '/ details:', e?.details, '/ hint:', e?.hint, '/ code:', e?.code);
      alert(`Impossible d'ajouter "${value.trim()}" : ${e?.message || e?.details || 'erreur inconnue'}`);
    }
    setAdding(false);
  }

  function handleSimilarAccept(item) {
    onChange(item.name);
    setSimilarItems([]);
  }

  // Une valeur "nouvelle" méritant la proposition d'ajout :
  // au moins 2 caractères, pas de correspondance exacte
  const isNewValue = value && value.trim().length >= 2 && !exactMatch;
  const hasCloseMatch = similarItems.length > 0 && similarItems[0].similarity_score >= 0.5;

  console.log('[SimilarSuggest]', { table, value, isNewValue, exactMatch, optionsCount: options.length, similarItems: similarItems.length, hasCloseMatch });

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

      {/* Confirmation ajout réussi */}
      {added && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--green-text)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="check" style={{ fontSize: 12 }} /> Ajouté à vos {tableLabel}s
        </div>
      )}

      {/* Bloc unique : similaires existants + option d'ajout */}
      {isNewValue && !added && (hasCloseMatch || true) && (
        <div style={{
          marginTop: 6, padding: '10px 12px',
          background: hasCloseMatch ? 'var(--amber-pale)' : 'var(--blue-pale-2)',
          borderRadius: 'var(--radius-s)',
          border: `1px solid ${hasCloseMatch ? 'var(--amber)' : 'var(--blue-pale)'}`,
        }}>
          {hasCloseMatch && (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber-text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="alert-triangle" style={{ fontSize: 13 }} />
                Vouliez-vous dire… ?
              </div>
              {similarItems.slice(0, 3).map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 600 }}>{item.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 6 }}>
                      {Math.round(item.similarity_score * 100)}%
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
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 8, marginTop: 4 }} />
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 12.5, color: hasCloseMatch ? 'var(--ink-soft)' : 'var(--blue-dark)' }}>
              {hasCloseMatch
                ? `Non, garder "${value}" et l'ajouter`
                : `"${value}" n'existe pas encore dans vos ${tableLabel}s`}
            </span>
            <button type="button" onClick={handleAddToBase} disabled={adding} style={{
              background: 'var(--blue)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius-s)', padding: '5px 13px',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {adding ? '…' : '+ Ajouter'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
