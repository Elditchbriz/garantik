import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
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

// Zone tactile 44px minimum (audit P2 — accessibilité), icône visuelle
// plus petite centrée à l'intérieur pour ne pas alourdir le design.
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

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase.from('documents').select('*')
        .eq('organization_id', orgId).order('created_at', { ascending: false });
      setDocs(data || []);
      setLoading(false);
    })();
  }, [orgId]);

  async function openViewer(doc) {
    if (doc.storage_provider === 'google_drive' && doc.external_file_url) {
      window.open(doc.external_file_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!doc.file_path) return;
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 300);
    if (data?.signedUrl) setViewer({ url: data.signedUrl, type: doc.file_type, name: doc.file_name });
  }

  async function downloadFile(doc) {
    if (doc.storage_provider === 'google_drive' && doc.external_file_url) {
      window.open(doc.external_file_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!doc.file_path) return;
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 60);
    if (!data?.signedUrl) return;
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
    await supabase.storage.from('documents').remove([doc.file_path]);
    await supabase.from('documents').delete().eq('id', doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  }

  const filtered = filter === 'all' ? docs : docs.filter(d => d.document_category === filter);

  return (
    <>
      <PageHeader title="Mes documents" subtitle="Retrouvez tous vos documents achats et contrats en sécurité" />

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
          <div className="sub">Vos tickets et documents scannés apparaîtront ici automatiquement</div>
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
                  <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
                    <button onClick={() => openViewer(doc)} title="Visualiser" style={{ ...BTN, color: 'var(--blue)' }}>
                      <Icon name="eye" style={{ fontSize: 16 }} />
                    </button>
                    <button onClick={() => downloadFile(doc)} title="Télécharger" style={{ ...BTN, color: 'var(--ink-soft)' }}>
                      <Icon name="download" style={{ fontSize: 16 }} />
                    </button>
                    <button onClick={() => handleDelete(doc)} title="Supprimer" style={{ ...BTN, color: 'var(--red-text)' }}>
                      <Icon name="x" style={{ fontSize: 16 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visionneuse */}
      {viewer && (
        <DocumentViewer viewer={viewer} onClose={() => setViewer(null)} onDownload={downloadFile} />
      )}
    </>
  );
}
