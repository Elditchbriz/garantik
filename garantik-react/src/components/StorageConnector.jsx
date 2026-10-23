import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import Icon from './Icon.jsx';

// ============================================================
// Vrais logos multicolores (pas l'icône monochrome générique du reste de
// l'app — ces marques ont des couleurs qui leur sont propres, essentielles
// à leur reconnaissance immédiate).
// ============================================================
function GoogleDriveLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00AC47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#EA4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832D" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684FC" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#FFBA00" />
    </svg>
  );
}
function DropboxLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 43 40">
      <path d="M12.6 0 0 8.2l8.8 7.1 12.7-7.9z" fill="#0061FE" />
      <path d="M0 22.4l12.6 8.2 8.9-7.4-12.7-7.9z" fill="#0061FE" />
      <path d="M21.5 23.2l8.9 7.4 12.6-8.2-8.8-7.1z" fill="#0061FE" />
      <path d="M43 8.2 30.4 0l-8.9 7.4 12.7 7.9z" fill="#0061FE" />
      <path d="M21.55 24.9l-8.9 7.3v3.6l8.9-5.9 8.9 5.9v-3.6z" fill="#0061FE" />
    </svg>
  );
}
function OneDriveLogo({ size = 24 }) {
  return (
    <svg width={size} height={size * 20 / 32} viewBox="0 0 32 20">
      <path d="M12.7 4.2a7.6 7.6 0 0 1 7 4.9 5.3 5.3 0 0 1 1.5-.2 5.6 5.6 0 0 1 0 11.1H9.2a6.7 6.7 0 0 1-1.4-13.2 7.6 7.6 0 0 1 4.9-2.6z" fill="#0364B8" />
      <path d="M20.2 9.1a5.6 5.6 0 0 1 5.5 5.6c0 .5-.07 1-.2 1.4a5.6 5.6 0 0 0 -2.4-10.4c-.5 0-1 .06-1.5.2.24.66.42 1.36.55 2.08.02.02.03.06.05.1z" fill="#0F78D4" opacity="0.75" />
    </svg>
  );
}
function ProviderLogo({ provider, size = 24 }) {
  if (provider === 'google_drive') return <GoogleDriveLogo size={size} />;
  if (provider === 'dropbox') return <DropboxLogo size={size} />;
  if (provider === 'onedrive') return <OneDriveLogo size={size} />;
  return <Icon name="cloud" style={{ fontSize: size }} />;
}

// ============================================================
// StorageConnector — Connexion aux espaces de stockage externes
// Actuellement : Google Drive
// À venir : OneDrive, Dropbox
// ============================================================

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const DROPBOX_APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY;
const REDIRECT_URI = `${window.location.origin}/settings`;
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file', // Accès aux fichiers créés par l'app uniquement
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

// Le serveur répond { error: « message lisible », code } : on l'affiche tel quel plutôt que « Edge Function returned a non-2xx status code »
async function functionErrorMessage(fnError) {
  try {
    const body = await fnError.context?.json?.();
    if (body?.error) return body.error;
  } catch (_) { /* corps illisible */ }
  return fnError.message;
}

