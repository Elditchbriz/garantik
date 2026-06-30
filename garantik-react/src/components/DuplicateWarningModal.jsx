import React from 'react';
import Icon from './Icon.jsx';

// ============================================================
// DuplicateWarningModal
// Affiché quand un doublon probable est détecté avant la sauvegarde.
// Ouvre la fiche existante dans un NOUVEL ONGLET pour ne pas perdre
// le contexte de saisie.
// ============================================================

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SimilarityBadge({ score }) {
  const pct = Math.round(score * 100);
  const color = pct >= 85 ? 'var(--red-text)' : pct >= 70 ? 'var(--amber-text)' : 'var(--ink-soft)';
  const bg   = pct >= 85 ? 'var(--red-pale)' : pct >= 70 ? 'var(--amber-pale)' : 'var(--gray-pale)';
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: bg, color }}>
      {pct}% similaire
    </span>
  );
}

export default function DuplicateWarningModal({ type, duplicates, onForce, onCancel }) {
  const isPurchase = type === 'purchase';

  // Accord féminin pour "garantie", masculin pour "contrat"
  const labelSing   = isPurchase ? 'garantie' : 'contrat';
  const labelArt    = isPurchase ? 'une garantie' : 'un contrat';
  const labelDet    = isPurchase ? 'cette garantie' : 'ce contrat';
  const labelAdj    = isPurchase ? 'similaire' : 'similaire';
  const labelExist  = isPurchase ? 'la garantie existante' : 'le contrat existant';
  const labelTrouve = isPurchase ? 'trouvée' : 'trouvé';

  const best = duplicates[0];
  const name = isPurchase ? best.object_name : best.name;
  const bestScore = Math.max(best.ocr_similarity || 0, best.name_similarity || 0);

  function openInNewTab() {
    const route = isPurchase ? `/purchase/${best.id}` : `/contract/${best.id}`;
    window.open(route, '_blank', 'noopener');
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-card" style={{ maxWidth: 460, width: '95vw' }}>
        <div className="modal-top" style={{ background: 'var(--amber-pale)' }}>
          <div className="modal-close" onClick={onCancel}><Icon name="x" /></div>
          <div className="modal-icon" style={{ background: 'var(--amber)', color: '#fff' }}>
            <Icon name="alert-triangle" />
          </div>
          <h3 style={{ color: 'var(--navy)' }}>Doublon possible détecté</h3>
          <p style={{ color: 'var(--ink-soft)' }}>
            {isPurchase ? 'Une garantie similaire existe' : 'Un contrat similaire existe'} déjà dans votre espace.
          </p>
        </div>

        <div className="modal-body">
          {/* Preview de l'existant */}
          <div style={{
            background: 'var(--bg)', borderRadius: 'var(--radius-m)',
            padding: '14px 16px', marginBottom: 16, border: '1px solid var(--line)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{name}</div>
              <SimilarityBadge score={bestScore} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              {isPurchase ? (
                <>
                  {best.store && <span>{best.store} · </span>}
                  {best.brand && <span>{best.brand} · </span>}
                  {best.total_amount && <span>{best.total_amount} € · </span>}
                  {best.purchase_date && <span>Acheté le {formatDate(best.purchase_date)}</span>}
                </>
              ) : (
                <>
                  {best.provider && <span>{best.provider} · </span>}
                  {best.contract_type && <span>{best.contract_type} · </span>}
                  {best.end_date && <span>Fin le {formatDate(best.end_date)}</span>}
                </>
              )}
            </div>
            {/* Lien vers la fiche — nouvel onglet pour ne pas perdre la saisie */}
            <button
              onClick={openInNewTab}
              style={{
                marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--blue)', fontSize: 12.5, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5, padding: 0,
                fontFamily: 'inherit',
              }}
            >
              <Icon name="external-link" style={{ fontSize: 13 }} />
              Voir {labelExist} dans un nouvel onglet
            </button>
          </div>

          {duplicates.length > 1 && (
            <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 12 }}>
              + {duplicates.length - 1} autre{duplicates.length > 2 ? 's' : ''} {labelSing}{duplicates.length > 2 ? 's' : ''} {labelAdj}{duplicates.length > 2 ? 's' : ''} {labelTrouve}{duplicates.length > 2 ? 's' : ''}.
            </p>
          )}

          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 20, lineHeight: 1.6 }}>
            S'agit-il {isPurchase ? 'de la même garantie' : 'du même contrat'} ? Continuez la création ou annulez pour modifier votre saisie.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={onForce} className="btn btn-primary" style={{ justifyContent: 'center', gap: 8 }}>
              <Icon name="plus" /> Ce n'est pas un doublon — créer quand même
            </button>
            <button onClick={onCancel} style={{
              padding: '12px 16px', borderRadius: 'var(--radius-s)', border: '1px solid var(--line)',
              background: '#fff', color: 'var(--ink-soft)', fontSize: 13.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}>
              <Icon name="arrow-left" /> Annuler et modifier ma saisie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
