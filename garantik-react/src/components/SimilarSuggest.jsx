import React, { useState, useEffect, useRef } from 'react';
import { findSimilarListItems } from '../lib/supabaseClient.js';
import Icon from './Icon.jsx';

// ============================================================
// SimilarSuggest — champ de saisie avec détection de fautes de frappe
// Quand l'utilisateur tape une valeur qui n'existe pas dans la liste
// mais qui ressemble à une valeur existante, on propose une correction.
//
// Props :
//   orgId       — ID de l'organisation
//   table       — 'brands' | 'stores' | 'categories' | 'contract_types'
//   value       — valeur courante du champ
//   onChange    — callback(value) quand la valeur change
//   options     — liste des valeurs existantes (pour l'autocomplete)
//   placeholder — placeholder du champ
//   label       — label du champ
// ============================================================

export default function SimilarSuggest({ orgId, table, value, onChange, options = [], placeholder, label }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [similarItems, setSimilarItems] = useState([]);
  const [showSimilarWarning, setShowSimilarWarning] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const filteredOptions = value
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase()))
    : options;

  const exactMatch = options.some(o => o.toLowerCase() === value?.toLowerCase());

  useEffect(() => {
    if (!value || value.trim().length < 2 || !orgId) {
      setSimilarItems([]);
      setShowSimilarWarning(false);
      return;
    }

    // Ne chercher la similarité que si la valeur ne correspond pas exactement à une option
    if (exactMatch) {
      setSimilarItems([]);
      setShowSimilarWarning(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const similar = await findSimilarListItems(orgId, table, value);
      // Filtrer les résultats qui ne sont pas exactement ce que l'utilisateur tape
      const filtered = similar.filter(s => s.name.toLowerCase() !== value.toLowerCase());
      setSimilarItems(filtered);
      setShowSimilarWarning(filtered.length > 0 && !exactMatch);
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [value, orgId, table, exactMatch]);

  function handleSuggestionClick(suggestion) {
    onChange(suggestion);
    setShowSuggestions(false);
    setSimilarItems([]);
    setShowSimilarWarning(false);
    inputRef.current?.blur();
  }

  function handleSimilarAccept(item) {
    onChange(item.name);
    setSimilarItems([]);
    setShowSimilarWarning(false);
  }

  function handleSimilarIgnore() {
    setShowSimilarWarning(false);
    setSimilarItems([]);
  }

  return (
    <div className="field" style={{ position: 'relative' }}>
      {label && <label>{label}</label>}

      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          autoComplete="off"
        />

        {/* Dropdown autocomplete */}
        {showSuggestions && filteredOptions.length > 0 && value && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius-s)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto',
          }}>
            {filteredOptions.slice(0, 8).map(option => (
              <div key={option}
                onMouseDown={() => handleSuggestionClick(option)}
                style={{
                  padding: '9px 12px', cursor: 'pointer', fontSize: 13.5,
                  color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {option}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Avertissement similarité — faute de frappe probable */}
      {showSimilarWarning && similarItems.length > 0 && (
        <div style={{
          marginTop: 6, padding: '10px 12px', background: 'var(--amber-pale)',
          borderRadius: 'var(--radius-s)', border: '1px solid var(--amber)',
        }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber-text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert-triangle" style={{ fontSize: 13 }} />
            Vouliez-vous dire… ?
          </div>
          {similarItems.slice(0, 3).map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 600 }}>{item.name}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                  {Math.round(item.similarity_score * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => handleSimilarAccept(item)}
                  style={{
                    background: 'var(--amber)', color: '#fff', border: 'none',
                    borderRadius: 'var(--radius-s)', padding: '3px 10px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Utiliser
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={handleSimilarIgnore}
            style={{
              background: 'none', border: 'none', color: 'var(--ink-faint)',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
            }}
          >
            Non, garder "{value}"
          </button>
        </div>
      )}
    </div>
  );
}
