import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase, uploadDocument, deleteContract, updateContract } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';

function formatDate(d, long = false) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', long
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
}

const typeIcons = { 'image/jpeg': 'photo', 'image/png': 'photo', 'image/webp': 'photo', 'application/pdf': 'pdf' };

const noticeMethodLabels = {
  email: 'E-mail',
  telephone: 'Téléphone',
  courrier_recommande: 'Courrier recommandé avec accusé de réception',
  autre: 'Autre',
};

export default function ContractDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useOutletContext();
  const orgId = profile?.organization_id;

  const [contract, setContract] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('detail');

  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    loadAll();
  }, [id, orgId]);

  async function loadAll() {
    const [{ data: c }, { data: d }] = await Promise.all([
      supabase.from('contracts').select('*, purchases(object_name, brand)').eq('id', id).eq('organization_id', orgId).single(),
      supabase.from('documents').select('*').eq('contract_id', id).order('created_at'),
    ]);
    if (!c) { navigate('/contracts'); return; }
    setContract(c);
    setDocuments(d || []);
    setLoading(false);
  }

  async function handleUploadDoc(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const isPrimary = documents.length === 0;
    const { data, error } = await uploadDocument(file, orgId, null, null, id);
    if (data && isPrimary) {
      await supabase.from('documents').update({ document_category: 'contrat' }).eq('id', data.id);
    }
    await loadAll();
    setUploading(false);
  }

  async function openViewer(doc) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 300);
    if (data?.signedUrl) setViewer({ url: data.signedUrl, type: doc.file_type, name: doc.file_name });
  }

  async function handleDeleteDoc(docId, filePath) {
    await supabase.storage.from('documents').remove([filePath]);
    await supabase.from('documents').delete().eq('id', docId);
    await loadAll();
  }

  async function handleDelete() {
    await deleteContract(id);
    navigate('/contracts');
  }

  async function handleConfirmCancel() {
    await updateContract(id, { cancelled_at: new Date().toISOString() });
    setShowCancelModal(false);
    await loadAll();
  }

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-faint)' }}>Chargement…</div>;

  const days = daysUntil(contract.end_date);
  const expired = days !== null && days < 0;
  const expiring = days !== null && days >= 0 && days <= 60;
  const isCancelled = !!contract.cancelled_at;
  const statusColor = isCancelled ? 'var(--ink-faint)' : expired ? 'var(--red)' : expiring ? 'var(--amber)' : 'var(--green)';
  const statusLabel = isCancelled ? 'Résilié' : expired ? 'Expiré' : expiring ? `Expire dans ${days} jours` : 'Actif';

  const noticeDate = contract.notice_period_days && contract.end_date
    ? new Date(new Date(contract.end_date).getTime() - contract.notice_period_days * 86400000)
    : null;

  return (
    <>
      <div className="topbar">
        <div style={{ flex: 1, minWidth: 0 }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 8,
          }}>
            <Icon name="arrow-left" style={{ fontSize: 14 }} /> Retour
          </button>
          <div className="eyebrow">{contract.contract_type?.replace('_', ' ') || 'Contrat'}</div>
          <h1 style={{ color: '#fff', fontSize: 22 }}>{contract.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: statusColor, color: '#fff' }}>
              {statusLabel}
            </span>
            {contract.provider && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{contract.provider}</span>}
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {[
          { id: 'detail', label: 'Détail' },
          { id: 'documents', label: `Documents (${documents.length})` },
        ].map(t => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'detail' && (
        <>
          {!isCancelled && noticeDate && (
            <div style={{
              padding: '12px 16px', borderRadius: 'var(--radius-m)', marginBottom: 16,
              background: 'var(--amber-pale)', color: 'var(--amber-text)',
              fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Icon name="bell" />
              Préavis de résiliation à envoyer avant le <strong>{formatDate(noticeDate, true)}</strong>
            </div>
          )}

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header">
              <h3><div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name="shield-check" /></div>Informations</h3>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              {[
                { k: 'Prestataire', v: contract.provider },
                { k: 'Numéro / référence', v: contract.reference_number },
                { k: 'Date de début', v: formatDate(contract.start_date, true) },
                { k: 'Date de fin', v: formatDate(contract.end_date, true) },
                { k: 'Préavis', v: contract.notice_period_days ? `${contract.notice_period_days} jours avant la fin` : null },
                { k: 'Mode de résiliation', v: noticeMethodLabels[contract.notice_method] },
                { k: 'Renouvellement', v: contract.renewal_type !== 'aucun' ? contract.renewal_type : null },
                { k: 'Lié à', v: contract.purchases?.object_name },
              ].filter(r => r.v).map(({ k, v }) => (
                <div key={k} className="kv-row" style={{ padding: '11px 20px' }}>
                  <span className="k">{k}</span>
                  <span className="v">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bouton résilier */}
          {!isCancelled ? (
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
              onClick={() => setShowCancelModal(true)}>
              <Icon name="file-export" /> Préparer la résiliation
            </button>
          ) : (
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-m)', background: 'var(--gray-pale)', color: 'var(--ink-soft)', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
              Résilié le {formatDate(contract.cancelled_at, true)}
            </div>
          )}

          <div className="panel">
            <div style={{ padding: 16 }}>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} style={{
                  width: '100%', padding: 13, borderRadius: 'var(--radius-m)',
                  background: 'var(--red-pale)', color: 'var(--red-text)', border: 'none',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}>
                  <Icon name="x" /> Supprimer ce contrat
                </button>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 14 }}>Confirmer la suppression ?</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmDelete(false)}>Annuler</button>
                    <button onClick={handleDelete} style={{ flex: 1, padding: 13, borderRadius: 'var(--radius-m)', background: 'var(--red)', color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Supprimer</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'documents' && (
        <>
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: 16, borderRadius: 'var(--radius-m)', border: '2px dashed var(--blue)',
            background: 'var(--blue-pale-2)', cursor: uploading ? 'wait' : 'pointer',
            color: 'var(--blue-dark)', fontWeight: 600, fontSize: 14, marginBottom: 16,
          }}>
            <Icon name="upload" />
            {uploading ? 'Upload en cours…' : 'Ajouter le contrat ou une annexe'}
            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={uploading} onChange={handleUploadDoc} />
          </label>

          {documents.length === 0 ? (
            <div className="empty-state">
              <div className="icon-circle"><Icon name="folder" /></div>
              <div className="title">Aucun document</div>
              <div className="sub">Ajoutez le contrat signé ou ses annexes</div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-body" style={{ padding: 0 }}>
                {documents.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, background: 'var(--blue-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue-dark)' }}>
                      <Icon name={typeIcons[doc.file_type] || 'file-text'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.file_name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{doc.file_size_bytes ? Math.round(doc.file_size_bytes / 1024) + ' Ko' : ''}</div>
                    </div>
                    <button onClick={() => openViewer(doc)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', padding: 6 }}><Icon name="eye" /></button>
                    <button onClick={() => handleDeleteDoc(doc.id, doc.file_path)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-text)', padding: 6 }}><Icon name="x" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal résiliation */}
      {showCancelModal && (
        <CancelContractModal
          contract={contract}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleConfirmCancel}
        />
      )}

      {/* Visionneuse */}
      {viewer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(0,0,0,0.5)' }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, flex: 1 }}>{viewer.name}</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href={viewer.url} download={viewer.name} style={{ color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="download" /> Télécharger</a>
              <button onClick={() => setViewer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 22 }}><Icon name="x" /></button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            {viewer.type?.startsWith('image/') ? (
              <img src={viewer.url} alt={viewer.name} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
            ) : viewer.type === 'application/pdf' ? (
              <iframe src={viewer.url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }} title={viewer.name} />
            ) : (
              <a href={viewer.url} download={viewer.name} className="btn btn-primary">Télécharger</a>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Modal de préparation de résiliation
// ============================================================
function CancelContractModal({ contract, onClose, onConfirm }) {
  const methodText = {
    email: "par e-mail à l'adresse indiquée sur votre contrat",
    telephone: 'par téléphone au service client',
    courrier_recommande: 'par courrier recommandé avec accusé de réception',
    autre: 'selon les modalités prévues à votre contrat',
  }[contract.notice_method] || 'selon les modalités prévues à votre contrat';

  const letterText = `Objet : Résiliation du contrat ${contract.name}${contract.reference_number ? ` — Référence : ${contract.reference_number}` : ''}

Madame, Monsieur,

Je vous informe par la présente de ma décision de résilier le contrat ${contract.name} souscrit auprès de ${contract.provider || 'votre établissement'}${contract.reference_number ? `, référence ${contract.reference_number}` : ''}.

Je vous remercie de bien vouloir prendre en compte cette résiliation à compter de la date d'échéance du contrat, soit le ${new Date(contract.end_date).toLocaleDateString('fr-FR')}, et de m'en confirmer la bonne réception.

Cordialement.`;

  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(letterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: 480, width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-top">
          <div className="modal-close" onClick={onClose}><Icon name="x" /></div>
          <div className="modal-icon"><Icon name="file-export" /></div>
          <h3>Préparer la résiliation</h3>
          <p>Envoyez ce courrier {methodText}</p>
        </div>
        <div className="modal-body">
          <textarea
            readOnly
            value={letterText}
            rows={10}
            style={{
              width: '100%', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)',
              padding: 14, fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6,
              color: 'var(--ink)', resize: 'vertical', marginBottom: 14,
            }}
          />
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={handleCopy}>
            <Icon name={copied ? 'check' : 'paperclip'} /> {copied ? 'Copié !' : 'Copier le texte'}
          </button>

          <div style={{ fontSize: 12, color: 'var(--ink-faint)', textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
            🚧 L'envoi automatique par e-mail ou courrier recommandé directement depuis l'application arrive prochainement.
          </div>

          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onConfirm}>
              <Icon name="check" /> Marquer comme résilié
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          </div>
        </div>
      </div>
    </div>
  );
}
