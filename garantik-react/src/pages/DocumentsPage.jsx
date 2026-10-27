import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useOutletContext } from 'react-router-dom';
import { supabase, getHostedDocumentUrl, getHostedDocumentView, HOSTED_WITH_TEMP_LINK, HOSTED_VIEW_IN_APP, MAX_VIEW_IN_APP_BYTES } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';
import useFocusTrap from '../hooks/useFocusTrap.js';

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const typeIcons = {
  'image/jpeg': 'photo', 'image/png': 'photo', 'image/webp': 'photo',
  'application/pdf': 'pdf',
};

const categoryColors = {
  garantie:     { bg: 'var(--blue-pale)',  color: 'var(--blue-dark)' },
  facture:      { bg: 'var(--green-pale)', color: 'var(--green-text)' },
  justificatif: { bg: 'var(--amber-pale)', color: 'var(--amber-text)' },
  contrat:      { bg: 'var(--red-pale)',   color: 'var(--red-text)' },
  autre:        { bg: 'var(--gray-pale)',  color: 'var(--ink-soft)' },
};

const catLabels = {
  all: 'Tous', garantie: 'Garanties', facture: 'Factures',
  justificatif: 'Justificatifs', contrat: 'Contrats', autre: 'Autres',
};

const BTN = {
  background: 'none', border: 'none', cursor: 'pointer',
  width: 44, height: 44, minWidth: 44, minHeight: 44,
  borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function DocumentViewer({ viewer, onClose, onDownload }) {
  const trapRef = useFocusTrap(onClose);
  return (
    <div ref={trapRef} tabIndex={-1} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(0,0,0,0.5)' }}>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewer.name}</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
          <button onClick={() => onDownload(viewer)} style={{ ...BTN, color: '#fff', fontSize: 13, gap: 6, width: 'auto', padding: '0 12px' }}>
            <Icon name="download" /> Télécharger
          </button>
          <button onClick={onClose} style={{ ...BTN, color: '#fff', fontSize: 22 }}>
            <Icon name="x" />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        {viewer.type?.startsWith('image/') ? (
          <img src={viewer.url} alt={viewer.name} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
        ) : viewer.type === 'application/pdf' ? (
          <iframe src={viewer.url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }} title={viewer.name} />
        ) : (
          <button onClick={() => onDownload(viewer)} className="btn btn-primary">Télécharger</button>
        )}
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const { profile } = useOutletContext();
  const orgId = profile?.organization_id;

  const [docs, setDocs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]  = useState('all');
  const [viewer, setViewer]  = useState(null);
  const [openDocMenu, setOpenDocMenu] = useState(null);
  const [renamingDoc, setRenamingDoc] = useState(null); // { id, name }
  const [categoryMenuDocId, setCategoryMenuDocId] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase.from('documents').select('*')
        .eq('organization_id', orgId).order('created_at', { ascending: false });
      setDocs(data || []);
      setLoading(false);
    })();
  }, [orgId]);

  // Document hébergé chez Dropbox ou OneDrive : lien TEMPORAIRE demandé à Hey Did (réservé aux membres connectés du foyer), jamais de lien public.
  // Sur le web, la fenêtre est ouverte tout de suite (action de l'utilisateur) puis dirigée vers le lien : après l'attente du serveur,
  // le navigateur pourrait bloquer l'ouverture.
  async function openHostedDoc(doc) {
    const native = Capacitor.isNativePlatform();
    const win = native ? null : window.open('', '_blank');
    if (win) win.opener = null;
    const { url, error } = await getHostedDocumentUrl(doc.storage_provider, doc.id);
    if (!url) { if (win) win.close(); window.alert(error); return; }
    if (native) await Browser.open({ url });
    else if (win) win.location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
  }

  // VISUALISER un document hébergé chez Dropbox ou OneDrive. Chez OneDrive, le lien de courte durée est un lien de TÉLÉCHARGEMENT : le navigateur ne l'afficherait pas.
  // Pour les images et les PDF de taille raisonnable, Hey Did récupère donc le fichier (réservé aux membres connectés du foyer) et l'affiche dans son visualiseur, comme
  // un document hébergé chez Hey Did. Autres cas (Word, très gros fichier, PDF dans l'app Android, Dropbox) : lien de courte durée, comme avant.
  async function viewHostedDoc(doc) {
    const showable = doc.file_type?.startsWith('image/') || doc.file_type === 'application/pdf';
    const tooBig = (doc.file_size_bytes || 0) > MAX_VIEW_IN_APP_BYTES;
    const nativePdf = Capacitor.isNativePlatform() && doc.file_type === 'application/pdf';   // les WebView Android n'affichent pas les PDF dans le visualiseur
    if (!HOSTED_VIEW_IN_APP.includes(doc.storage_provider) || !showable || tooBig || nativePdf) { await openHostedDoc(doc); return; }
    const { blob, url, error } = await getHostedDocumentView(doc.storage_provider, doc.id, doc.file_type);
    if (error) { window.alert(error); return; }
    if (blob) { setViewer({ url: URL.createObjectURL(blob), type: doc.file_type, name: doc.file_name, doc }); return; }
    // Le serveur a répondu par un lien (type ou taille non affichables) : téléchargement
    if (Capacitor.isNativePlatform()) await Browser.open({ url });
    else window.open(url, '_blank', 'noopener,noreferrer');
  }

  function closeViewer() {
    if (viewer?.url?.startsWith('blob:')) URL.revokeObjectURL(viewer.url);   // fichier affiché depuis OneDrive : on libère la mémoire
    setViewer(null);
  }

  // Le visualiseur transmet son propre objet { url, type, name, doc } : « Télécharger » doit agir sur le DOCUMENT. Avant, il recevait seulement { url, type, name }
  // et la fonction de téléchargement, qui cherche le chemin du fichier dans le document, ne faisait rien.
  function downloadFromViewer(v) { return downloadFile(v?.doc || v); }

  async function openViewer(doc) {
    if (HOSTED_WITH_TEMP_LINK.includes(doc.storage_provider)) { await viewHostedDoc(doc); return; }
    if (doc.storage_provider !== 'supabase' && doc.external_file_url) {   // Google Drive, Dropbox… : on ouvre le lien du fournisseur
      window.open(doc.external_file_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!doc.file_path) return;
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 300);
    if (!data?.signedUrl) return;
    // Les WebView Android n'affichent pas les PDF en <iframe> (contrairement
    // à Chrome desktop) — on les ouvre dans le lecteur système à la place.
    // Les images, elles, s'affichent très bien dans le visualiseur intégré.
    if (Capacitor.isNativePlatform() && doc.file_type === 'application/pdf') {
      await Browser.open({ url: data.signedUrl });
      return;
    }
    setViewer({ url: data.signedUrl, type: doc.file_type, name: doc.file_name, doc });
  }

  async function downloadFile(doc) {
    if (HOSTED_WITH_TEMP_LINK.includes(doc.storage_provider)) { await openHostedDoc(doc); return; }
    if (doc.storage_provider !== 'supabase' && doc.external_file_url) {   // Google Drive, Dropbox… : on ouvre le lien du fournisseur
      window.open(doc.external_file_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!doc.file_path) return;
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 60);
    if (!data?.signedUrl) return;

    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: data.signedUrl });
      return;
    }

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
      window.open(data.signedUrl, '_blank');
    }
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Supprimer "${doc.file_name}" ? Cette action est irréversible.`)) return;
    // Un document hébergé chez l'utilisateur (Dropbox, Google Drive…) n'a pas de fichier chez Hey Did : rien à retirer du stockage
    if (doc.file_path) await supabase.storage.from('documents').remove([doc.file_path]);
    await supabase.from('documents').delete().eq('id', doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  }

  async function handleRenameDoc(docId, newName) {
    if (!newName?.trim()) return;
    await supabase.from('documents').update({ file_name: newName.trim() }).eq('id', docId);
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, file_name: newName.trim() } : d));
  }

  async function handleChangeCategory(docId, category) {
    await supabase.from('documents').update({ document_category: category }).eq('id', docId);
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, document_category: category } : d));
  }

  const filtered = filter === 'all' ? docs : docs.filter(d => d.document_category === filter);

  return (
    <>
      <PageHeader title="Mes documents" subtitle="Retrouve tous tes documents achats et contrats en sécurité" />

      <div className="pill-group" style={{ marginBottom: 20 }}>
        {Object.keys(catLabels).map(c => (
          <div key={c} className={`pill ${filter === c ? 'active' : ''}`}
            style={{ cursor: 'pointer' }} onClick={() => setFilter(c)}>
            {catLabels[c]}
          </div>
        ))}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 32 }}>Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon-circle"><Icon name="folder" /></div>
          <div className="title">Aucun document</div>
          <div className="sub">Tes tickets et documents scannés apparaîtront ici automatiquement</div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-body" style={{ padding: 0 }}>
            {filtered.map(doc => {
              const cat = categoryColors[doc.document_category] || categoryColors.autre;
              return (
                <div key={doc.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 16px', borderBottom: '1px solid var(--line)',
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0, background: cat.bg, color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
                    <Icon name={typeIcons[doc.file_type] || 'file-text'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.file_name}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>
                      {catLabels[doc.document_category] || 'Autre'} · {formatDate(doc.created_at)} · {formatSize(doc.file_size_bytes)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      if (openDocMenu?.docId === doc.id) { setOpenDocMenu(null); return; }
                      const rect = e.currentTarget.getBoundingClientRect();
                      const estimatedMenuHeight = 160; // 3 options ici (pas de "Définir comme principal")
                      const notEnoughRoomBelow = rect.bottom + estimatedMenuHeight > window.innerHeight;
                      const top = notEnoughRoomBelow
                        ? Math.max(8, rect.top - estimatedMenuHeight - 4)
                        : rect.bottom + 4;
                      setOpenDocMenu({
                        docId: doc.id,
                        top,
                        right: window.innerWidth - rect.right,
                      });
                    }}
                    style={{ ...BTN, color: 'var(--ink-soft)', fontSize: 20, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}
                    aria-label="Actions"
                  >
                    ⋯
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {openDocMenu && createPortal(
        (() => {
          const doc = filtered.find(d => d.id === openDocMenu.docId);
          if (!doc) return null;
          return (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 2000 }} onClick={() => setOpenDocMenu(null)} />
              <div className="sort-dropdown" style={{
                position: 'fixed', top: openDocMenu.top, right: openDocMenu.right,
                minWidth: 200, zIndex: 2001,
              }}>
                <div className="sort-dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => { setOpenDocMenu(null); openViewer(doc); }}>
                  <Icon name="eye" style={{ fontSize: 14, color: 'var(--blue)' }} /> Visualiser
                </div>
                <div className="sort-dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => { setOpenDocMenu(null); downloadFile(doc); }}>
                  <Icon name="download" style={{ fontSize: 14, color: 'var(--ink-soft)' }} /> Télécharger
                </div>
                <div className="sort-dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => { setOpenDocMenu(null); setRenamingDoc({ id: doc.id, name: doc.file_name }); }}>
                  <Icon name="edit" style={{ fontSize: 14, color: 'var(--ink-soft)' }} /> Renommer
                </div>
                <div style={{ position: 'relative' }}>
                  {/* « Catégoriser » : même construction que les autres lignes (icône + libellé à l'identique, sans flèche) ; un clic ouvre le choix de la catégorie. */}
                  <div className="sort-dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setCategoryMenuDocId(categoryMenuDocId === doc.id ? null : doc.id); }}>
                    <Icon name="category" style={{ fontSize: 14, color: 'var(--ink-soft)' }} /> Catégoriser
                  </div>
                  {categoryMenuDocId === doc.id && (
                    <div style={{ background: 'var(--bg)' }}>
                      {Object.entries(catLabels).filter(([key]) => key !== 'all').map(([key, label]) => {
                        const isCurrent = doc.document_category === key;
                        return (
                          // Même disposition que les lignes du dessus (colonne d'icône, libellé calé comme les autres) ; la catégorie actuelle porte une coche
                          <div key={key}
                            className="sort-dropdown-item"
                            style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--blue)' : 'var(--ink-soft)' }}
                            onClick={() => { setOpenDocMenu(null); setCategoryMenuDocId(null); handleChangeCategory(doc.id, key); }}>
                            {isCurrent ? <Icon name="check" style={{ fontSize: 14 }} /> : <span style={{ width: 14, height: 14, flexShrink: 0 }} />}{label}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="sort-dropdown-item" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--red-text)' }}
                  onClick={() => { setOpenDocMenu(null); handleDelete(doc); }}>
                  <Icon name="x" style={{ fontSize: 14 }} /> Supprimer
                </div>
              </div>
            </>
          );
        })(),
        document.body
      )}

      {renamingDoc && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setRenamingDoc(null)}>
          <div className="modal-card" style={{ maxWidth: 400 }}>
            <div className="modal-top">
              <div className="modal-close" onClick={() => setRenamingDoc(null)}><Icon name="x" /></div>
              <div className="modal-icon"><Icon name="edit" /></div>
              <h3>Renommer le document</h3>
            </div>
            <div className="modal-body">
              <div className="field" style={{ marginBottom: 20 }}>
                <label>Nom du fichier</label>
                <input
                  type="text"
                  value={renamingDoc.name}
                  onChange={(e) => setRenamingDoc(d => ({ ...d, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { handleRenameDoc(renamingDoc.id, renamingDoc.name); setRenamingDoc(null); } }}
                  autoFocus
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => { handleRenameDoc(renamingDoc.id, renamingDoc.name); setRenamingDoc(null); }}>
                <Icon name="check" /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {viewer && (
        <DocumentViewer viewer={viewer} onClose={closeViewer} onDownload={downloadFromViewer} />
      )}
    </>
  );
}
