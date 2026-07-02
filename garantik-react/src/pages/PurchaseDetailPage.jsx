import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import SimilarSuggest from '../components/SimilarSuggest.jsx';

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

function warrantyPercent(purchaseDate, endDate) {
  if (!purchaseDate || !endDate) return 0;
  const start = new Date(purchaseDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  if (now >= end) return 100;
  if (now <= start) return 0;
  return Math.round(((now - start) / (end - start)) * 100);
}

const typeIcons = { 'image/jpeg': 'photo', 'image/png': 'photo', 'image/webp': 'photo', 'application/pdf': 'pdf' };
const catLabels = { garantie: 'Garantie', facture: 'Facture', justificatif: 'Justificatif', contrat: 'Contrat', autre: 'Autre' };

export default function PurchaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useOutletContext();
  const orgId = profile?.organization_id;

  const [purchase, setPurchase] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('detail');

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  // Document upload
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState(null); // { url, type }

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    loadAll();
  }, [id, orgId]);

  // Charger les listes existantes pour l'autocomplete (marques, enseignes, catégories)
  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      supabase.from('brands').select('name').eq('organization_id', orgId).order('name'),
      supabase.from('stores').select('name').eq('organization_id', orgId).order('name'),
      supabase.from('categories').select('name').eq('organization_id', orgId).order('name'),
    ]).then(([{ data: b }, { data: s }, { data: c }]) => {
      setBrands(b?.map(x => x.name) || []);
      setStores(s?.map(x => x.name) || []);
      setCategories(c?.map(x => x.name) || []);
    });
  }, [orgId]);

  async function loadAll() {
    const [{ data: p }, { data: d }, { data: linkedContracts }] = await Promise.all([
      supabase.from('purchases').select('*').eq('id', id).eq('organization_id', orgId).single(),
      supabase.from('documents').select('*').eq('purchase_id', id).order('created_at'),
      supabase.from('contracts').select('id, name, contract_type, end_date').eq('purchase_id', id).order('end_date'),
    ]);
    if (!p) { navigate('/dashboard'); return; }
    setPurchase(p);
    setEditData(p);
    setDocuments(d || []);
    setContracts(linkedContracts || []);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from('purchases').update({
      object_name: editData.object_name,
      brand: editData.brand,
      store: editData.store,
      category: editData.category,
      total_amount: editData.total_amount,
      purchase_date: editData.purchase_date,
      warranty_duration_months: editData.warranty_duration_months,
      notes: editData.notes,
    }).eq('id', id);
    await loadAll();
    setSaving(false);
    setEditing(false);
  }

  async function handleDelete() {
    await supabase.from('purchases').delete().eq('id', id);
    navigate('/dashboard');
  }

  async function handleUploadDoc(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const filePath = `${orgId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('documents').upload(filePath, file);
    if (!upErr) {
      const isPrimary = documents.length === 0;
      await supabase.from('documents').insert({
        organization_id: orgId,
        purchase_id: id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size_bytes: file.size,
        document_category: isPrimary ? 'garantie' : 'autre',
      });
      await loadAll();
    }
    setUploading(false);
  }

  async function handleSetPrimary(docId) {
    // Mettre ce doc en "garantie" (principal) et les autres en "autre"
    await Promise.all(documents.map(d =>
      supabase.from('documents').update({ document_category: d.id === docId ? 'garantie' : 'autre' }).eq('id', d.id)
    ));
    await loadAll();
  }

  async function openViewer(doc) {
    // Documents Google Drive : ouvrir directement le lien Drive
    if (doc.storage_provider === 'google_drive' && doc.external_file_url) {
      window.open(doc.external_file_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!doc.file_path) return;
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 300);
    if (data?.signedUrl) setViewer({ url: data.signedUrl, type: doc.file_type, name: doc.file_name });
  }

  async function downloadFile(doc) {
    // Documents Google Drive : ouvrir dans Drive
    if (doc.storage_provider === 'google_drive' && doc.external_file_url) {
      window.open(doc.external_file_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!doc.file_path) return;
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 60);
    if (!data?.signedUrl) return;
    // Forcer le téléchargement via fetch+blob pour éviter l'ouverture dans un nouvel onglet
    try {
      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback si le fetch échoue (CORS etc.)
      window.open(data.signedUrl, '_blank');
    }
  }

  async function handleDeleteDoc(docId, filePath) {
    if (!window.confirm('Supprimer ce document ? Cette action est irréversible.')) return;
    await supabase.storage.from('documents').remove([filePath]);
    await supabase.from('documents').delete().eq('id', docId);
    await loadAll();
  }

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-faint)' }}>Chargement…</div>;

  const days = daysUntil(purchase.warranty_end_date);
  const pct = warrantyPercent(purchase.purchase_date, purchase.warranty_end_date);
  const expired = days !== null && days < 0;
  const expiring = days !== null && days >= 0 && days <= 60;
  const statusColor = expired ? 'var(--red)' : expiring ? 'var(--amber)' : 'var(--green)';
  const statusLabel = expired ? 'Expirée' : expiring ? `Expire dans ${days} jours` : 'Active';

  const primaryDoc = documents.find(d => d.document_category === 'garantie') || documents[0];

  return (
    <>
      {/* Hero header */}
      <div className={`detail-hero ${expired ? 'expired' : expiring ? 'expiring' : 'active'}`}>
        <div className="detail-hero-top">
          <button onClick={() => navigate(-1)} className="detail-hero-back">
            <Icon name="arrow-left" style={{ fontSize: 14 }} />
          </button>
          <div className="detail-hero-badges">
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              {statusLabel}
            </span>
            {purchase.total_amount && (
              <span style={{ fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                {purchase.total_amount} €
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
          {purchase.category || 'Garantie'}
        </div>
        <h1 className="detail-hero-title">{purchase.object_name}</h1>
        <div className="detail-hero-meta">
          {purchase.brand && <span><Icon name="tag" style={{ fontSize: 11 }} />{purchase.brand}</span>}
          {purchase.store && <span><Icon name="building-store" style={{ fontSize: 11 }} />{purchase.store}</span>}
          {purchase.purchase_date && <span><Icon name="calendar" style={{ fontSize: 11 }} />Acheté le {formatDate(purchase.purchase_date)}</span>}
        </div>
      </div>

      {/* Onglets */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {[
          { id: 'detail', label: 'Détail', icon: 'package' },
          { id: 'documents', label: `Documents (${documents.length})`, icon: 'folder' },
          { id: 'recap', label: 'Récap', icon: 'receipt' },
        ].map(t => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
            style={{ cursor: 'pointer' }} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ===== ONGLET DÉTAIL ===== */}
      {tab === 'detail' && (
        <>
          {/* Barre de garantie */}
          <div className="panel" style={{ marginBottom: 16, padding: '20px 20px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--ink-faint)' }}>Début : {formatDate(purchase.purchase_date)}</span>
              <span style={{ color: 'var(--ink-faint)' }}>Fin : {formatDate(purchase.warranty_end_date)}</span>
            </div>
            <div className="warranty-track">
              <div className="warranty-fill" style={{ width: `${pct}%`, background: statusColor }} />
              <div className="warranty-marker" style={{ left: `${pct}%`, borderColor: statusColor }} />
            </div>
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 13.5, fontWeight: 600, color: statusColor }}>
              {expired
                ? `Expirée depuis ${Math.abs(days)} jours`
                : days === 0 ? "Expire aujourd'hui !"
                : `${pct}% de la garantie écoulée · ${days} jours restants`}
            </div>
          </div>

          {/* Infos ou formulaire d'édition */}
          {editing ? (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header">
                <h3>Modifier la garantie</h3>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setEditing(false)}>Annuler</button>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label>Nom de l'objet</label>
                  <input type="text" value={editData.object_name || ''} onChange={e => setEditData(d => ({ ...d, object_name: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <SimilarSuggest
                    orgId={orgId}
                    table="brands"
                    value={editData.brand}
                    onChange={(v) => setEditData(d => ({ ...d, brand: v }))}
                    options={brands}
                    onOptionAdded={(v) => setBrands(prev => [...prev, v].sort())}
                    placeholder="Ex : Bosch"
                    label="Marque"
                  />
                  <SimilarSuggest
                    orgId={orgId}
                    table="stores"
                    value={editData.store}
                    onChange={(v) => setEditData(d => ({ ...d, store: v }))}
                    options={stores}
                    onOptionAdded={(v) => setStores(prev => [...prev, v].sort())}
                    placeholder="Ex : Darty"
                    label="Enseigne"
                  />
                  <SimilarSuggest
                    orgId={orgId}
                    table="categories"
                    value={editData.category}
                    onChange={(v) => setEditData(d => ({ ...d, category: v }))}
                    options={categories}
                    onOptionAdded={(v) => setCategories(prev => [...prev, v].sort())}
                    placeholder="Ex : Équipement maison"
                    label="Catégorie"
                  />
                  <div className="field">
                    <label>Montant</label>
                    <input type="number" step="0.01" value={editData.total_amount || ''} onChange={e => setEditData(d => ({ ...d, total_amount: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Date d'achat</label>
                    <input type="date" value={editData.purchase_date || ''} onChange={e => setEditData(d => ({ ...d, purchase_date: e.target.value }))} />
                  </div>
                </div>
                <div className="field">
                  <label>Durée de garantie (mois)</label>
                  <input type="number" min="1" max="240" value={editData.warranty_duration_months || ''}
                    onChange={e => setEditData(d => ({ ...d, warranty_duration_months: parseInt(e.target.value) || '' }))}
                    placeholder="Ex : 24" />
                  <span className="hint">Saisissez n'importe quelle durée en mois (ex : 6, 18, 30…)</span>
                </div>
                <div className="field">
                  <label>Notes</label>
                  <textarea rows={3} value={editData.notes || ''} onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))}
                    style={{ resize: 'vertical' }} />
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ justifyContent: 'center' }}>
                  <Icon name="check" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          ) : (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header">
                <h3><div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name="package" /></div>Informations</h3>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setEditing(true)}>
                  <Icon name="edit" /> Modifier
                </button>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                {[
                  { k: 'Marque', v: purchase.brand },
                  { k: 'Enseigne', v: purchase.store },
                  { k: 'Montant payé', v: purchase.total_amount ? `${purchase.total_amount} €` : null },
                  { k: 'Date d\'achat', v: formatDate(purchase.purchase_date, true) },
                  { k: 'Fin de garantie', v: formatDate(purchase.warranty_end_date, true) },
                  { k: 'Durée de garantie', v: purchase.warranty_duration_months ? `${purchase.warranty_duration_months} mois` : null },
                  { k: 'Catégorie', v: purchase.category },
                  { k: 'Notes', v: purchase.notes },
                ].filter(r => r.v).map(({ k, v }) => (
                  <div key={k} className="kv-row" style={{ padding: '11px 20px' }}>
                    <span className="k">{k}</span>
                    <span className="v">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contrats liés */}
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header">
              <h3><div className="panel-header-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}><Icon name="shield-check" /></div>Contrats liés</h3>
              <Link to={`/add-contract?purchase_id=${id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>
                <Icon name="plus" /> Lier un contrat
              </Link>
            </div>
            {contracts.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>
                Aucun contrat lié (extension de garantie, assurance…)
              </div>
            ) : (
              <div className="panel-body" style={{ padding: 0 }}>
                {contracts.map(c => (
                  <Link key={c.id} to={`/contract/${c.id}`} className="purchase-row" style={{ textDecoration: 'none' }}>
                    <div className="purchase-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}><Icon name="shield-check" /></div>
                    <div className="purchase-main">
                      <div className="purchase-title">{c.name}</div>
                      <div className="purchase-meta">{c.contract_type} · Fin le {formatDate(c.end_date)}</div>
                    </div>
                    <Icon name="chevron-down" style={{ transform: 'rotate(-90deg)', color: 'var(--ink-faint)' }} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Actions dangereuses */}
          <div className="panel">
            <div style={{ padding: 16 }}>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} style={{
                  width: '100%', padding: 13, borderRadius: 'var(--radius-m)',
                  background: 'var(--red-pale)', color: 'var(--red-text)',
                  border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}>
                  <Icon name="x" /> Supprimer cette garantie
                </button>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
                    Confirmer la suppression ? Cette action est irréversible.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmDelete(false)}>Annuler</button>
                    <button onClick={handleDelete} style={{
                      flex: 1, padding: 13, borderRadius: 'var(--radius-m)',
                      background: 'var(--red)', color: '#fff', border: 'none',
                      fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}>Supprimer</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===== ONGLET DOCUMENTS ===== */}
      {tab === 'documents' && (
        <>
          {/* Upload */}
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: 16, borderRadius: 'var(--radius-m)', border: '2px dashed var(--blue)',
            background: 'var(--blue-pale-2)', cursor: uploading ? 'wait' : 'pointer',
            color: 'var(--blue-dark)', fontWeight: 600, fontSize: 14, marginBottom: 16,
          }}>
            <Icon name="upload" />
            {uploading ? 'Upload en cours…' : 'Ajouter un document (photo, PDF)'}
            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
              disabled={uploading} onChange={handleUploadDoc} />
          </label>

          {documents.length === 0 ? (
            <div className="empty-state">
              <div className="icon-circle"><Icon name="folder" /></div>
              <div className="title">Aucun document</div>
              <div className="sub">Ajoutez votre ticket de caisse ou votre facture ci-dessus</div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-header">
                <h3>
                  <div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name="folder" /></div>
                  {documents.length} document{documents.length > 1 ? 's' : ''}
                </h3>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                {documents.map(doc => {
                  const isPrimary = doc.document_category === 'garantie';
                  const isImage = doc.file_type?.startsWith('image/');
                  return (
                    <div key={doc.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderBottom: '1px solid var(--line)',
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                        background: isPrimary ? 'var(--blue-pale)' : 'var(--gray-pale)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, color: isPrimary ? 'var(--blue-dark)' : 'var(--ink-soft)',
                      }}>
                        <Icon name={typeIcons[doc.file_type] || 'file-text'} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.file_name}
                          {isPrimary && <span style={{ marginLeft: 8, fontSize: 10.5, background: 'var(--blue)', color: '#fff', padding: '2px 7px', borderRadius: 99 }}>Principal</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                          {catLabels[doc.document_category] || 'Autre'} · {doc.file_size_bytes ? Math.round(doc.file_size_bytes / 1024) + ' Ko' : ''}
                        </div>
                      </div>
                      {/* Actions */}
                      <button onClick={() => openViewer(doc)} title="Visualiser" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', padding: 6 }}>
                        <Icon name="eye" />
                      </button>
                      <button onClick={() => downloadFile(doc)} title="Télécharger" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', padding: 6 }}>
                        <Icon name="download" />
                      </button>
                      {!isPrimary && (
                        <button onClick={() => handleSetPrimary(doc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 6, fontSize: 12 }} title="Définir comme principal">
                          <Icon name="star-filled" style={{ fontSize: 14 }} />
                        </button>
                      )}
                      <button onClick={() => handleDeleteDoc(doc.id, doc.file_path)} title="Supprimer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-text)', padding: 6 }}>
                        <Icon name="x" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== ONGLET RÉCAP ===== */}
      {tab === 'recap' && (
        <div className="panel">
          <div className="panel-header">
            <h3><div className="panel-header-icon" style={{ background: 'var(--blue-pale)', color: 'var(--blue-dark)' }}><Icon name="receipt" /></div>Récapitulatif</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{purchase.object_name}</div>
            {purchase.brand && <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>{purchase.brand}{purchase.store ? ` · ${purchase.store}` : ''}</div>}

            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-m)', padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Acheté le</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(purchase.purchase_date, true)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Fin de garantie</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: statusColor }}>{formatDate(purchase.warranty_end_date, true)}</span>
              </div>
              {purchase.total_amount && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Montant payé</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{purchase.total_amount} €</span>
                </div>
              )}
            </div>

            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius-m)',
              background: expired ? 'var(--red-pale)' : expiring ? 'var(--amber-pale)' : 'var(--green-pale)',
              color: expired ? 'var(--red-text)' : expiring ? 'var(--amber-text)' : 'var(--green-text)',
              fontWeight: 600, fontSize: 14, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Icon name={expired ? 'alert-triangle' : expiring ? 'clock' : 'circle-check'} />
              {expired ? `Garantie expirée il y a ${Math.abs(days)} jours`
                : expiring ? `Attention : garantie expirée dans ${days} jours`
                : `Garantie active · ${days} jours restants`}
            </div>

            <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.7, background: 'var(--blue-pale-2)', padding: '12px 16px', borderRadius: 'var(--radius-m)' }}>
              <strong style={{ color: 'var(--navy)' }}>Rappel légal :</strong> En France, tout produit neuf bénéficie d'une garantie légale de conformité de <strong>2 ans</strong> à compter de la date d'achat, indépendamment de la garantie constructeur.
            </div>

            {documents.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', marginBottom: 10 }}>
                  Documents attachés ({documents.length})
                </div>
                {documents.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                    <Icon name={typeIcons[doc.file_type] || 'file-text'} style={{ color: 'var(--blue)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--navy)', flex: 1 }}>{doc.file_name}</span>
                    <button onClick={() => openViewer(doc)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', fontSize: 12, fontWeight: 600 }}>
                      Voir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== VISIONNEUSE ===== */}
      {viewer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
          zIndex: 2000, display: 'flex', flexDirection: 'column',
        }}>
          {/* Header visionneuse */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(0,0,0,0.5)' }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{viewer.name}</span>
            <div style={{ display: 'flex', gap: 12, marginLeft: 16 }}>
              <button onClick={() => downloadFile(viewer)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="download" /> Télécharger
              </button>
              <button onClick={() => setViewer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 22, lineHeight: 1 }}>
                <Icon name="x" />
              </button>
            </div>
          </div>
          {/* Contenu */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            {viewer.type?.startsWith('image/') ? (
              <img src={viewer.url} alt={viewer.name} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
            ) : viewer.type === 'application/pdf' ? (
              <iframe src={viewer.url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }} title={viewer.name} />
            ) : (
              <div style={{ color: '#fff', textAlign: 'center' }}>
                <Icon name="file-text" style={{ fontSize: 64, display: 'block', margin: '0 auto 16px' }} />
                <p>Aperçu non disponible pour ce type de fichier</p>
                <button onClick={() => downloadFile(viewer)} className="btn btn-primary" style={{ marginTop: 16 }}>Télécharger</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
