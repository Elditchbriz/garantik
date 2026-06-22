import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext, Link } from 'react-router-dom';
import { supabase, uploadDocument, deleteContract, updateContract, listContractTypes } from '../lib/supabaseClient.js';
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
  const [contractTypes, setContractTypes] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('detail');

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    loadAll();
  }, [id, orgId]);

  async function loadAll() {
    const [{ data: c }, { data: d }, { data: types }, { data: p }] = await Promise.all([
      supabase.from('contracts').select('*, purchases(id, object_name, brand)').eq('id', id).eq('organization_id', orgId).single(),
      supabase.from('documents').select('*').eq('contract_id', id).order('created_at'),
      listContractTypes(orgId),
      supabase.from('purchases').select('id, object_name, brand').eq('organization_id', orgId).order('object_name'),
    ]);
    if (!c) { navigate('/contracts'); return; }
    setContract(c);
    setEditData(c);
    setDocuments(d || []);
    setContractTypes(types || []);
    setPurchases(p || []);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    await updateContract(id, {
      name: editData.name,
      provider: editData.provider,
      contract_type: editData.contract_type,
      reference_number: editData.reference_number,
      start_date: editData.start_date || null,
      end_date: editData.end_date,
      notice_period_days: editData.notice_period_days ? parseInt(editData.notice_period_days) : null,
      notice_method: editData.notice_method,
      renewal_type: editData.renewal_type,
      purchase_id: editData.purchase_id || null,
    });
    await loadAll();
    setSaving(false);
    setEditing(false);
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

  async function handleUploadDoc(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const isPrimary = documents.length === 0;
    const { data } = await uploadDocument(file, orgId, null, null, id);
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
      <div className="ph" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 'var(--radius-s)',
          color: '#fff', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
        }}>
          <Icon name="arrow-left" style={{ fontSize: 14 }} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
            {contract.contract_type || 'Contrat'}
          </div>
          <h1 className="ph-title" style={{ fontSize: 17 }}>{contract.name}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: statusColor, color: '#fff' }}>
            {statusLabel}
          </span>
          {contract.provider && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{contract.provider}</span>}
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

          {contract.purchases ? (
            <Link to={`/purchase/${contract.purchases.id}`} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
              borderRadius: 'var(--radius-m)', background: 'var(--blue-pale-2)', marginBottom: 16,
              textDecoration: 'none', color: 'var(--blue-dark)', fontSize: 13.5, fontWeight: 600,
            }}>
              <Icon name="package" /> Lié à l'achat « {contract.purchases.object_name} »
              <Icon name="chevron-down" style={{ transform: 'rotate(-90deg)', marginLeft: 'auto', fontSize: 14 }} />
            </Link>
          ) : (
            <Link to={`/add-purchase?contract_id=${id}`} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
              borderRadius: 'var(--radius-m)', background: 'var(--gray-pale)', marginBottom: 16,
              textDecoration: 'none', color: 'var(--ink-soft)', fontSize: 13.5, fontWeight: 600,
            }}>
              <Icon name="plus" /> Lier ce contrat à un achat existant ou nouveau
            </Link>
          )}

          {editing ? (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header">
                <h3>Modifier le contrat</h3>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setEditing(false)}>Annuler</button>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label>Nom du contrat</label>
                  <input type="text" value={editData.name || ''} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="field">
                    <label>Prestataire</label>
                    <input type="text" value={editData.provider || ''} onChange={e => setEditData(d => ({ ...d, provider: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Type de contrat</label>
                    <select value={editData.contract_type || ''} onChange={e => setEditData(d => ({ ...d, contract_type: e.target.value }))}>
                      {contractTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Référence</label>
                    <input type="text" value={editData.reference_number || ''} onChange={e => setEditData(d => ({ ...d, reference_number: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Préavis (jours)</label>
                    <input type="number" min="0" value={editData.notice_period_days || ''} onChange={e => setEditData(d => ({ ...d, notice_period_days: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Date de début</label>
                    <input type="date" value={editData.start_date || ''} onChange={e => setEditData(d => ({ ...d, start_date: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Date de fin</label>
                    <input type="date" value={editData.end_date || ''} onChange={e => setEditData(d => ({ ...d, end_date: e.target.value }))} />
                  </div>
                </div>
                <div className="field">
                  <label>Mode de résiliation</label>
                  <select value={editData.notice_method || 'email'} onChange={e => setEditData(d => ({ ...d, notice_method: e.target.value }))}>
                    <option value="email">E-mail</option>
                    <option value="telephone">Téléphone</option>
                    <option value="courrier_recommande">Courrier recommandé</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div className="field">
                  <label>Lié à un achat</label>
                  <select value={editData.purchase_id || ''} onChange={e => setEditData(d => ({ ...d, purchase_id: e.target.value }))}>
                    <option value="">— Contrat indépendant —</option>
                    {purchases.map(p => <option key={p.id} value={p.id}>{p.object_name}{p.brand ? ` · ${p.brand}` : ''}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ justifyContent: 'center' }}>
                  <Icon name="check" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          ) : (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header">
                <h3><div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name="shield-check" /></div>Informations</h3>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setEditing(true)}>
                  <Icon name="edit" /> Modifier
                </button>
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
                ].filter(r => r.v).map(({ k, v }) => (
                  <div key={k} className="kv-row" style={{ padding: '11px 20px' }}>
                    <span className="k">{k}</span>
                    <span className="v">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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

      {showCancelModal && (
        <CancelContractModal contract={contract} onClose={() => setShowCancelModal(false)} onConfirm={handleConfirmCancel} />
      )}

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
          <textarea readOnly value={letterText} rows={10}
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', padding: 14, fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6, color: 'var(--ink)', resize: 'vertical', marginBottom: 14 }} />
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={handleCopy}>
            <Icon name={copied ? 'check' : 'paperclip'} /> {copied ? 'Copié !' : 'Copier le texte'}
          </button>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
            🚧 L'envoi automatique par e-mail ou courrier recommandé directement depuis l'application arrive prochainement.
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onConfirm}><Icon name="check" /> Marquer comme résilié</button>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          </div>
        </div>
      </div>
    </div>
  );
}
