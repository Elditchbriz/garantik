import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from './Icon.jsx';

// ============================================================
// LinkModal — modal pour lier une garantie à un contrat (ou vice versa)
// Propose : choisir parmi les existants OU en créer un nouveau
//
// Props :
//   type        — 'contract' (on cherche un contrat à lier à une garantie)
//              — 'purchase' (on cherche une garantie à lier à un contrat)
//   sourceId    — ID de la fiche courante
//   orgId       — ID de l'organisation
//   onClose     — fermer le modal
//   onLinked    — callback après liaison réussie
// ============================================================

export default function LinkModal({ type, sourceId, orgId, onClose, onLinked }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState(null);

  const isContract = type === 'contract'; // on cherche un contrat pour une garantie
  const label = isContract ? 'contrat' : 'garantie';
  const labelPlural = isContract ? 'contrats' : 'garanties';

  useEffect(() => {
    if (!orgId) return;
    const table = isContract ? 'contracts' : 'purchases';
    const nameCol = isContract ? 'name' : 'object_name';
    supabase.from(table)
      .select(`id, ${nameCol}, ${isContract ? 'provider, contract_type, end_date' : 'brand, store, warranty_end_date'}`)
      .eq('organization_id', orgId)
      .order(nameCol)
      .then(({ data }) => {
        setItems(data || []);
        setLoading(false);
      });
  }, [orgId, isContract]);

  async function handleLink(itemId) {
    setLinking(itemId);
    if (isContract) {
      // Lier ce contrat à la garantie courante
      await supabase.from('contracts').update({ purchase_id: sourceId }).eq('id', itemId);
    } else {
      // Lier cette garantie au contrat courant
      await supabase.from('contracts').update({ purchase_id: itemId }).eq('id', sourceId);
    }
    setLinking(null);
    if (onLinked) onLinked();
    onClose();
  }

  function handleCreateNew() {
    if (isContract) {
      navigate(`/add-contract?purchase_id=${sourceId}`);
    } else {
      navigate(`/add-purchase?contract_id=${sourceId}`);
    }
    onClose();
  }

  const filtered = items.filter(item => {
    const name = isContract ? item.name : item.object_name;
    return name?.toLowerCase().includes(search.toLowerCase());
  });

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: 480, width: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-top">
          <div className="modal-close" onClick={onClose}><Icon name="x" /></div>
          <div className="modal-icon"><Icon name={isContract ? 'shield-check' : 'file-text'} /></div>
          <h3>Lier {isContract ? 'un contrat' : 'une garantie'}</h3>
          <p>Choisissez parmi vos {labelPlural} existants ou créez-en un nouveau</p>
        </div>

        <div className="modal-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px 20px' }}>
          {/* Bouton créer nouveau */}
          <button onClick={handleCreateNew} className="btn btn-primary" style={{ justifyContent: 'center', gap: 8, marginBottom: 16 }}>
            <Icon name="plus" /> Créer {isContract ? 'un nouveau contrat' : 'une nouvelle garantie'}
          </button>

          {items.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', marginBottom: 10 }}>
                Ou choisir parmi les existants
              </div>

              {/* Recherche */}
              {items.length > 5 && (
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Rechercher un ${label}…`}
                  style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 'var(--radius-s)', border: '1px solid var(--line)', fontSize: 13.5, fontFamily: 'inherit' }}
                  autoFocus
                />
              )}

              {/* Liste */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {loading ? (
                  <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 16 }}>Chargement…</p>
                ) : filtered.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 16 }}>Aucun {label} trouvé</p>
                ) : (
                  filtered.map(item => {
                    const name = isContract ? item.name : item.object_name;
                    const sub = isContract
                      ? [item.provider, item.contract_type, item.end_date ? `Fin ${formatDate(item.end_date)}` : ''].filter(Boolean).join(' · ')
                      : [item.brand, item.store, item.warranty_end_date ? `Garantie jusqu'au ${formatDate(item.warranty_end_date)}` : ''].filter(Boolean).join(' · ');

                    return (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 'var(--radius-s)',
                        border: '1px solid var(--line)', marginBottom: 6, background: '#fff',
                      }}>
                        <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}
                          </div>
                          {sub && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>{sub}</div>}
                        </div>
                        <button
                          onClick={() => handleLink(item.id)}
                          disabled={linking === item.id}
                          style={{
                            background: 'var(--blue)', color: '#fff', border: 'none',
                            borderRadius: 'var(--radius-s)', padding: '6px 14px',
                            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'inherit', flexShrink: 0,
                          }}
                        >
                          {linking === item.id ? '…' : 'Lier'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
