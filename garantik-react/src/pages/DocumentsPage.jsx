import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

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
  garantie: { bg: 'var(--blue-pale)', color: 'var(--blue-dark)' },
  facture: { bg: 'var(--green-pale)', color: 'var(--green-text)' },
  justificatif: { bg: 'var(--amber-pale)', color: 'var(--amber-text)' },
  contrat: { bg: 'var(--red-pale)', color: 'var(--red-text)' },
  autre: { bg: 'var(--gray-pale)', color: 'var(--ink-soft)' },
};

export default function DocumentsPage() {
  const { profile } = useOutletContext();
  const orgId = profile?.organization_id;

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      setDocs(data || []);
      setLoading(false);
    })();
  }, [orgId]);

  async function handleDownload(doc) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  const filtered = filter === 'all' ? docs : docs.filter(d => d.document_category === filter);

  const categories = ['all', 'garantie', 'facture', 'justificatif', 'contrat', 'autre'];
  const catLabels = { all: 'Tous', garantie: 'Garanties', facture: 'Factures', justificatif: 'Justificatifs', contrat: 'Contrats', autre: 'Autres' };

  return (
    <>
      <PageHeader
        title="Mes documents"
        subtitle="Retrouvez tous vos documents achats et contrats en sécurité"
        
      />


            <div className="pill-group" style={{ marginBottom: 20 }}>
        {categories.map(c => (
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
          <div className="panel-body">
            {filtered.map(doc => {
              const cat = categoryColors[doc.document_category] || categoryColors.autre;
              const iconName = typeIcons[doc.file_type] || 'file-text';
              return (
                <div key={doc.id} className="purchase-row" style={{ cursor: 'pointer' }} onClick={() => handleDownload(doc)}>
                  <div className="purchase-icon" style={{ background: cat.bg, color: cat.color }}>
                    <Icon name={iconName} />
                  </div>
                  <div className="purchase-main">
                    <div className="purchase-title">{doc.file_name}</div>
                    <div className="purchase-meta">
                      {catLabels[doc.document_category] || 'Autre'} · {formatDate(doc.created_at)} · {formatSize(doc.file_size_bytes)}
                    </div>
                  </div>
                  <Icon name="download" style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