export default function StorageConnector({ orgId }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [justConnected, setJustConnected] = useState(null);   // clé du fournisseur qui vient d'être connecté (google_drive, dropbox…)
  const [disconnecting, setDisconnecting] = useState(null);
  const [justReplaced, setJustReplaced] = useState([]);   // fournisseurs déconnectés par la connexion qui vient d'aboutir
  const [healedNote, setHealedNote] = useState('');      // information affichée si deux espaces étaient connectés en même temps

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
    let rows = data || [];
    // Un seul espace de stockage actif à la fois. Si plusieurs connexions coexistent (anciennes connexions, d'avant cette règle), on garde
    // la plus récente et on déconnecte les autres, en le disant.
    if (rows.length > 1) {
      const sorted = [...rows].sort((a, b) => String(b.connected_at ?? '').localeCompare(String(a.connected_at ?? '')));
      const [keep, ...drop] = sorted;
      await supabase.from('storage_connections').delete().eq('organization_id', orgId).in('provider', drop.map((d) => d.provider));
      rows = [keep];
      setHealedNote(`Un seul espace de stockage peut être actif à la fois : ${drop.map((d) => providerLabel(d.provider)).join(', ')} a été déconnecté, ${providerLabel(keep.provider)} reste actif.`);
    }
    setConnections(rows);
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

    if (!code || !['google_drive', 'dropbox'].includes(state)) return;

    setConnecting(state);   // le fournisseur réellement en cours de connexion (et pas toujours Google Drive)

    // Ce qui était connecté AVANT : la fonction serveur déconnecte les autres fournisseurs quand la nouvelle connexion est enregistrée
    let replaced = [];
    try {
      const { data: before } = await supabase.from('storage_connections').select('provider').eq('organization_id', orgId);
      replaced = (before || []).map((c) => c.provider).filter((p) => p !== state);
    } catch (_) { /* information facultative */ }

    try {
      const fnName = state === 'dropbox' ? 'dropbox-callback' : 'google-drive-callback';
      const { data, error: fnError } = await supabase.functions.invoke(fnName, {
        body: {
          code,
          organization_id: orgId,
          redirect_uri: REDIRECT_URI,
        },
      });

      if (fnError) throw new Error(await functionErrorMessage(fnError));
      if (data?.success) {
        await loadConnections();
        setJustConnected(state);
        setJustReplaced(replaced);
        setTimeout(() => { setJustConnected(null); setJustReplaced([]); }, 5000);
      }
    } catch (err) {
      console.error('Erreur connexion Drive:', err);
      alert(`Impossible de connecter ${providerLabel(state)} : ${err.message}`);
    }

    setConnecting(null);
    // Nettoyer l'URL (retirer code, state, scope)
    window.history.replaceState({}, '', window.location.pathname);
  }

  function connectDropbox() {
    if (!DROPBOX_APP_KEY) {
      alert('Configuration Dropbox manquante. Contactez le support.');
      return;
    }
    if (!confirmSwitch('dropbox')) return;
    const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
    authUrl.searchParams.set('client_id', DROPBOX_APP_KEY);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', 'dropbox');
    authUrl.searchParams.set('token_access_type', 'offline');
    window.location.href = authUrl.toString();
  }

  function connectGoogleDrive() {
    if (!GOOGLE_CLIENT_ID) {
      alert('Configuration Google Drive manquante. Contactez le support.');
      return;
    }
    if (!confirmSwitch('google_drive')) return;
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
    if (!window.confirm(`Déconnecter ${providerLabel(provider)} ? ${providerConsequence(provider)} Les nouveaux fichiers seront stockés sur Hey Did.`)) return;
    setDisconnecting(provider);
    await supabase
      .from('storage_connections')
      .delete()
      .eq('organization_id', orgId)
      .eq('provider', provider);
    await loadConnections();
    setDisconnecting(null);
  }

  // Ce qui arrive aux documents DÉJÀ envoyés quand un espace est déconnecté
  function providerConsequence(provider) {
    if (provider === 'dropbox') return 'Vos documents déjà envoyés restent dans votre Dropbox, mais ne pourront plus être ouverts depuis Hey Did tant que vous ne le reconnectez pas.';
    if (provider === 'google_drive') return 'Vos documents déjà envoyés restent dans votre Google Drive et continueront de s\'ouvrir avec votre compte Google.';
    return 'Vos documents déjà envoyés restent dans votre espace de stockage.';
  }

  // Un seul espace actif à la fois : si un autre est connecté, on prévient avant de partir vers le nouveau (rien n'est supprimé à ce stade :
  // l'ancien n'est déconnecté qu'une fois la nouvelle connexion réussie).
  function confirmSwitch(to) {
    const others = connections.filter((c) => c.provider !== to);
    if (!others.length) return true;
    const from = others[0].provider;
    return window.confirm(`Un seul espace de stockage peut être actif à la fois.\n\nConnecter ${providerLabel(to)} va déconnecter ${providerLabel(from)} : vos prochains documents seront envoyés sur ${providerLabel(to)}.\n${providerConsequence(from)}\n\nContinuer ?`);
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
        {providerLabel(justConnected)} est connecté. Vos prochains documents scannés seront<br/>
        automatiquement sauvegardés dans votre dossier <strong>{connections.find((c) => c.provider === justConnected)?.folder_name || 'Hey Did'}</strong> sur votre {providerLabel(justConnected)}.
        {justReplaced.length > 0 && (<><br />{justReplaced.map(providerLabel).join(', ')} a été déconnecté : un seul espace de stockage est actif à la fois.</>)}
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
        vos tickets et contrats scannés seront sauvegardés directement chez vous, indépendamment de votre abonnement Hey Did.
        Hey Did n'accède qu'aux fichiers qu'il crée lui-même.
      </div>

      {healedNote && (
        <div role="status" style={{ fontSize: 12.5, color: 'var(--ink-soft)', background: 'var(--amber-pale)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', padding: '10px 14px', marginBottom: 16, lineHeight: 1.5 }}>
          {healedNote}
        </div>
      )}

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
              flexWrap: 'wrap', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                  background: `${providerColor(conn.provider)}15`,
                  color: providerColor(conn.provider),
                }}>
                  <ProviderLogo provider={conn.provider} size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>
                    {providerLabel(conn.provider)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', overflowWrap: 'anywhere' }}>
                    {conn.email && <span>{conn.email} · </span>}
                    Dossier : {conn.folder_name || 'Hey Did'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
                    padding: '5px 10px', fontFamily: 'inherit', fontWeight: 500, whiteSpace: 'nowrap',
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
        {connections.length > 0 ? 'Changer d\'espace de stockage' : 'Choisir un espace de stockage'}
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
              <GoogleDriveLogo size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>
                Google Drive
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                Stockez vos documents dans un dossier "Hey Did" sur votre Drive personnel
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
            <OneDriveLogo size={22} />
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

        {/* Dropbox */}
        {!connectedProviders.has('dropbox') && (
          <button
            onClick={connectDropbox}
            disabled={connecting === 'dropbox'}
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
              width: 40, height: 40, borderRadius: 10, background: '#0061FF15',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
            }}>
              <DropboxLogo size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>
                Dropbox
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                Stockez vos documents dans un dossier "Hey Did" sur votre Dropbox
              </div>
            </div>
            <span style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600, flexShrink: 0 }}>
              {connecting === 'dropbox' ? 'Connexion…' : 'Connecter →'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
