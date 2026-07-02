import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import Icon from './Icon.jsx';

// ============================================================
// StorageConnector — Connexion aux espaces de stockage externes
// Actuellement : Google Drive
// À venir : OneDrive, Dropbox
// ============================================================

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/settings`;
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file', // Accès aux fichiers créés par l'app uniquement
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export default function StorageConnector({ orgId }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [justConnected, setJustConnected] = useState(false);
  const [disconnecting, setDisconnecting] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    loadConnections();
    handleOAuthCallback();
  }, [orgId]);

  async function loadConnections() {
    const { data } = await supabase
      .from('storage_connections')
      .select('*')
      .eq('organization_id', orgId);
    setConnections(data || []);
    setLoading(false);
  }

  // Traiter le callback OAuth si on revient de Google
  async function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      console.error('OAuth error:', error);
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (!code || state !== 'google_drive') return;

    setConnecting('google_drive');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('google-drive-callback', {
        body: {
          code,
          organization_id: orgId,
          redirect_uri: REDIRECT_URI,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.success) {
        await loadConnections();
        setJustConnected(true);
        setTimeout(() => setJustConnected(false), 5000);
      }
    } catch (err) {
      console.error('Erreur connexion Drive:', err);
      alert(`Impossible de connecter Google Drive : ${err.message}`);
    }

    setConnecting(null);
    // Nettoyer l'URL (retirer code, state, scope)
    window.history.replaceState({}, '', window.location.pathname);
  }

  function connectGoogleDrive() {
    if (!GOOGLE_CLIENT_ID) {
      alert('Configuration Google Drive manquante. Contactez le support.');
      return;
    }
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', GOOGLE_SCOPES);
    authUrl.searchParams.set('state', 'google_drive');
    authUrl.searchParams.set('access_type', 'offline'); // Pour obtenir un refresh_token
    authUrl.searchParams.set('prompt', 'consent'); // Forcer le consentement pour avoir le refresh_token
    window.location.href = authUrl.toString();
  }

  async function disconnectProvider(provider) {
    if (!window.confirm(`Déconnecter ${providerLabel(provider)} ? Vos documents existants resteront accessibles via leur lien, mais les nouveaux fichiers seront stockés sur Garantik.`)) return;
    setDisconnecting(provider);
    await supabase
      .from('storage_connections')
      .delete()
      .eq('organization_id', orgId)
      .eq('provider', provider);
    await loadConnections();
    setDisconnecting(null);
  }

  function providerLabel(provider) {
    return { google_drive: 'Google Drive', onedrive: 'OneDrive', dropbox: 'Dropbox' }[provider] || provider;
  }

  function providerIcon(provider) {
    return { google_drive: 'brand-google-drive', onedrive: 'brand-onedrive', dropbox: 'brand-dropbox' }[provider] || 'cloud';
  }

  function providerColor(provider) {
    return { google_drive: '#4285F4', onedrive: '#0078D4', dropbox: '#0061FF' }[provider] || 'var(--blue)';
  }

  const connectedProviders = new Set(connections.map(c => c.provider));

  if (loading) return <p style={{ color: 'var(--ink-faint)', padding: '16px 0', fontSize: 13.5 }}>Chargement…</p>;

  if (justConnected) return (
    <div style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <h3 style={{ color: 'var(--navy)', fontSize: 20, marginBottom: 10 }}>Bien joué !</h3>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 0, lineHeight: 1.6 }}>
        Google Drive est connecté. Vos prochains documents scannés seront<br/>
        automatiquement sauvegardés dans votre dossier <strong>Garantik</strong> sur Drive.
      </p>
    </div>
  );

  return (
    <div>
      {/* Explication */}
      <div style={{
        padding: '12px 16px', borderRadius: 'var(--radius-m)',
        background: 'var(--blue-pale-2)', border: '1px solid var(--blue-pale)',
        fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 20,
      }}>
        <strong style={{ color: 'var(--blue-dark)' }}>Stockage externe</strong> — En connectant votre espace de stockage,
        vos tickets et contrats scannés seront sauvegardés directement chez vous, indépendamment de votre abonnement Garantik.
        Garantik n'accède qu'aux fichiers qu'il crée lui-même.
      </div>

      {/* Connexions actives */}
      {connections.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', marginBottom: 10 }}>
            Connecté
          </div>
          {connections.map(conn => (
            <div key={conn.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 'var(--radius-m)',
              border: '1px solid var(--line)', background: '#fff', marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  background: `${providerColor(conn.provider)}15`,
                  color: providerColor(conn.provider),
                }}>
                  <Icon name={providerIcon(conn.provider)} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>
                    {providerLabel(conn.provider)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                    {conn.email && <span>{conn.email} · </span>}
                    Dossier : {conn.folder_name || 'Garantik'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                  background: 'var(--green-pale)', color: 'var(--green-text)',
                }}>
                  Actif
                </span>
                <button
                  onClick={() => disconnectProvider(conn.provider)}
                  disabled={disconnecting === conn.provider}
                  style={{
                    background: 'none', border: '1px solid var(--line)', borderRadius: 'var(--radius-s)',
                    color: 'var(--red-text)', fontSize: 12.5, cursor: 'pointer',
                    padding: '5px 10px', fontFamily: 'inherit', fontWeight: 500,
                  }}
                >
                  {disconnecting === conn.provider ? '…' : 'Déconnecter'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Providers disponibles */}
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', marginBottom: 10 }}>
        {connections.length > 0 ? 'Ajouter un autre espace' : 'Choisir un espace de stockage'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Google Drive */}
        {!connectedProviders.has('google_drive') && (
          <button
            onClick={connectGoogleDrive}
            disabled={connecting === 'google_drive'}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              borderRadius: 'var(--radius-m)', border: '1px solid var(--line)',
              background: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: '#4285F415',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
            }}>
              🗂️
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>
                Google Drive
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                Stockez vos documents dans un dossier "Garantik" sur votre Drive personnel
              </div>
            </div>
            <span style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600, flexShrink: 0 }}>
              {connecting === 'google_drive' ? 'Connexion…' : 'Connecter →'}
            </span>
          </button>
        )}

        {/* OneDrive — à venir */}
        <button disabled style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
          borderRadius: 'var(--radius-m)', border: '1px solid var(--line)',
          background: 'var(--bg)', cursor: 'not-allowed', textAlign: 'left', fontFamily: 'inherit',
          opacity: 0.6,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#0078D415',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
          }}>
            ☁️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>
              OneDrive <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', marginLeft: 6 }}>Bientôt</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
              Microsoft OneDrive / SharePoint
            </div>
          </div>
        </button>

        {/* Dropbox — à venir */}
        <button disabled style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
          borderRadius: 'var(--radius-m)', border: '1px solid var(--line)',
          background: 'var(--bg)', cursor: 'not-allowed', textAlign: 'left', fontFamily: 'inherit',
          opacity: 0.6,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#0061FF15',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
          }}>
            📦
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>
              Dropbox <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', marginLeft: 6 }}>Bientôt</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
              Stockage Dropbox personnel ou pro
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
