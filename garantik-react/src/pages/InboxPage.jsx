import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase, getEmailInbox, deleteInboxItem } from '../lib/supabaseClient.js';
import Icon from '../components/Icon.jsx';
import PageHeader from '../components/PageHeader.jsx';

// Domaine de réception des emails — à mettre à jour quand le vrai domaine sera configuré
// Avec Brevo domaine partagé : votre-code@[domaine-brevo-inbound]
// Avec domaine propre : votre-code@in.garantik.fr
const INBOX_DOMAIN = 'in.brevo.com'; // à ajuster selon ce que Brevo vous donne

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const typeIcons = {
  'application/pdf': 'pdf',
  'image/jpeg': 'photo', 'image/png': 'photo', 'image/webp': 'photo',
};

export default function InboxPage() {
  const { profile } = useOutletContext();
  const navigate = useNavigate();
  const orgId = profile?.organization_id;

  const [items, setItems] = useState([]);
  const [inboxCode, setInboxCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [{ data: inbox }, { data: org }] = await Promise.all([
        getEmailInbox(orgId),
        supabase.from('organizations').select('inbox_code').eq('id', orgId).single(),
      ]);
      setItems(inbox || []);
      setInboxCode(org?.inbox_code || '');
      setLoading(false);
    })();
  }, [orgId]);

  async function handleView(item) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_path, 300);
    if (data?.signedUrl) setViewer({ url: data.signedUrl, type: item.file_type, name: item.file_name });
  }

  async function handleDelete(item) {
    if (!window.confirm(`Supprimer "${item.file_name}" de la boîte de réception ?`)) return;
    await deleteInboxItem(item.id, item.file_path);
    setItems(prev => prev.filter(i => i.id !== item.id));
  }

  function handleProcess(item) {
    // Détecter si c'est probablement un contrat ou un achat selon le nom/sujet
    const isProbablyContract = /contrat|assurance|abonnement|leasing|bail|location/i.test(
      `${item.file_name} ${item.subject}`
    );
    const route = isProbablyContract ? '/add-contract' : '/add-purchase';
    navigate(`${route}?inbox_id=${item.id}`);
  }

  function copyAddress() {
    navigator.clipboard.writeText(`${inboxCode}@${INBOX_DOMAIN}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <PageHeader
        title="Boîte de réception"
        subtitle="Transférez vos tickets et contrats par email pour les traiter ici"
      />

      {/* Adresse email personnelle */}
      <div style={{
        background: 'var(--blue-pale-2)', border: '1px solid var(--blue-pale)',
        borderRadius: 'var(--radius-m)', padding: '16px 18px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--blue-dark)', marginBottom: 8 }}>
          Votre adresse email personnelle
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <code style={{
            flex: 1, padding: '10px 14px', background: 'var(--white)', borderRadius: 'var(--radius-s)',
            border: '1px solid var(--line)', fontSize: 14, fontFamily: 'monospace', fontWeight: 600,
            color: 'var(--navy)', wordBreak: 'break-all',
          }}>
            {`${inboxCode}@${INBOX_DOMAIN}`}
          </code>
          <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={copyAddress}>
            <Icon name={copied ? 'check' : 'paperclip'} /> {copied ? 'Copié !' : 'Copier'}
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '10px 0 0', lineHeight: 1.5 }}>
          Transférez n'importe quel email contenant un ticket de caisse ou un contrat à cette adresse.
          Les pièces jointes (PDF, images) apparaîtront automatiquement ici, prêtes à être traitées.
        </p>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 32 }}>Chargement…</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="icon-circle"><Icon name="mail" /></div>
          <div className="title">Aucun document en attente</div>
          <div className="sub">
            Transférez un email avec une pièce jointe à {`${inboxCode}@${INBOX_DOMAIN}`}
            et il apparaîtra ici automatiquement.
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-header">
            <h3>
              <div className="panel-header-icon" style={{ background: 'var(--amber-pale)', color: 'var(--amber-text)' }}>
                <Icon name="mail" />
              </div>
              {items.length} document{items.length > 1 ? 's' : ''} en attente
            </h3>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {items.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px', borderBottom: '1px solid var(--line)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                  background: 'var(--amber-pale)', color: 'var(--amber-text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>
                  <Icon name={typeIcons[item.file_type] || 'file-text'} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.file_name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>
                    {item.from_email && <>{item.from_email} · </>}
                    {formatDate(item.received_at)}
                    {item.file_size_bytes && <> · {formatSize(item.file_size_bytes)}</>}
                  </div>
                  {item.subject && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Objet : {item.subject}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => handleView(item)} title="Visualiser" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', padding: 6 }}>
                    <Icon name="eye" />
                  </button>
                  <button onClick={() => handleProcess(item)} title="Traiter — créer une garantie ou un contrat" style={{
                    background: 'var(--blue)', color: '#fff', border: 'none', cursor: 'pointer',
                    padding: '6px 12px', borderRadius: 'var(--radius-s)', fontSize: 12.5, fontWeight: 600,
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <Icon name="sparkles" style={{ fontSize: 13 }} /> Traiter
                  </button>
                  <button onClick={() => handleDelete(item)} title="Supprimer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-text)', padding: 6 }}>
                    <Icon name="x" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visionneuse */}
      {viewer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(0,0,0,0.5)' }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, flex: 1 }}>{viewer.name}</span>
            <button onClick={() => setViewer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 22 }}>
              <Icon name="x" />
            </button>
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
