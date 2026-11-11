import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { captureError } from '../lib/monitoring.js';
import { isNativeApp } from '../lib/platform.js';

// Retour d'une connexion à un stockage externe (Google Drive, Dropbox, OneDrive).
// Android confie la page du fournisseur au NAVIGATEUR : le retour arrive donc dans le navigateur, où la personne n'est pas forcément connectée, et non dans l'application.
// Cette page traite le retour AVANT la page protégée par la connexion (le « state » signé par le serveur suffit à savoir quelle organisation reçoit la connexion),
// puis invite à retourner dans l'application, qui met sa liste à jour toute seule à son retour.
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.heydid.app';
const FUNCTIONS = { google_drive: 'google-drive-callback', dropbox: 'dropbox-callback', onedrive: 'onedrive-callback' };
const LABELS = { google_drive: 'Google Drive', dropbox: 'Dropbox', onedrive: 'OneDrive' };

// État signé : fournisseur.organisation.expiration.aléa.signature (cinq parties). Un ancien état (« dropbox » seul) n'est pas pris en charge ici.
export function parseOAuthReturn(search) {
  const p = new URLSearchParams(search);
  const state = p.get('state') || '';
  const [provider, ...rest] = state.split('.');
  if (!FUNCTIONS[provider] || rest.length !== 4) return null;
  return { provider, state, code: p.get('code'), denied: p.get('error') };
}

export default function StorageReturnGate() {
  const navigate = useNavigate();
  const started = useRef(false);
  const [ret] = useState(() => parseOAuthReturn(window.location.search));
  const [status, setStatus] = useState(ret ? (ret.code && !ret.denied ? 'working' : 'denied') : null);   // working | ok | denied | error
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!ret || started.current) return;
    started.current = true;
    // L'adresse est nettoyée tout de suite : un rechargement ne doit pas rejouer un code qui ne sert qu'une fois.
    window.history.replaceState({}, '', window.location.pathname);
    if (!ret.code || ret.denied) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(FUNCTIONS[ret.provider], {
          body: { code: ret.code, state: ret.state, redirect_uri: `${window.location.origin}/settings` },
        });
        if (error || !data?.success) throw error || new Error('réponse inattendue');
        setStatus('ok');
      } catch (err) {
        captureError(err, { where: 'storage:retour-oauth', extra: { provider: ret.provider } });
        setStatus('error');
      }
    })();
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!ret || closed) return null;
  const label = LABELS[ret.provider];
  const androidBrowser = !isNativeApp() && typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
  const title = status === 'ok' ? `${label} est connecté ✅` : status === 'working' ? `Connexion à ${label}…` : status === 'denied' ? 'Connexion annulée' : "La connexion n'a pas abouti";
  const text = status === 'ok' ? 'Vos prochains documents scannés seront sauvegardés dans votre dossier Hey Did.'
    : status === 'working' ? 'Un instant, nous finalisons la connexion.'
    : status === 'denied' ? "Aucune connexion n'a été faite. Vous pouvez réessayer depuis les réglages de l'application."
    : "Réessayez depuis l'application. Si le problème continue, écrivez-nous à contact@hey-did.fr.";
  const goOn = () => { setClosed(true); navigate('/settings', { replace: true }); };
  const btn = { width: '100%', justifyContent: 'center', padding: 12, marginTop: 10, textDecoration: 'none' };

  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3500, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 8px 24px rgba(27,36,48,0.12)' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 10px', color: 'var(--navy)' }}>{title}</h1>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 8px' }}>{text}</p>
        {status !== 'working' && androidBrowser && (
          <>
            <a href={PLAY_STORE_URL} className="btn btn-primary" style={btn}>Retourner dans l'application Hey Did</a>
            <button type="button" className="btn btn-secondary" onClick={goOn} style={btn}>Continuer sur le site</button>
          </>
        )}
        {status !== 'working' && !androidBrowser && (
          <button type="button" className="btn btn-primary" onClick={goOn} style={btn}>Continuer</button>
        )}
      </div>
    </div>
  );
}
